"""Blackout state for one participant, and the gate that refuses actions during one.

Expiry is a comparison with now, never a job that has to run. Blackouts stack end
to end, so the last one to end says when the participant is free again.
"""

from __future__ import annotations

import math
from typing import Any

import sqlalchemy as sa

from engine.contest.rules import get_contest
from engine.core import clock, db, errors
from engine.schema import blackout, user


def _active_blackouts(conn: sa.Connection, participant_id: str) -> list[sa.Row]:
    """Blackouts still running on this participant, oldest first."""
    # Once the contest is over, a blackout means nothing.
    if get_contest(conn).phase == "ended":
        return []
    return conn.execute(
        sa.select(blackout.c.ends_at, user.c.name)
        .join(user, user.c.id == blackout.c.by_id)
        .where(blackout.c.participant_id == participant_id, blackout.c.ends_at > clock.now())
        .order_by(blackout.c.ends_at)
    ).all()


def blackout_state(conn: sa.Connection, participant_id: str) -> dict[str, Any]:
    active = _active_blackouts(conn, participant_id)
    return {
        "active": bool(active),
        "ends_at": clock.iso(active[-1].ends_at) if active else None,
        "count": len(active),
        "by": [r.name or "someone" for r in active],
        "server_now": clock.now_ms(),
    }


def assert_not_blacked_out(conn: sa.Connection, participant_id: str) -> None:
    """The gate every contest action passes through, inside the action itself."""
    active = _active_blackouts(conn, participant_id)
    if not active:
        return
    left = math.ceil((active[-1].ends_at - clock.now()).total_seconds())
    if left == 1:
        unit = "second"
    else:
        unit = "seconds"
    raise errors.conflict("blacked_out", f"you are blacked out for another {left} {unit}")


def blackout_for(participant_id: str) -> dict[str, Any]:
    with db.transaction() as conn:
        return blackout_state(conn, participant_id)
