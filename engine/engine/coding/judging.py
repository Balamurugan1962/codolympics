"""The judge poller: sending pending judgements and recording what comes back.

Every step is a row update, so a restart resumes mid-flight with nothing lost.

Many senders. The poller runs in the scheduler and also straight after a submit,
possibly in several processes. A pending judgement is claimed with
`FOR UPDATE SKIP LOCKED` before it is sent, so exactly one sender sends it and the
others skip past instead of queueing a duplicate job on the judge. No HTTP call to
the judge is made while holding a lock, except the brief /submit under that claim.

Results out of order. A result is written only while the row is still in flight
*and* still waiting on that job id. A participant who cancelled, a rejudge that
superseded the row, or a job resubmitted after the judge restarted -- in every case
the late result updates nothing. The write locks the participant row first, as
submit and cancel do, so the three can never wait on each other in a cycle.
"""

from __future__ import annotations

from typing import Any

import sqlalchemy as sa

from engine.accounts import wallet
from engine.core import clock, db, events
from engine.judge import client as judge_client
from engine.judge.client import JudgeError
from engine.schema import judgement, participant, submission


def send_pending() -> None:
    """Send pending judgements to the judge, one claimed row at a time."""
    for _ in range(20):
        if not send_one():
            return


def _claim_pending(conn: sa.Connection) -> sa.Row | None:
    """The oldest pending judgement no other sender is holding.

    SKIP LOCKED passes over rows another sender has already claimed.
    """
    return conn.execute(
        sa.select(
            judgement.c.id.label("judgement_id"),
            judgement.c.attempt,
            submission.c.id.label("submission_id"),
            submission.c.participant_id,
            submission.c.question_id,
            submission.c.language,
            submission.c.source,
        )
        .join(submission, submission.c.id == judgement.c.submission_id)
        .where(judgement.c.state == "pending", judgement.c.superseded_at.is_(None))
        .order_by(judgement.c.id)
        .limit(1)
        .with_for_update(of=judgement, skip_locked=True)
    ).one_or_none()


def send_one() -> bool:
    """Claim one pending judgement and send it. False when there is nothing left to send."""
    with db.transaction() as conn:
        row = _claim_pending(conn)
        if row is None:
            return False
        # The claim is held while the judge answers; /submit returns at once.
        try:
            job_id = judge_client.submit(
                problem_id=row.question_id,
                language=row.language,
                source=row.source,
                submission_id=f"sub_{row.submission_id}_{row.attempt}",
            )
        except JudgeError as err:
            failure = err
        else:
            failure = None
            conn.execute(
                sa.update(judgement)
                .where(judgement.c.id == row.judgement_id)
                .values(state="queued", job_id=job_id)
            )
    if failure is None:
        queued = {"submission_id": row.submission_id, "state": "queued"}
        events.publish("verdict", queued, row.participant_id)
        return True
    return _send_failed(row, failure)


def _send_failed(row: sa.Row, err: JudgeError) -> bool:
    """After the claim is released, so the result write can take the participant lock first."""
    if err.judge_status not in (400, 404):
        # Unreachable or busy: stay pending and try again next tick.
        with db.transaction() as conn:
            conn.execute(
                sa.update(judgement)
                .where(judgement.c.id == row.judgement_id)
                .values(retries=judgement.c.retries + 1)
            )
        return False
    # The problem itself is broken: an internal error, never the contestant's fault.
    result = {
        "verdict": "IE",
        "message": f"judge rejected the submission: {err.message}",
        "jury_detail": err.message,
    }
    with db.transaction() as conn:
        finished = _write_result(conn, row.judgement_id, None, row.participant_id, result)
    if finished:
        _announce_result(row.judgement_id, row.participant_id, "IE")
    return True


def poll_in_flight() -> None:
    """Ask the judge about every queued or running judgement."""
    with db.transaction() as conn:
        rows = conn.execute(
            sa.select(
                judgement.c.id,
                judgement.c.job_id,
                judgement.c.state,
                judgement.c.progress_done,
                judgement.c.progress_total,
                submission.c.id.label("submission_id"),
                submission.c.participant_id,
            )
            .join(submission, submission.c.id == judgement.c.submission_id)
            .where(
                judgement.c.state.in_(("queued", "running")),
                judgement.c.superseded_at.is_(None),
            )
        ).all()
    for row in rows:
        if row.job_id:
            _poll_one(row)


def _poll_one(row: sa.Row) -> None:
    try:
        job = judge_client.job(row.job_id)
    except JudgeError as err:
        if err.judge_status == 404:
            # The job expired or the judge restarted: send the stored source again.
            _resubmit(row)
        return
    result = job.get("result")
    if job["state"] == "done" and result:
        with db.transaction() as conn:
            finished = _write_result(conn, row.id, row.job_id, row.participant_id, result)
        if finished:
            _announce_result(row.id, row.participant_id, result["verdict"])
        return
    _write_progress(row, job)


def _resubmit(row: sa.Row) -> None:
    with db.transaction() as conn:
        conn.execute(
            sa.update(judgement)
            .where(
                judgement.c.id == row.id,
                judgement.c.job_id == row.job_id,
                judgement.c.state.in_(("queued", "running")),
            )
            .values(state="pending", job_id=None, retries=judgement.c.retries + 1)
        )


def _write_progress(row: sa.Row, job: dict[str, Any]) -> None:
    progress = job["progress"]
    # Nothing moved since the last tick: no write, and no event for the page to chase.
    reported = (job["state"], progress["done"], progress["total"])
    stored = (row.state, row.progress_done, row.progress_total)
    if reported == stored:
        return
    with db.transaction() as conn:
        updated = conn.execute(
            sa.update(judgement)
            .where(
                judgement.c.id == row.id,
                judgement.c.job_id == row.job_id,
                judgement.c.state.in_(("queued", "running")),
            )
            .values(
                state=job["state"],
                progress_done=progress["done"],
                progress_total=progress["total"],
            )
        ).rowcount
    if updated:
        data = {"submission_id": row.submission_id, "state": job["state"], "progress": progress}
        events.publish("verdict", data, row.participant_id)


def _write_result(
    conn: sa.Connection,
    judgement_id: int,
    job_id: str | None,
    participant_id: str,
    r: dict[str, Any],
) -> bool:
    """Record a verdict -- only if the row is still waiting for it. Returns whether it was."""
    # Participant first, as in submit and cancel: see the module docstring.
    wallet.lock_participant(conn, participant_id)
    still_waiting = sa.and_(
        judgement.c.id == judgement_id,
        judgement.c.state != "done",
        judgement.c.superseded_at.is_(None),
    )
    if job_id is not None:
        still_waiting = sa.and_(still_waiting, judgement.c.job_id == job_id)
    now = clock.now()
    updated = conn.execute(
        sa.update(judgement)
        .where(still_waiting)
        .values(
            state="done",
            verdict=r["verdict"],
            passed=r.get("passed", 0),
            total=r.get("total", 0),
            first_fail=r.get("first_fail"),
            max_time_ms=r.get("max_time_ms", 0),
            max_memory_kb=r.get("max_memory_kb", 0),
            compile_output=r.get("compile_output", ""),
            message=r["message"],
            jury_detail=r.get("jury_detail", ""),
            problem_version=r.get("problem_version"),
            progress_done=r.get("total", 0),
            progress_total=r.get("total", 0),
            ended_at=now,
        )
    ).rowcount
    if updated:
        conn.execute(
            sa.update(participant)
            .where(participant.c.user_id == participant_id)
            .values(last_judgement_ended_at=now)
        )
    return bool(updated)


def _announce_result(judgement_id: int, participant_id: str, verdict: str) -> None:
    events.publish(
        "verdict",
        {"judgement_id": judgement_id, "state": "done", "verdict": verdict},
        participant_id,
    )
    if verdict == "AC":
        events.publish("leaderboard")


def tick() -> None:
    send_pending()
    poll_in_flight()
