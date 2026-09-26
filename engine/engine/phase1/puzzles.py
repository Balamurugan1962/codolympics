"""Phase 1, Section A: logical puzzles, as participants see and answer them.

Answers autosave and can be changed until the section closes. Scoring:
  auto      -> matched against the answer key on save (not shown until close)
  validator -> sent to the judge when the section closes (see validator_jobs)
  manual    -> an evaluator reads it (see grading)

Saving an answer holds the contest row shared, and closing the section takes it
exclusively, so no answer can be saved after the section's answers were sent for
scoring.
"""

from __future__ import annotations

from typing import Any

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import insert as pg_insert

from engine.contest.rules import get_contest, lock_contest
from engine.core import clock, db, errors
from engine.marketplace.blackouts import assert_not_blacked_out
from engine.phase1.answers import normalise_answer, score_auto
from engine.phase1.shuffle import for_participant
from engine.schema import p1_answer, p1_question, participant


def participant_question(q: sa.Row) -> dict[str, Any]:
    """A question with every secret stripped: no answer key, validator or model answer."""
    return {
        "id": q.id,
        "title": q.title,
        "body_md": q.body_md,
        "category": q.category,
        "kind": q.kind,
        "grading": q.grading,
        "points": q.points,
        "explain_points": q.explain_points,
        "order_index": q.order_index,
        "config": q.config,
        "max_entries": q.max_entries,
        "format_regex": q.format_regex,
        "format_hint": q.format_hint,
    }


def published(conn: sa.Connection) -> list[sa.Row]:
    return conn.execute(
        sa.select(p1_question)
        .where(p1_question.c.published.is_(True), p1_question.c.voided.is_(False))
        .order_by(p1_question.c.order_index, p1_question.c.id)
    ).all()


def section_for(participant_id: str) -> dict[str, Any]:
    """Section A as one participant sees it, with their current answers."""
    with db.transaction() as conn:
        c = get_contest(conn)
        if c.phase == "registration":
            raise errors.conflict("not_open", "Phase 1 has not opened")
        questions = for_participant(published(conn), participant_id, "puzzles")
        mine = conn.execute(
            sa.select(p1_answer).where(p1_answer.c.participant_id == participant_id)
        ).all()
    is_open = c.phase == "p1_puzzles" and not (c.phase_ends_at and c.phase_ends_at <= clock.now())
    answers: dict[str, dict[str, Any]] = {}
    for a in mine:
        answers[str(a.question_id)] = {
            "answer": a.answer,
            "explanation": a.explanation,
            "updated_at": clock.iso(a.updated_at),
        }
    return {
        "open": is_open,
        "phase_ends_at": clock.iso(c.phase_ends_at),
        "server_now": clock.now_ms(),
        "questions": [participant_question(q) for q in questions],
        "answers": answers,
    }


def save_answer(
    participant_id: str,
    question_id: int,
    answer: Any = None,
    explanation: str | None = None,
    *,
    has_answer: bool,
) -> None:
    """Save or change an answer.

    Auto-graded kinds are scored now; the score is not shown until close.
    """
    with db.transaction() as conn:
        _check_section_open(conn, participant_id)
        q = conn.execute(
            sa.select(p1_question).where(
                p1_question.c.id == question_id,
                p1_question.c.published.is_(True),
            )
        ).one_or_none()
        if q is None:
            raise errors.not_found("question")
        normalised = None
        auto = None
        if has_answer:
            normalised = normalise_answer(q, answer)
            if q.grading == "auto":
                auto = score_auto(q, normalised)
        changes: dict[str, Any] = {"updated_at": clock.now()}
        if has_answer:
            changes["answer"] = normalised
            changes["auto_score"] = auto
        if explanation is not None:
            changes["explanation"] = explanation
        stmt = pg_insert(p1_answer).values(
            participant_id=participant_id,
            question_id=question_id,
            answer=normalised,
            explanation=explanation,
            auto_score=auto,
            updated_at=clock.now(),
        )
        conn.execute(
            stmt.on_conflict_do_update(
                index_elements=["participant_id", "question_id"],
                set_=changes,
            )
        )


def _check_section_open(conn: sa.Connection, participant_id: str) -> None:
    c = lock_contest(conn)
    if c.phase != "p1_puzzles":
        raise errors.conflict("section_closed", "Phase 1 is not open")
    if c.phase_ends_at and c.phase_ends_at <= clock.now():
        raise errors.conflict("section_closed", "Phase 1 has closed")
    assert_not_blacked_out(conn, participant_id)
    p = conn.execute(
        sa.select(participant).where(participant.c.user_id == participant_id)
    ).one_or_none()
    if p is None:
        raise errors.forbidden("not a participant")
    if p.disqualified_at:
        raise errors.forbidden("your account is disqualified")
    if p.p1_puzzles_finished_at:
        raise errors.conflict("finished", "you have finished Phase 1")


def finish_phase1(participant_id: str) -> None:
    """The explicit finish, for both sections at once: records the time used to break ties."""
    with db.transaction() as conn:
        if lock_contest(conn).phase != "p1_puzzles":
            raise errors.conflict("section_closed", "Phase 1 is not open")
        now = clock.now()
        conn.execute(
            sa.update(participant)
            .where(participant.c.user_id == participant_id)
            .values(p1_puzzles_finished_at=now, p1_hacking_finished_at=now)
        )
