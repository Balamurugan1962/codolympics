"""Everything one participant did, across both phases, in one place -- for staff.

Built for the question an organiser actually gets asked: "what happened to me?"
It carries answer keys, hack verdicts and jury detail, so it is never reachable
from a participant-facing route.
"""

from __future__ import annotations

from typing import Any

import sqlalchemy as sa

from engine.coding.scoring import phase2_standings
from engine.core import clock, db, errors
from engine.phase1.standings import answer_pending, phase1_standings
from engine.schema import (
    hint,
    hint_purchase,
    judgement,
    ledger,
    ownership,
    p1_advancement,
    p1_answer,
    p1_hack_attempt,
    p1_hack_question,
    p1_hack_solution,
    p1_question,
    participant,
    question,
    submission,
    user,
)


def dossier(participant_id: str) -> dict[str, Any]:
    with db.transaction() as conn:
        who = conn.execute(
            sa.select(participant, user.c.name, user.c.username, user.c.created_at)
            .join(user, user.c.id == participant.c.user_id)
            .where(participant.c.user_id == participant_id)
        ).one_or_none()
        if who is None:
            raise errors.not_found("participant")
        adv = conn.execute(
            sa.select(p1_advancement).where(p1_advancement.c.participant_id == participant_id)
        ).one_or_none()
        p1_all = phase1_standings(conn)
        p2_all = phase2_standings(conn)
        p1_mine = next((s for s in p1_all if s["participant_id"] == participant_id), None)
        p2_mine = next((s for s in p2_all if s["participant_id"] == participant_id), None)
        return {
            "participant": _who(who, adv),
            "phase1": {
                "standing": p1_mine,
                "of": sum(1 for s in p1_all if not s["disqualified"]),
                "puzzles": _puzzle_rows(conn, participant_id),
                "hacks": _hack_rows(conn, participant_id),
            },
            "phase2": {
                "standing": p2_mine,
                "of": len(p2_all),
                "owned": _owned_rows(conn, participant_id),
                "ledger": _ledger_rows(conn, participant_id),
            },
        }


def _who(who: sa.Row, adv: sa.Row | None) -> dict[str, Any]:
    return {
        "id": who.user_id,
        "name": who.name,
        "username": who.username,
        "balance": who.balance,
        "preferred_language": who.preferred_language,
        "disqualified": who.disqualified_at is not None,
        "disqualified_reason": who.disqualified_reason,
        "registered_at": clock.iso(who.created_at),
        "p1_puzzles_finished_at": clock.iso(who.p1_puzzles_finished_at),
        "p1_hacking_finished_at": clock.iso(who.p1_hacking_finished_at),
        "advanced": adv.advanced if adv else None,
        "advancement_reason": adv.reason if adv else None,
    }


def _puzzle_rows(conn: sa.Connection, participant_id: str) -> list[dict[str, Any]]:
    """Every published puzzle, answered or not -- a blank is a fact worth seeing."""
    found = conn.execute(
        sa.select(
            p1_question,
            p1_answer.c.participant_id.label("answered_by"),
            p1_answer.c.answer,
            p1_answer.c.explanation,
            p1_answer.c.auto_score,
            p1_answer.c.manual_score,
            p1_answer.c.explain_score,
            p1_answer.c.score_state,
            p1_answer.c.score_error,
            p1_answer.c.graded_at,
            p1_answer.c.grade_comment,
            p1_answer.c.updated_at,
        )
        .outerjoin(
            p1_answer,
            sa.and_(
                p1_answer.c.question_id == p1_question.c.id,
                p1_answer.c.participant_id == participant_id,
            ),
        )
        .where(p1_question.c.published.is_(True))
        .order_by(p1_question.c.order_index, p1_question.c.id)
    ).all()
    return [_puzzle_row(r) for r in found]


def _puzzle_row(r: sa.Row) -> dict[str, Any]:
    answered = r.answered_by is not None
    pending = answered and answer_pending(r.grading, r.explain_points, r)
    if not answered:
        awarded = 0
    elif pending:
        awarded = None
    else:
        awarded = (r.auto_score or 0) + (r.manual_score or 0) + (r.explain_score or 0)
    return {
        "question_id": r.id,
        "title": r.title,
        "category": r.category,
        "kind": r.kind,
        "grading": r.grading,
        "points_possible": r.points,
        "explain_possible": r.explain_points,
        "answered": answered,
        "answer": r.answer,
        "explanation": r.explanation,
        "auto_score": r.auto_score,
        "manual_score": r.manual_score,
        "explain_score": r.explain_score,
        "score_state": r.score_state,
        "score_error": r.score_error,
        "graded_at": clock.iso(r.graded_at),
        "grade_comment": r.grade_comment,
        "updated_at": clock.iso(r.updated_at),
        "awarded": awarded,
    }


def _hack_rows(conn: sa.Connection, participant_id: str) -> list[dict[str, Any]]:
    questions = conn.execute(
        sa.select(p1_hack_question)
        .where(p1_hack_question.c.published.is_(True))
        .order_by(p1_hack_question.c.order_index, p1_hack_question.c.id)
    ).all()
    attempts = conn.execute(
        sa.select(p1_hack_attempt)
        .where(p1_hack_attempt.c.participant_id == participant_id)
        .order_by(p1_hack_attempt.c.created_at)
    ).all()
    out = []
    for q in questions:
        mine = [a for a in attempts if a.question_id == q.id]
        out.append(_hack_row(q, mine))
    return out


def _hack_row(q: sa.Row, mine: list[sa.Row]) -> dict[str, Any]:
    return {
        "question_id": q.id,
        "title": q.title,
        "points_possible": q.hack_points,
        "fail_penalty": q.fail_penalty,
        "attempts": [
            {
                "id": a.id,
                "input": a.input,
                "state": a.state,
                "valid_input": a.valid_input,
                "invalid_reason": a.invalid_reason,
                "hacked": a.hacked,
                "verdict": a.verdict,
                "points_awarded": a.points_awarded,
                "created_at": clock.iso(a.created_at),
            }
            for a in mine
        ],
        "awarded": sum(a.points_awarded for a in mine if a.state == "done"),
    }


def _owned_rows(conn: sa.Connection, participant_id: str) -> list[dict[str, Any]]:
    """Questions won, with every submission and hint against each."""
    owned = conn.execute(
        sa.select(
            ownership, question.c.title, question.c.difficulty, question.c.score, question.c.status
        )
        .join(question, question.c.id == ownership.c.question_id)
        .where(ownership.c.participant_id == participant_id)
        .order_by(ownership.c.awarded_at)
    ).all()
    subs = conn.execute(
        sa.select(
            submission.c.id,
            submission.c.question_id,
            submission.c.language,
            submission.c.created_at,
            judgement.c.state,
            judgement.c.verdict,
            judgement.c.passed,
            judgement.c.total,
            judgement.c.first_fail,
            judgement.c.max_time_ms,
            judgement.c.message,
            judgement.c.jury_detail,
            judgement.c.attempt,
        )
        .outerjoin(
            judgement,
            sa.and_(
                judgement.c.submission_id == submission.c.id, judgement.c.superseded_at.is_(None)
            ),
        )
        .where(submission.c.participant_id == participant_id)
        .order_by(submission.c.created_at.desc())
    ).all()
    hints = conn.execute(
        sa.select(hint_purchase, hint.c.body_md)
        .outerjoin(
            hint,
            sa.and_(
                hint.c.question_id == hint_purchase.c.question_id,
                hint.c.idx == hint_purchase.c.hint_idx,
            ),
        )
        .where(hint_purchase.c.participant_id == participant_id)
        .order_by(hint_purchase.c.hint_idx)
    ).all()
    out = []
    for o in owned:
        mine = [s for s in subs if s.question_id == o.question_id]
        bought = [h for h in hints if h.question_id == o.question_id]
        out.append(_owned_row(o, mine, bought))
    return out


def _owned_row(o: sa.Row, mine: list[sa.Row], hints: list[sa.Row]) -> dict[str, Any]:
    # The earliest accepted submission is the solve; later ones do not improve it.
    accepted_subs = (s for s in mine if s.verdict == "AC")
    accepted = min(accepted_subs, key=lambda s: s.created_at, default=None)
    solved_at = None
    solve_ms = None
    if accepted:
        solved_at = clock.iso(accepted.created_at)
        solve_ms = clock.ms(accepted.created_at) - clock.ms(o.awarded_at)
    return {
        "question_id": o.question_id,
        "title": o.title,
        "difficulty": o.difficulty,
        "score": o.score,
        "price_paid": o.price_paid,
        "awarded_at": clock.iso(o.awarded_at),
        "voided_at": clock.iso(o.voided_at),
        "status": o.status,
        "solved_at": solved_at,
        "solve_ms": solve_ms,
        "attempts": len(mine),
        "hints_bought": [
            {
                "idx": h.hint_idx,
                "price_paid": h.price_paid,
                "purchased_at": clock.iso(h.purchased_at),
                "body_md": h.body_md or "",
            }
            for h in hints
        ],
        "submissions": [
            {
                "id": s.id,
                "language": s.language,
                "created_at": clock.iso(s.created_at),
                "state": s.state or "pending",
                "verdict": s.verdict,
                "passed": s.passed,
                "total": s.total,
                "first_fail": s.first_fail,
                "max_time_ms": s.max_time_ms,
                "message": s.message,
                "jury_detail": s.jury_detail,
                "attempt": s.attempt or 1,
            }
            for s in mine
        ],
    }


def _ledger_rows(conn: sa.Connection, participant_id: str) -> list[dict[str, Any]]:
    found = conn.execute(
        sa.select(ledger)
        .where(ledger.c.participant_id == participant_id)
        .order_by(ledger.c.id.desc())
    ).all()
    return [
        {
            "id": entry.id,
            "delta": entry.delta,
            "balance_after": entry.balance_after,
            "reason": entry.reason,
            "ref": entry.ref,
            "created_at": clock.iso(entry.created_at),
        }
        for entry in found
    ]


# --- one question for one participant, in full ---------------------------


def owned_question(participant_id: str, question_id: str) -> dict[str, Any]:
    """Everything they did on one question they own: the hints, in the order
    bought, and every submission with the code itself. The page for a dispute
    about one question, so nothing is summarised away."""
    with db.transaction() as conn:
        who = _named(conn, participant_id)
        o = conn.execute(
            sa.select(
                ownership,
                question.c.title,
                question.c.difficulty,
                question.c.score,
                question.c.status,
                question.c.topic,
            )
            .join(question, question.c.id == ownership.c.question_id)
            .where(
                ownership.c.participant_id == participant_id,
                ownership.c.question_id == question_id,
            )
            .order_by(ownership.c.awarded_at.desc())
        ).first()
        if o is None:
            raise errors.not_found("question")
        subs = conn.execute(
            sa.select(
                submission.c.id,
                submission.c.question_id,
                submission.c.language,
                submission.c.source,
                submission.c.created_at,
                judgement.c.state,
                judgement.c.verdict,
                judgement.c.passed,
                judgement.c.total,
                judgement.c.first_fail,
                judgement.c.max_time_ms,
                judgement.c.max_memory_kb,
                judgement.c.compile_output,
                judgement.c.message,
                judgement.c.jury_detail,
                judgement.c.attempt,
                judgement.c.cancelled,
                judgement.c.ended_at,
            )
            .outerjoin(
                judgement,
                sa.and_(
                    judgement.c.submission_id == submission.c.id,
                    judgement.c.superseded_at.is_(None),
                ),
            )
            .where(
                submission.c.participant_id == participant_id,
                submission.c.question_id == question_id,
            )
            .order_by(submission.c.created_at.desc())
        ).all()
        hints = conn.execute(
            sa.select(hint_purchase, hint.c.body_md)
            .outerjoin(
                hint,
                sa.and_(
                    hint.c.question_id == hint_purchase.c.question_id,
                    hint.c.idx == hint_purchase.c.hint_idx,
                ),
            )
            .where(
                hint_purchase.c.participant_id == participant_id,
                hint_purchase.c.question_id == question_id,
            )
            .order_by(hint_purchase.c.purchased_at)
        ).all()
    row = _owned_row(o, subs, hints)
    row["topic"] = o.topic
    for full, s in zip(row["submissions"], subs, strict=True):
        full.update(
            source=s.source,
            max_memory_kb=s.max_memory_kb,
            compile_output=s.compile_output,
            cancelled=bool(s.cancelled),
            ended_at=clock.iso(s.ended_at),
        )
    return {"participant": who, "question": row}


def hack_question(participant_id: str, question_id: int) -> dict[str, Any]:
    """Every input they sent against one hacking question, with the code they were reading."""
    with db.transaction() as conn:
        who = _named(conn, participant_id)
        q = conn.execute(
            sa.select(p1_hack_question).where(p1_hack_question.c.id == question_id)
        ).one_or_none()
        if q is None:
            raise errors.not_found("question")
        mine = conn.execute(
            sa.select(p1_hack_attempt)
            .where(
                p1_hack_attempt.c.participant_id == participant_id,
                p1_hack_attempt.c.question_id == question_id,
            )
            .order_by(p1_hack_attempt.c.created_at)
        ).all()
        copies = conn.execute(
            sa.select(p1_hack_solution)
            .where(p1_hack_solution.c.question_id == question_id)
            .order_by(p1_hack_solution.c.order_index, p1_hack_solution.c.id)
        ).all()
    row = _hack_row(q, mine)
    row["problem_id"] = q.problem_id
    row["statement_md"] = q.statement_md
    row["constraints_md"] = q.constraints_md
    row["solutions"] = [{"id": c.id, "language": c.language, "source": c.source} for c in copies]
    for full, a in zip(row["attempts"], mine, strict=True):
        full.update(solution_id=a.solution_id, ended_at=clock.iso(a.ended_at))
    return {"participant": who, "question": row}


def _named(conn: sa.Connection, participant_id: str) -> dict[str, Any]:
    who = conn.execute(
        sa.select(user.c.id, user.c.name, user.c.username)
        .join(participant, participant.c.user_id == user.c.id)
        .where(user.c.id == participant_id)
    ).one_or_none()
    if who is None:
        raise errors.not_found("participant")
    return {"id": who.id, "name": who.name, "username": who.username}
