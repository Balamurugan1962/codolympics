"""The contest row and the phase machine.

    registration -> p1_puzzles -> p1_hacking -> review
                 -> auction1 -> coding1 -> auction2 -> final -> ended

The contest row is also the lock that keeps phase changes and participant
actions from interleaving. An action whose legality depends on the phase or a
contest setting reads the row with `lock_contest(conn)` (FOR SHARE): many such
actions run side by side, but a phase change or a settings change, which takes
it FOR UPDATE, waits for them to finish -- and they in turn see the new phase
if it committed first. So "Section A closed" and "an answer was saved" can never
both be true of the same instant.
"""

from __future__ import annotations

from typing import Any

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import insert as pg_insert

from engine.core import clock, db
from engine.schema import PHASES, contest


def ensure_contest_row() -> None:
    with db.transaction() as conn:
        conn.execute(pg_insert(contest).values(id=1).on_conflict_do_nothing())


def get_contest(conn: sa.Connection) -> sa.Row:
    return conn.execute(sa.select(contest).where(contest.c.id == 1)).one()


def lock_contest(conn: sa.Connection, *, exclusive: bool = False) -> sa.Row:
    """Read the contest row and hold it: shared for actions, exclusive for changes to it."""
    query = sa.select(contest).where(contest.c.id == 1)
    query = query.with_for_update() if exclusive else query.with_for_update(read=True)
    return conn.execute(query).one()


def next_phase(phase: str) -> str | None:
    i = PHASES.index(phase)
    return PHASES[i + 1] if i < len(PHASES) - 1 else None


def is_auction(phase: str) -> bool:
    return phase in ("auction1", "auction2")


def is_phase2(phase: str) -> bool:
    return phase in ("auction1", "coding1", "auction2", "final", "ended")


def auction_round(phase: str) -> int:
    """Which auction round a phase belongs to; round 2 from auction2 on."""
    return 2 if phase == "auction2" else 1


def active_round(phase: str) -> int | None:
    return {"auction1": 1, "auction2": 2}.get(phase)


def phase_duration_minutes(c: sa.Row, phase: str) -> int | None:
    return {
        "p1_puzzles": c.p1_puzzles_minutes,
        "p1_hacking": c.p1_hacking_minutes,
        "coding1": c.coding1_minutes,
        "final": c.final_minutes,
    }.get(phase)


def phase_snapshot(c: sa.Row) -> dict[str, Any]:
    """What a client needs about the phase, with server_now for its clock offset."""
    return {
        "phase": c.phase,
        "phase_ends_at": clock.iso(c.phase_ends_at),
        "registration_open": c.registration_open,
        "leaderboard_mode": c.leaderboard_mode,
        "server_now": clock.now_ms(),
    }
