"""Validator scoring for Section A: sending answers to the judge and collecting scores.

Validator-graded answers are never scored live, only once the section closes, so
"find as many as you can" cannot be brute-forced. The transaction that closes
Section A marks them pending; the scheduler's tick() then sends them.

Pending answers are claimed with SKIP LOCKED, so several schedulers never send the
same answer twice, and a score is written only while the answer is still waiting on
that job. A validator that fails to run flags the answer; it never scores zero.
"""

from __future__ import annotations

from typing import Any

import sqlalchemy as sa

from engine.core import db, events
from engine.judge import client as judge_client
from engine.judge.client import JudgeError
from engine.phase1.answers import distinct_entries
from engine.schema import p1_answer, p1_question


def queue_validator_scoring(conn: sa.Connection) -> None:
    """Mark every validator-graded answer for scoring.

    Called in the transaction that closes Section A.
    """
    validator_questions = sa.select(p1_question.c.id).where(
        p1_question.c.grading == "validator", p1_question.c.published.is_(True)
    )
    conn.execute(
        sa.update(p1_answer)
        .where(
            p1_answer.c.question_id.in_(validator_questions),
            sa.or_(p1_answer.c.score_state.is_(None), p1_answer.c.score_state != "done"),
        )
        .values(score_state="pending", score_job_id=None)
    )


def tick() -> None:
    for _ in range(20):
        if not _send_one_validator_job():
            break
    _poll_validator_jobs()


def _send_one_validator_job() -> bool:
    with db.transaction() as conn:
        row = conn.execute(
            sa.select(
                p1_answer,
                p1_question.c.validator_py,
                p1_question.c.config,
                p1_question.c.max_entries,
            )
            .join(p1_question, p1_question.c.id == p1_answer.c.question_id)
            .where(p1_answer.c.score_state == "pending")
            .limit(1)
            .with_for_update(of=p1_answer, skip_locked=True)
        ).one_or_none()
        if row is None:
            return False
        entries = distinct_entries(row, row.answer)
        where = sa.and_(
            p1_answer.c.participant_id == row.participant_id,
            p1_answer.c.question_id == row.question_id,
        )
        if not row.validator_py or not entries:
            conn.execute(sa.update(p1_answer).where(where).values(score_state="done", auto_score=0))
            return True
        try:
            submission_id = f"p1_{row.participant_id}_{row.question_id}"[:64]
            job_id = judge_client.validate_answers(
                validator=row.validator_py,
                entries=entries,
                submission_id=submission_id,
            )
        except JudgeError:
            return False  # judge unreachable: stay pending, retry next tick
        conn.execute(
            sa.update(p1_answer).where(where).values(score_state="queued", score_job_id=job_id)
        )
    return True


def _poll_validator_jobs() -> None:
    with db.transaction() as conn:
        queued = conn.execute(
            sa.select(
                p1_answer.c.participant_id,
                p1_answer.c.question_id,
                p1_answer.c.score_job_id,
                p1_question.c.points_per_entry,
            )
            .join(p1_question, p1_question.c.id == p1_answer.c.question_id)
            .where(p1_answer.c.score_state == "queued")
        ).all()
    changed = False
    for row in queued:
        if row.score_job_id and _collect_validator_job(row):
            changed = True
    if changed:
        events.publish("leaderboard")


def _collect_validator_job(row: sa.Row) -> bool:
    try:
        job = judge_client.job(row.score_job_id)
    except JudgeError as err:
        if err.judge_status == 404:
            _set_score(row, score_state="pending", score_job_id=None)
        return False
    if job["state"] != "done" or not job.get("result"):
        return False
    result = job["result"]
    if result["status"] == "IE":
        # Nothing was checked. Flag it; never write a zero.
        return _set_score(row, score_state="error", score_error=result["message"])
    valid = sum(1 for r in result["results"] if r["valid"])
    score = valid * (row.points_per_entry or 0)
    return _set_score(row, score_state="done", auto_score=score, score_error=None)


def _set_score(row: sa.Row, **values: Any) -> bool:
    """Only while still waiting on this job, so a late or repeated answer changes nothing."""
    with db.transaction() as conn:
        return bool(
            conn.execute(
                sa.update(p1_answer)
                .where(
                    p1_answer.c.participant_id == row.participant_id,
                    p1_answer.c.question_id == row.question_id,
                    p1_answer.c.score_state == "queued",
                    p1_answer.c.score_job_id == row.score_job_id,
                )
                .values(**values)
            ).rowcount
        )
