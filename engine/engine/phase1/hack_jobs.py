"""Section B hack attempts on the judge: sending them, collecting results, scoring them.

The scheduler calls tick(). Pending attempts are claimed with SKIP LOCKED before they
are sent, so several schedulers never send the same attempt twice. A result is written
only while the attempt is still waiting on that job, so a late or repeated result
changes nothing. Only a participant's first successful hack on a question scores; a
failed hack costs the question's penalty.
"""

from __future__ import annotations

from typing import Any

import sqlalchemy as sa

from engine.core import clock, db, events
from engine.judge import client as judge_client
from engine.judge.client import JudgeError
from engine.schema import p1_hack_attempt, p1_hack_question, p1_hack_solution


def tick() -> None:
    send_pending()
    poll()


def send_pending() -> None:
    for _ in range(20):
        if not send_one():
            return


def send_one() -> bool:
    with db.transaction() as conn:
        row = conn.execute(
            sa.select(
                p1_hack_attempt.c.id,
                p1_hack_attempt.c.input,
                p1_hack_question.c.problem_id,
                p1_hack_solution.c.language,
                p1_hack_solution.c.source,
            )
            .join(p1_hack_question, p1_hack_question.c.id == p1_hack_attempt.c.question_id)
            .outerjoin(p1_hack_solution, p1_hack_solution.c.id == p1_hack_attempt.c.solution_id)
            .where(p1_hack_attempt.c.state == "pending")
            .order_by(p1_hack_attempt.c.id)
            .limit(1)
            .with_for_update(of=p1_hack_attempt, skip_locked=True)
        ).one_or_none()
        if row is None:
            return False
        if row.source is None:
            # The copy it was aimed at was removed before it ran: nothing to judge.
            _broken(conn, row.id)
            return True
        try:
            job_id = judge_client.hack(
                problem_id=row.problem_id,
                language=row.language,
                source=row.source,
                input=row.input,
                submission_id=f"hack_{row.id}",
            )
        except JudgeError as err:
            return _send_failed(conn, row.id, err)
        conn.execute(
            sa.update(p1_hack_attempt)
            .where(p1_hack_attempt.c.id == row.id)
            .values(state="queued", job_id=job_id)
        )
    return True


def _send_failed(conn: sa.Connection, attempt_id: int, err: JudgeError) -> bool:
    if err.judge_status in (400, 404):
        _broken(conn, attempt_id, err.message)
        return True
    conn.execute(
        sa.update(p1_hack_attempt)
        .where(p1_hack_attempt.c.id == attempt_id)
        .values(retries=p1_hack_attempt.c.retries + 1)
    )
    return False


def _broken(conn: sa.Connection, attempt_id: int, message: str) -> None:
    """The question, not the participant, is at fault: neither a hack nor a failure,
    and nothing scored. The judge's refusal is kept, as the one account of why."""
    conn.execute(
        sa.update(p1_hack_attempt)
        .where(p1_hack_attempt.c.id == attempt_id)
        .values(
            state="done",
            valid_input=True,
            hacked=None,
            verdict="IE",
            invalid_reason=None,
            message=message,
            ended_at=clock.now(),
        )
    )


def poll() -> None:
    with db.transaction() as conn:
        waiting = conn.execute(
            sa.select(
                p1_hack_attempt.c.id,
                p1_hack_attempt.c.job_id,
                p1_hack_attempt.c.state,
            ).where(p1_hack_attempt.c.state.in_(("queued", "running")))
        ).all()
    for row in waiting:
        if row.job_id:
            _poll_one(row)


def _poll_one(row: sa.Row) -> None:
    try:
        job = judge_client.job(row.job_id)
    except JudgeError as err:
        if err.judge_status == 404:
            # The judge lost the job: send the attempt again.
            _update_if_waiting(row, state="pending", job_id=None)
        return
    if job["state"] != "done" or not job.get("result"):
        if job["state"] != row.state:
            _update_if_waiting(row, state=job["state"])
        return
    settled = settle(row, job["result"])
    if settled:
        events.publish("hack", {"attempt_id": row.id, "state": "done"}, settled)
        events.publish("leaderboard")


def _update_if_waiting(row: sa.Row, **values: Any) -> None:
    with db.transaction() as conn:
        conn.execute(
            sa.update(p1_hack_attempt)
            .where(
                p1_hack_attempt.c.id == row.id,
                p1_hack_attempt.c.job_id == row.job_id,
                p1_hack_attempt.c.state.in_(("queued", "running")),
            )
            .values(**values)
        )


def settle(row: sa.Row, result: dict[str, Any]) -> str | None:
    """Score a finished attempt.

    Returns the participant id, or None if something else already settled it.
    """
    with db.transaction() as conn:
        attempt = conn.execute(
            sa.select(
                p1_hack_attempt,
                p1_hack_question.c.hack_points,
                p1_hack_question.c.fail_penalty,
            )
            .join(p1_hack_question, p1_hack_question.c.id == p1_hack_attempt.c.question_id)
            .where(
                p1_hack_attempt.c.id == row.id,
                p1_hack_attempt.c.job_id == row.job_id,
                p1_hack_attempt.c.state != "done",
            )
            .with_for_update(of=p1_hack_attempt)
        ).one_or_none()
        if attempt is None:
            return None
        conn.execute(
            sa.update(p1_hack_attempt)
            .where(p1_hack_attempt.c.id == row.id)
            .values(
                state="done",
                valid_input=result["valid_input"],
                invalid_reason=None if result["valid_input"] else result["invalid_reason"],
                hacked=result["hacked"],
                verdict=result["verdict"],
                message=result.get("message") or None,
                points_awarded=_points(conn, attempt, result),
                ended_at=clock.now(),
            )
        )
    return attempt.participant_id


def _points(conn: sa.Connection, attempt: sa.Row, result: dict[str, Any]) -> int:
    if not result["valid_input"]:
        return 0  # invalid input, or the problem is broken: nothing either way
    if result["hacked"] is False:
        return -attempt.fail_penalty
    if result["hacked"] is not True:
        return 0
    already = conn.execute(
        sa.select(p1_hack_attempt.c.id)
        .where(
            p1_hack_attempt.c.participant_id == attempt.participant_id,
            p1_hack_attempt.c.question_id == attempt.question_id,
            p1_hack_attempt.c.hacked.is_(True),
        )
        .limit(1)
    ).first()
    return 0 if already else attempt.hack_points
