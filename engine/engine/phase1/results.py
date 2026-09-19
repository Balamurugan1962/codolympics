"""Phase 1 results as participants may see them.

The leaderboard honours the organisers' Phase 1 leaderboard setting for participants
(staff always see everything). A participant's own breakdown opens once Section A has
closed, and never includes the answer key.
"""

from __future__ import annotations

from typing import Any

import sqlalchemy as sa

from engine.contest.rules import get_contest
from engine.core import db, errors
from engine.phase1.standings import answer_pending, phase1_standings
from engine.schema import p1_answer, p1_hack_attempt, p1_question


def phase1_leaderboard(role: str) -> dict[str, Any]:
    """Honours the Phase 1 leaderboard setting for participants; staff always see it all."""
    with db.transaction() as conn:
        c = get_contest(conn)
        if role == "participant" and c.p1_leaderboard_mode == "hidden":
            return {"mode": c.p1_leaderboard_mode, "standings": []}
        standings = phase1_standings(conn)
    if role == "participant":
        keep = ("participant_id", "name", "points", "provisional", "rank")
        standings = [{k: s[k] for k in keep} for s in standings]
    return {
        "mode": c.p1_leaderboard_mode,
        "standings": standings,
        "selection_basis": c.p1_selection_basis,
    }


def phase1_results(participant_id: str) -> dict[str, Any]:
    """A participant's own Phase 1 breakdown once Section A has closed. Never the answer key."""
    with db.transaction() as conn:
        if get_contest(conn).phase in ("registration", "p1_puzzles"):
            raise errors.conflict("not_yet", "results are available once Section A closes")
        answers = conn.execute(
            sa.select(
                p1_answer,
                p1_question.c.title,
                p1_question.c.points,
                p1_question.c.explain_points,
                p1_question.c.grading,
                p1_question.c.voided,
            )
            .join(p1_question, p1_question.c.id == p1_answer.c.question_id)
            .where(p1_answer.c.participant_id == participant_id)
        ).all()
        hacks = conn.execute(
            sa.select(p1_hack_attempt).where(p1_hack_attempt.c.participant_id == participant_id)
        ).all()
        mine = None
        for s in phase1_standings(conn):
            if s["participant_id"] == participant_id:
                mine = s
                break
    puzzles = [
        {
            "question_id": a.question_id,
            "title": a.title,
            "points": a.points,
            "explain_points": a.explain_points,
            "grading": a.grading,
            "voided": a.voided,
            "auto_score": a.auto_score,
            "manual_score": a.manual_score,
            "explain_score": a.explain_score,
            "comment": a.grade_comment,
            "pending": answer_pending(a.grading, a.explain_points, a),
        }
        for a in answers
    ]
    hack_results = [
        {
            "question_id": h.question_id,
            "hacked": h.hacked,
            "valid_input": h.valid_input,
            "points_awarded": h.points_awarded,
        }
        for h in hacks
    ]
    return {"standing": mine, "puzzles": puzzles, "hacks": hack_results}
