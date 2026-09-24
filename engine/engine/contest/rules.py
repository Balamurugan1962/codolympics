"""The contest row and the phase machine.

    registration -> p1_puzzles (puzzles and hacking together) -> review
                 -> auction1 -> coding1 -> final (the common round) -> ended

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


# Phase 1 is one window: puzzles and hacking are open together under the
# `p1_puzzles` clock, so the separate hacking phase is never entered.
SKIPPED_PHASES = ("p1_hacking", "auction2")


def next_phase(phase: str) -> str | None:
    following = [p for p in PHASES[PHASES.index(phase) + 1 :] if p not in SKIPPED_PHASES]
    return following[0] if following else None


def is_auction(phase: str) -> bool:
    return phase in ("auction1", "auction2")


def is_phase2(phase: str) -> bool:
    return phase in ("auction1", "coding1", "auction2", "final", "ended")


def in_phase2(phase: str) -> bool:
    """Phase 2 while it is still being played.

    Coins and powerups both belong here and nowhere else: in Phase 1 nobody owns
    a question to be blacked out of and there is nothing to spend on, and once
    the contest has ended there is nothing left to buy.
    """
    return is_phase2(phase) and phase != "ended"


def marketplace_closed_reason(c: sa.Row) -> str | None:
    """Why the shop cannot be used right now, as a sentence, or None if it can.

    One gate, so the storefront's explanation and the refusal a buy gets can
    never disagree, and a new way to buy something cannot check only half of it.
    """
    if not in_phase2(c.phase):
        return "The marketplace opens in Phase 2."
    if not c.marketplace_open:
        return "The marketplace is closed."
    return None


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
        "p1_leaderboard_mode": c.p1_leaderboard_mode,
        # Sent rather than worked out from the phase name in the browser: which
        # phases carry coins and a shop is the engine's rule, and a copy of the
        # list in the frontend is a copy that can disagree with the refusals.
        "in_phase2": in_phase2(c.phase),
        # Whether pages must hold full screen while a round runs.
        "proctoring": c.proctoring,
        "server_now": clock.now_ms(),
    }
