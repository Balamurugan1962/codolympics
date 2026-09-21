"""Practice runs: a participant's code on the samples, or on an input they typed.

The way "Run" works on LeetCode. Nothing is scored, no coins move and no hidden
testcase is touched: the judge compiles the code once and runs it on the
question's samples and the participant's own input, under the real limits.

A run is a judge job like a submission and lives the same life: a row holds
its state, the scheduler asks the judge about every run in flight, and the
workspace polls the row. Unlike a submission, neither the source nor the
outputs are stored. The row says who ran what and how it went, which is
what the Judge page lists; the outputs are handed to the workspace from the
judge's own copy while the judge still has it, and are gone after that,
which is fine for something that was only ever a look.
"""

from __future__ import annotations

import datetime as dt
from typing import Any

import sqlalchemy as sa

from engine.coding.submissions import (
    IN_FLIGHT,
    check_code,
    check_participant,
    check_round_open,
    offered_languages,
)
from engine.contest.rules import get_contest
from engine.core import clock, db, errors
from engine.judge import client as judge_client
from engine.judge.client import JudgeError
from engine.marketplace.blackouts import assert_not_blacked_out
from engine.schema import practice_run, question

MAX_CUSTOM_INPUT_BYTES = 65_536
# A run that never reached the judge (the process died between the insert and
# the send) must not hold its participant's one slot for the rest of the day.
UNSENT_AFTER = dt.timedelta(seconds=30)
LOST = "the judge lost this run; run it again"


def start(
    participant_id: str,
    question_id: str,
    language: str,
    source: str,
    custom_input: str | None,
) -> int:
    offered = offered_languages()
    with db.transaction() as conn:
        assert_not_blacked_out(conn, participant_id)
        check_round_open(get_contest(conn))
        check_code(language, source, offered)
        if custom_input is not None and len(custom_input.encode()) > MAX_CUSTOM_INPUT_BYTES:
            raise errors.invalid("custom input is larger than 64 KB")
        q = conn.execute(sa.select(question).where(question.c.id == question_id)).one_or_none()
        if q is None:
            raise errors.not_found("question")
        if q.sample_count == 0 and custom_input is None:
            raise errors.conflict("nothing_to_run", "this question has no samples; give an input")
        check_participant(conn, participant_id, question_id)
        if _live(conn, participant_id):
            raise errors.conflict("in_flight", "your previous run is still going")
        run_id = conn.execute(
            sa.insert(practice_run)
            .values(participant_id=participant_id, question_id=question_id, language=language)
            .returning(practice_run.c.id)
        ).scalar_one()
    # The judge is called outside the transaction. Whatever goes wrong now ends
    # the run, so the slot it holds is given back.
    try:
        job_id = judge_client.run(
            problem_id=question_id,
            language=language,
            source=source,
            samples=q.sample_count,
            inputs=[] if custom_input is None else [{"input": custom_input, "answer": None}],
            submission_id=f"run_{run_id}",
        )
    except Exception as err:
        message = err.message if isinstance(err, JudgeError) else "the run could not be sent"
        _update(run_id, state="done", verdict="IE", message=message, ended_at=clock.now())
        raise
    _update(run_id, state="queued", job_id=job_id)
    return run_id


def _live(conn: sa.Connection, participant_id: str) -> sa.Row | None:
    return conn.execute(
        sa.select(practice_run.c.id).where(
            practice_run.c.participant_id == participant_id,
            practice_run.c.state.in_(IN_FLIGHT),
        )
    ).first()


# --- the poller, run by the scheduler ------------------------------------


def tick() -> None:
    """Ask the judge about every run in flight, and give up on any that was never sent."""
    with db.transaction() as conn:
        rows = conn.execute(
            sa.select(practice_run).where(practice_run.c.state.in_(IN_FLIGHT))
        ).all()
    for r in rows:
        if r.job_id:
            _poll_one(r)
        elif clock.now() - r.created_at > UNSENT_AFTER:
            _finish(r.id, "IE", "the run was never sent to the judge; run it again")


def _poll_one(r: sa.Row) -> None:
    try:
        job = judge_client.job(r.job_id)
    except JudgeError as err:
        if err.judge_status == 404:
            # The source is not kept, so there is nothing to send again.
            _finish(r.id, "IE", LOST)
        return
    result = job.get("result")
    if job["state"] == "done" and result:
        _finish(r.id, result["verdict"], result["message"])
    elif job["state"] != r.state:
        _update(r.id, state=job["state"])


def _finish(run_id: int, verdict: str, message: str) -> None:
    _update(run_id, state="done", verdict=verdict, message=message, ended_at=clock.now())


def _update(run_id: int, **values: Any) -> None:
    with db.transaction() as conn:
        conn.execute(sa.update(practice_run).where(practice_run.c.id == run_id).values(**values))


# --- what the workspace sees ---------------------------------------------


def poll(participant_id: str, run_id: int) -> dict[str, Any]:
    """The run as the row has it. Once it is done, the judge is asked once for
    the outputs, which it keeps for a while after finishing."""
    with db.transaction() as conn:
        r = conn.execute(
            sa.select(practice_run).where(
                practice_run.c.id == run_id, practice_run.c.participant_id == participant_id
            )
        ).one_or_none()
    if r is None:
        raise errors.not_found("run")
    result = _outputs(r) if r.state == "done" and r.job_id else None
    return {
        "id": r.id,
        "question_id": r.question_id,
        "language": r.language,
        "state": r.state,
        "verdict": r.verdict,
        "message": r.message,
        # Everything in the judge's result is the participant's own program
        # talking, so all of it is theirs to see.
        "compile_output": result.get("compile_output", "") if result else "",
        "outputs": result.get("outputs", []) if result else None,
        "created_at": clock.iso(r.created_at),
        "ended_at": clock.iso(r.ended_at),
    }


def _outputs(r: sa.Row) -> dict[str, Any] | None:
    try:
        job = judge_client.job(r.job_id)
    except JudgeError as err:
        if err.judge_status == 404:
            return None  # the judge has forgotten it; the verdict on the row still stands
        raise
    return job.get("result") if job["state"] == "done" else None
