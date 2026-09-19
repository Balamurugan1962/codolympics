"""Rejudging a question's submissions, and how many a publish would rejudge.

A rejudge never edits a judgement in place. It marks the current one superseded and
inserts a fresh pending one, which the poller then sends. A partial unique index on
judgement (submission_id WHERE superseded_at IS NULL) keeps exactly one current
judgement per submission, so the old row is superseded before the new one goes in.
"""

from __future__ import annotations

import sqlalchemy as sa

from engine.core import clock, db, events
from engine.core.audit import audit
from engine.judge import client as judge_client
from engine.schema import judgement, submission


def rejudge_question(
    question_id: str, actor_id: str | None = None, reason: str | None = None
) -> int:
    """Rejudge every submission for a question. Returns how many.

    A publish rejudges without a separate audit row, so `actor_id` is optional.
    """
    with db.transaction() as conn:
        subs = conn.execute(
            sa.select(submission.c.id, submission.c.participant_id).where(
                submission.c.question_id == question_id
            )
        ).all()
        stale_jobs: list[str] = []
        for s in subs:
            stale = _supersede_current(conn, s.id)
            if stale is not None:
                stale_jobs.append(stale)
        if actor_id:
            audit(
                conn,
                actor_id=actor_id,
                action="question.rejudge",
                target=question_id,
                reason=reason or "",
                detail={"submissions": len(subs)},
            )
    for job_id in stale_jobs:
        judge_client.cancel(job_id)
    for participant_id in {s.participant_id for s in subs}:
        events.publish("verdict", {"rejudge": True}, participant_id)
    return len(subs)


def _supersede_current(conn: sa.Connection, submission_id: int) -> str | None:
    """Replace a submission's current judgement with a fresh pending one.

    Returns the old judgement's job id if the judge may still be working on it.
    """
    current = conn.execute(
        sa.select(judgement)
        .where(judgement.c.submission_id == submission_id, judgement.c.superseded_at.is_(None))
        .with_for_update()
    ).one_or_none()
    if current is None:
        return None
    conn.execute(
        sa.update(judgement).where(judgement.c.id == current.id).values(superseded_at=clock.now())
    )
    conn.execute(
        sa.insert(judgement).values(
            submission_id=submission_id,
            state="pending",
            attempt=current.attempt + 1,
        )
    )
    if current.job_id and current.state != "done":
        return current.job_id
    return None


def submission_count(conn: sa.Connection, question_id: str) -> int:
    """How many submissions a publish would rejudge -- the blast radius."""
    return conn.execute(
        sa.select(sa.func.count())
        .select_from(submission)
        .where(submission.c.question_id == question_id)
    ).scalar_one()


def blast_radius(question_id: str) -> int:
    with db.transaction() as conn:
        return submission_count(conn, question_id)
