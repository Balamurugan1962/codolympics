"""The shield that follows a blackout: nobody can be attacked again straight after one ends.

A blackout that lands ends at some moment; from then until `attack_cooldown_seconds`
later its target cannot be attacked, and the attack is cancelled before anything is
spent. Attacks that arrive while the blackout is still running stack as they always
have, and the cooldown starts when the last of them ends. A blackout a shield
absorbed never landed, so it starts nothing. Expiry is a comparison with now.
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta
from typing import Any

import sqlalchemy as sa

from engine.contest.rules import get_contest
from engine.core import clock, errors
from engine.schema import blackout


def _window(conn: sa.Connection, seconds: int, target_id: str) -> tuple[datetime, datetime] | None:
    """When this person is protected: from the end of their last blackout, for `seconds`."""
    if seconds <= 0:
        return None
    last = conn.execute(
        sa.select(sa.func.max(blackout.c.ends_at)).where(blackout.c.participant_id == target_id)
    ).scalar()
    if last is None:
        return None
    ends = last + timedelta(seconds=seconds)
    return (last, ends) if last <= clock.now() < ends else None


def cooldown_state(conn: sa.Connection, participant_id: str) -> dict[str, Any]:
    """What the person sees beside the clock: whether they are protected, and until when."""
    c = get_contest(conn)
    window = (
        None if c.phase == "ended" else _window(conn, c.attack_cooldown_seconds, participant_id)
    )
    return {
        "active": window is not None,
        "ends_at": clock.iso(window[1]) if window else None,
        "server_now": clock.now_ms(),
    }


def cooling_now(conn: sa.Connection) -> dict[str, str]:
    """Everyone protected right now, with when it ends, for the attacker's list of targets."""
    c = get_contest(conn)
    if c.attack_cooldown_seconds <= 0 or c.phase == "ended":
        return {}
    latest = conn.execute(
        sa.select(blackout.c.participant_id, sa.func.max(blackout.c.ends_at)).group_by(
            blackout.c.participant_id
        )
    ).all()
    now = clock.now()
    ends = {pid: end + timedelta(seconds=c.attack_cooldown_seconds) for pid, end in latest}
    return {
        pid: clock.iso(until)
        for pid, until in ends.items()
        if until > now and until - timedelta(seconds=c.attack_cooldown_seconds) <= now
    }


def assert_attackable(
    conn: sa.Connection, c: sa.Row, target_id: str, target_name: str | None
) -> None:
    """Cancel an attack on someone in their cooldown. Nothing has been spent yet."""
    window = _window(conn, c.attack_cooldown_seconds, target_id)
    if window is None:
        return
    left = math.ceil((window[1] - clock.now()).total_seconds())
    who = target_name or "They"
    unit = "second" if left == 1 else "seconds"
    raise errors.conflict(
        "attack_cancelled",
        f"Attack cancelled: {who} is protected for another {left} {unit} after a blackout",
    )
