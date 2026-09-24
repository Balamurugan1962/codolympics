"""The Phase 1 leaderboard: every participant's points across both sections, ranked.

Points are the answer scores on published, unvoided puzzles plus the points awarded
for settled hack attempts on unvoided hack questions. A standing is provisional while
any of its scores is not final yet.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import sqlalchemy as sa

from engine.core import clock, db
from engine.schema import (
    p1_advancement,
    p1_answer,
    p1_hack_attempt,
    p1_hack_question,
    p1_question,
    participant,
    user,
)


def phase1_standings(conn: sa.Connection, with_contact: bool = False) -> list[dict[str, Any]]:
    """Ranked by points, then by the earlier "finish" time -- the rulebook's tiebreak.

    Disqualified participants are listed last and unranked.
    """
    people = conn.execute(
        sa.select(participant, user.c.name).join(user, user.c.id == participant.c.user_id)
    ).all()
    totals = _answer_points(conn)
    for pid, points in _hack_points(conn).items():
        totals.setdefault(pid, [0, False])[0] += points
    advanced = dict(
        conn.execute(sa.select(p1_advancement.c.participant_id, p1_advancement.c.advanced)).all()
    )
    rows: list[dict[str, Any]] = []
    for p in people:
        total = totals.get(p.user_id, [0, False])
        row = _standing(p, total, advanced.get(p.user_id))
        if with_contact:
            row["mobile"] = p.mobile
            row["email"] = p.contact_email
        rows.append(row)
    finished = {p.user_id: _finished_at(p) for p in people}
    # Never pressing finish sorts after everyone who did.
    never_finished = datetime.max.replace(tzinfo=UTC)
    ranked = sorted(
        (r for r in rows if not r["disqualified"]),
        key=lambda r: (
            -r["points"],
            finished[r["participant_id"]] or never_finished,
            r["name"],
        ),
    )
    for i, r in enumerate(ranked, start=1):
        r["rank"] = i
    return ranked + [r for r in rows if r["disqualified"]]


def _answer_points(conn: sa.Connection) -> dict[str, list]:
    """participant -> [points, provisional].

    Provisional while anything is ungraded or a validator failed.
    """
    found = conn.execute(
        sa.select(p1_answer, p1_question.c.grading, p1_question.c.explain_points)
        .join(p1_question, p1_question.c.id == p1_answer.c.question_id)
        .where(p1_question.c.voided.is_(False), p1_question.c.published.is_(True))
    ).all()
    totals: dict[str, list] = {}
    for a in found:
        entry = totals.setdefault(a.participant_id, [0, False])
        entry[0] += (a.auto_score or 0) + (a.manual_score or 0) + (a.explain_score or 0)
        entry[1] = entry[1] or answer_pending(a.grading, a.explain_points, a)
    return totals


def answer_pending(grading: str, explain_points: int, a: sa.Row) -> bool:
    """Whether this answer's score is not final yet."""
    return (
        (grading == "manual" and a.manual_score is None)
        or (explain_points > 0 and a.explain_score is None)
        or (grading == "validator" and a.score_state == "error")
    )


def _hack_points(conn: sa.Connection) -> dict[str, int]:
    return dict(
        conn.execute(
            sa.select(
                p1_hack_attempt.c.participant_id,
                sa.func.sum(p1_hack_attempt.c.points_awarded),
            )
            .join(p1_hack_question, p1_hack_question.c.id == p1_hack_attempt.c.question_id)
            .where(p1_hack_question.c.voided.is_(False), p1_hack_attempt.c.state == "done")
            .group_by(p1_hack_attempt.c.participant_id)
        ).all()
    )


def _finished_at(p: sa.Row) -> datetime | None:
    """The later of the two "finish" presses: the Phase 1 submission time."""
    finished = [t for t in (p.p1_puzzles_finished_at, p.p1_hacking_finished_at) if t]
    return max(finished) if finished else None


def _standing(p: sa.Row, total: list, advanced: bool | None) -> dict[str, Any]:
    return {
        "participant_id": p.user_id,
        "name": p.name,
        "points": int(total[0]),
        "provisional": bool(total[1]),
        "submitted_at": clock.iso(_finished_at(p)),
        "disqualified": p.disqualified_at is not None,
        "advanced": advanced,
        "rank": 0,
    }


def standings() -> list[dict[str, Any]]:
    with db.transaction() as conn:
        return phase1_standings(conn)
