"""Phase 2 standings -- computed on every read, never stored.

    score      = sum of question.score over questions the owner has a current AC on
    solve_time = earliest AC submission time - awarded_at   ("first AC only counts")
    rank       = score DESC, total time ASC, Phase 1 rank ASC

Because nothing is stored, a rejudge, a void or a take-back changes the
standings with nothing to recompute and no row that can go stale. There is no
leaderboard state to race over: concurrent readers just compute the same answer.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

import sqlalchemy as sa

from engine.contest.rules import get_contest
from engine.core import clock, db
from engine.phase1.standings import phase1_standings
from engine.schema import judgement, ownership, participant, question, submission, user


def phase2_standings(
    conn: sa.Connection, frozen_at: datetime | None = None
) -> list[dict[str, Any]]:
    people = conn.execute(
        sa.select(participant.c.user_id, user.c.name)
        .join(user, user.c.id == participant.c.user_id)
        .where(participant.c.disqualified_at.is_(None))
    ).all()
    first_solves = _first_solves(conn, frozen_at)
    p1_rank = {s["participant_id"]: s["rank"] for s in phase1_standings(conn)}
    rows: list[dict[str, Any]] = []
    for p in people:
        solves = first_solves.get(p.user_id, [])
        rows.append(_standing(p, solves, p1_rank.get(p.user_id)))
    rows.sort(
        key=lambda r: (
            -r["score"],
            r["total_time_ms"],
            r["phase1_rank"] if r["phase1_rank"] is not None else float("inf"),
            r["name"],
        )
    )
    _assign_ranks(rows)
    return rows


def _first_solves(
    conn: sa.Connection, frozen_at: datetime | None
) -> dict[str, list[tuple[int, int]]]:
    """Per participant, one (score, solve_ms) per question: their earliest current AC on it."""
    query = (
        sa.select(
            submission.c.participant_id,
            submission.c.question_id,
            submission.c.created_at,
            question.c.score,
            ownership.c.awarded_at,
        )
        .join(submission, submission.c.id == judgement.c.submission_id)
        .join(question, question.c.id == submission.c.question_id)
        .join(
            ownership,
            sa.and_(
                ownership.c.question_id == submission.c.question_id,
                ownership.c.participant_id == submission.c.participant_id,
            ),
        )
        .where(
            judgement.c.verdict == "AC",
            judgement.c.superseded_at.is_(None),
            ownership.c.voided_at.is_(None),
            question.c.status != "void",
        )
    )
    if frozen_at is not None:
        query = query.where(submission.c.created_at < frozen_at)
    best: dict[tuple[str, str], tuple[int, int]] = {}
    for ac in conn.execute(query):
        solve_ms = clock.ms(ac.created_at) - clock.ms(ac.awarded_at)
        key = (ac.participant_id, ac.question_id)
        if key not in best or solve_ms < best[key][1]:
            best[key] = (ac.score, solve_ms)
    out: dict[str, list[tuple[int, int]]] = {}
    for (pid, _), solve in best.items():
        out.setdefault(pid, []).append(solve)
    return out


def _standing(p: sa.Row, solves: list[tuple[int, int]], p1_rank: int | None) -> dict[str, Any]:
    return {
        "participant_id": p.user_id,
        "name": p.name,
        "score": sum(score for score, _ in solves),
        "solved": len(solves),
        "total_time_ms": sum(ms for _, ms in solves),
        "phase1_rank": p1_rank,
        "rank": 0,
    }


def _assign_ranks(rows: list[dict[str, Any]]) -> None:
    """A shared rank only when everything that breaks ties is equal."""
    tie_keys = ("score", "total_time_ms", "phase1_rank")
    for i, r in enumerate(rows):
        prev = rows[i - 1] if i else None
        if prev and all(prev[k] == r[k] for k in tie_keys):
            r["rank"] = prev["rank"]
        else:
            r["rank"] = i + 1


def frozen_at(c: sa.Row) -> datetime | None:
    return c.leaderboard_frozen_at if c.leaderboard_mode == "frozen" else None


def for_participants() -> dict[str, Any]:
    """The leaderboard as participants may see it, honouring the organisers' setting."""
    with db.transaction() as conn:
        c = get_contest(conn)
        if c.leaderboard_mode == "hidden":
            return {"mode": "hidden", "standings": [], "frozen_at": None}
        return {
            "mode": c.leaderboard_mode,
            "standings": phase2_standings(conn, frozen_at(c)),
            "frozen_at": clock.iso(frozen_at(c)),
        }


def for_staff() -> dict[str, Any]:
    """Both boards in full, ignoring the hidden/frozen setting."""
    with db.transaction() as conn:
        return {
            "phase1": phase1_standings(conn, with_contact=True),
            "phase2": phase2_standings(conn),
        }
