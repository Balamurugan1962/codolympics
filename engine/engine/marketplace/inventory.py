"""What a participant holds, and the event log that makes every action idempotent.

Every purchase or use carries a client request id, unique per actor in
powerup_event. The event row is inserted last in its transaction, so a replay
(double click, retry, refresh) collides there, rolls its whole transaction back,
and the first attempt's result is read back with `event_for` instead of charging
twice.
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import insert as pg_insert

from engine.schema import powerup_event, powerup_inventory


def holdings(conn: sa.Connection, participant_id: str, powerup_id: int | None) -> tuple[int, int]:
    """(how many they hold now, how many they have ever bought)."""
    row = conn.execute(
        sa.select(powerup_inventory.c.quantity, powerup_inventory.c.purchased).where(
            powerup_inventory.c.participant_id == participant_id,
            powerup_inventory.c.powerup_id == powerup_id,
        )
    ).one_or_none()
    if row is None:
        return (0, 0)
    return (row.quantity, row.purchased)


def add_to_inventory(conn: sa.Connection, participant_id: str, powerup_id: int) -> int:
    stmt = pg_insert(powerup_inventory).values(
        participant_id=participant_id, powerup_id=powerup_id, quantity=1, purchased=1
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=["participant_id", "powerup_id"],
        set_={
            "quantity": powerup_inventory.c.quantity + 1,
            "purchased": powerup_inventory.c.purchased + 1,
        },
    ).returning(powerup_inventory.c.quantity)
    return conn.execute(stmt).scalar_one()


def take_one(conn: sa.Connection, participant_id: str, powerup_id: int) -> None:
    conn.execute(
        sa.update(powerup_inventory)
        .where(
            powerup_inventory.c.participant_id == participant_id,
            powerup_inventory.c.powerup_id == powerup_id,
        )
        .values(quantity=powerup_inventory.c.quantity - 1)
    )


def event_for(conn: sa.Connection, actor_id: str, request_id: str) -> sa.Row | None:
    return conn.execute(
        sa.select(powerup_event).where(
            powerup_event.c.actor_id == actor_id, powerup_event.c.request_id == request_id
        )
    ).one_or_none()
