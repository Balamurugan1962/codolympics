"""The end of Phase 1: choosing who advances to Phase 2, and disqualifying participants.

Both actions are audited and tell the affected participants by notification.
"""

from __future__ import annotations

from typing import Any

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import insert as pg_insert

from engine.core import clock, db, events
from engine.core.audit import audit
from engine.schema import p1_advancement, participant


def set_advancement(actor_id: str, participant_ids: list[str], reason: str) -> None:
    """Select who advances to Phase 2. The whole set each time; revisable until Phase 2 opens."""
    chosen = set(participant_ids)
    with db.transaction() as conn:
        everyone = conn.execute(sa.select(participant.c.user_id)).scalars().all()
        for pid in everyone:
            values = {
                "advanced": pid in chosen,
                "decided_by": actor_id,
                "decided_at": clock.now(),
                "reason": reason,
            }
            stmt = pg_insert(p1_advancement).values(participant_id=pid, **values)
            conn.execute(stmt.on_conflict_do_update(index_elements=["participant_id"], set_=values))
        audit(
            conn,
            actor_id=actor_id,
            action="p1.advance",
            reason=reason,
            detail={"advanced": sorted(chosen)},
        )
    for pid in everyone:
        if pid in chosen:
            body = "You have been selected to advance to Phase 2."
        else:
            body = "You were not selected for Phase 2. Thank you for taking part."
        events.publish("notify", {"body": body}, pid)


def has_advanced(conn: sa.Connection, participant_id: str) -> bool:
    return bool(
        conn.execute(
            sa.select(p1_advancement.c.advanced).where(
                p1_advancement.c.participant_id == participant_id
            )
        ).scalar()
    )


def disqualify(actor_id: str, participant_id: str, reason: str, undo: bool = False) -> None:
    """Reversible. Answers and submissions are kept either way."""
    values: dict[str, Any]
    if undo:
        values = {"disqualified_at": None, "disqualified_reason": None}
    else:
        values = {"disqualified_at": clock.now(), "disqualified_reason": reason}
    with db.transaction() as conn:
        conn.execute(
            sa.update(participant).where(participant.c.user_id == participant_id).values(**values)
        )
        action = "participant.requalify" if undo else "participant.disqualify"
        audit(conn, actor_id=actor_id, action=action, target=participant_id, reason=reason)
    events.publish("leaderboard")
    if undo:
        body = "Your disqualification has been reversed."
    else:
        body = f"You have been disqualified: {reason}"
    events.publish("notify", {"body": body}, participant_id)
