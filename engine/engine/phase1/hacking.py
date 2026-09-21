"""Phase 1, Section B: hacking, as participants see and use it.

A participant submits a test input, never code. The flawed code comes in more
than one language; the participant reads the one they like and the judge runs
that copy against the stored reference. The first successful hack on a question
scores, whichever copy it hit; later ones report success and score nothing.
Feedback is deliberately thin: valid or not, hacked or not, never the verdict.

Like Phase 2 submissions, the participant row serialises one person's attempts:
one in flight, then a cooldown. Sending and settling attempts is in hack_jobs.
"""

from __future__ import annotations

from typing import Any

import sqlalchemy as sa

from engine.accounts import wallet
from engine.coding.submissions import COOLDOWN_MS
from engine.coding.submissions import MAX_SOURCE_BYTES as MAX_INPUT_BYTES
from engine.contest.rules import get_contest, lock_contest
from engine.core import clock, db, errors
from engine.marketplace.blackouts import assert_not_blacked_out
from engine.phase1 import solutions
from engine.phase1.hack_jobs import send_one
from engine.schema import p1_hack_attempt, p1_hack_question

VISIBLE_FROM = ("p1_hacking", "review", "auction1", "coding1", "auction2", "final", "ended")


def participant_question(q: sa.Row, copies: list[sa.Row]) -> dict[str, Any]:
    """The reference solution is not in the database at all; the given code is the task."""
    return {
        "id": q.id,
        "title": q.title,
        "statement_md": q.statement_md,
        "constraints_md": q.constraints_md,
        "solutions": [solutions.participant_view(s) for s in copies],
        "hack_points": q.hack_points,
        "fail_penalty": q.fail_penalty,
        "order_index": q.order_index,
    }


def participant_attempt(a: sa.Row) -> dict[str, Any]:
    """Valid or not, hacked or not. Never the verdict."""
    return {
        "id": a.id,
        "question_id": a.question_id,
        "solution_id": a.solution_id,
        "state": a.state,
        "valid_input": a.valid_input,
        "invalid_reason": a.invalid_reason,
        "hacked": a.hacked,
        "points_awarded": a.points_awarded,
        "created_at": clock.iso(a.created_at),
    }


def section_for(participant_id: str) -> dict[str, Any]:
    with db.transaction() as conn:
        c = get_contest(conn)
        if c.phase not in VISIBLE_FROM:
            raise errors.conflict("not_open", "Section B has not opened")
        questions = conn.execute(
            sa.select(p1_hack_question)
            .where(p1_hack_question.c.published.is_(True), p1_hack_question.c.voided.is_(False))
            .order_by(p1_hack_question.c.order_index, p1_hack_question.c.id)
        ).all()
        attempts = conn.execute(
            sa.select(p1_hack_attempt)
            .where(p1_hack_attempt.c.participant_id == participant_id)
            .order_by(p1_hack_attempt.c.id.desc())
        ).all()
        copies = solutions.for_questions(conn, [q.id for q in questions])
    is_open = c.phase == "p1_hacking" and not (c.phase_ends_at and c.phase_ends_at <= clock.now())
    return {
        "open": is_open,
        "phase_ends_at": clock.iso(c.phase_ends_at),
        "server_now": clock.now_ms(),
        "questions": [participant_question(q, copies[q.id]) for q in questions],
        "attempts": [participant_attempt(a) for a in attempts],
    }


def submit(participant_id: str, question_id: int, solution_id: int, test_input: str) -> int:
    """An input against one copy of the code: the one the participant was reading."""
    if len(test_input.encode()) > MAX_INPUT_BYTES:
        raise errors.invalid("input is larger than 256 KB")
    with db.transaction() as conn:
        c = lock_contest(conn)
        if c.phase != "p1_hacking":
            raise errors.conflict("section_closed", "Section B is not open")
        if c.phase_ends_at and c.phase_ends_at <= clock.now():
            raise errors.conflict("section_closed", "Section B has closed")
        assert_not_blacked_out(conn, participant_id)
        _check_question(conn, question_id)
        solutions.get(conn, question_id, solution_id)
        _check_may_attempt(conn, participant_id)
        attempt_id = conn.execute(
            sa.insert(p1_hack_attempt)
            .values(
                participant_id=participant_id,
                question_id=question_id,
                solution_id=solution_id,
                input=test_input,
                state="pending",
            )
            .returning(p1_hack_attempt.c.id)
        ).scalar_one()
    send_one()  # the scheduler sends anything else pending within a second
    return attempt_id


def _check_question(conn: sa.Connection, question_id: int) -> None:
    found = conn.execute(
        sa.select(p1_hack_question.c.id).where(
            p1_hack_question.c.id == question_id,
            p1_hack_question.c.published.is_(True),
        )
    ).first()
    if found is None:
        raise errors.not_found("question")


def _check_may_attempt(conn: sa.Connection, participant_id: str) -> None:
    p = wallet.lock_participant(conn, participant_id)  # serialises this participant's attempts
    if p is None:
        raise errors.forbidden("not a participant")
    if p.disqualified_at:
        raise errors.forbidden("your account is disqualified")
    if p.p1_hacking_finished_at:
        raise errors.conflict("finished", "you have finished this section")
    last = conn.execute(
        sa.select(p1_hack_attempt)
        .where(p1_hack_attempt.c.participant_id == participant_id)
        .order_by(p1_hack_attempt.c.id.desc())
        .limit(1)
    ).one_or_none()
    if last and last.state != "done":
        raise errors.conflict("in_flight", "your previous attempt is still being judged")
    if last and last.ended_at and clock.ms(last.ended_at) + COOLDOWN_MS > clock.now_ms():
        raise errors.conflict("cooldown", "wait a moment before trying again")
