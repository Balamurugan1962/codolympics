"""Shields: one up at a time, for a while, with the rest waiting their turn.

A shield covers a window, the way a blackout fills one. Buying one puts it in
the queue (the inventory row); if nothing is up it starts at once. The shield
that is up ends when its time runs out or when it absorbs a blackout, and at
that moment the next in the queue starts. Nothing is switched on by hand. An
organiser may give shields no time limit (a duration of -1): then one stays
up until it absorbs an attack.

Expiry is a comparison with now, so state reads are always right. The queue
advancing is not: when a shield runs out unattacked, the next one has to be
started by somebody, and that is `settle`, run under the holder's row lock by
whatever needs the answer (a purchase, an attack landing) and by the scheduler
every second, so the change reaches the holder's screen without them doing
anything. A state read never starts one: unlocked, it could race the
scheduler into starting two.
"""

from __future__ import annotations

from datetime import timedelta
from typing import Any

import sqlalchemy as sa

from engine.accounts import wallet
from engine.contest.rules import get_contest
from engine.core import clock, db, events
from engine.marketplace.inventory import take_one
from engine.schema import powerup, powerup_inventory, shield

UNTIL_ABSORBED = -1


def _still_up() -> sa.ColumnElement[bool]:
    return sa.and_(
        shield.c.absorbed_at.is_(None),
        sa.or_(shield.c.ends_at.is_(None), shield.c.ends_at > clock.now()),
    )


def _up(conn: sa.Connection, participant_id: str) -> sa.Row | None:
    """The shield that is up right now, if any."""
    return conn.execute(
        sa.select(shield)
        .where(shield.c.participant_id == participant_id, _still_up())
        .order_by(shield.c.id.desc())
        .limit(1)
    ).one_or_none()


def _queued(conn: sa.Connection, participant_id: str) -> list[sa.Row]:
    """Shields waiting in the inventory, cheapest powerup id first."""
    return conn.execute(
        sa.select(
            powerup_inventory.c.powerup_id,
            powerup_inventory.c.quantity,
            powerup.c.duration_seconds,
            powerup.c.name,
        )
        .join(powerup, powerup.c.id == powerup_inventory.c.powerup_id)
        .where(
            powerup_inventory.c.participant_id == participant_id,
            powerup.c.kind == "shield",
            powerup_inventory.c.quantity > 0,
        )
        .order_by(powerup_inventory.c.powerup_id)
    ).all()


def settle(conn: sa.Connection, participant_id: str) -> sa.Row | None:
    """Start the next shield if none is up and one is waiting. Returns the one up.

    The caller holds the participant's row lock.
    """
    up = _up(conn, participant_id)
    if up is not None:
        return up
    for waiting in _queued(conn, participant_id):
        seconds = waiting.duration_seconds or 0
        if seconds <= 0 and seconds != UNTIL_ABSORBED:
            continue  # an organiser cleared the duration; it waits until one is set
        take_one(conn, participant_id, waiting.powerup_id)
        now = clock.now()
        row = conn.execute(
            sa.insert(shield)
            .values(
                participant_id=participant_id,
                powerup_id=waiting.powerup_id,
                seconds=seconds,
                starts_at=now,
                ends_at=None if seconds == UNTIL_ABSORBED else now + timedelta(seconds=seconds),
            )
            .returning(shield)
        ).one()
        return row
    return None


def absorb(conn: sa.Connection, target_id: str, attacker_id: str) -> sa.Row | None:
    """Spend the shield that is up on an attack. Returns it, or None if nothing was up.

    The next one in the queue starts in the same transaction, so there is no
    moment between two shields in which a second attack could land.
    """
    up = settle(conn, target_id)
    if up is None:
        return None
    conn.execute(
        sa.update(shield)
        .where(shield.c.id == up.id)
        .values(absorbed_at=clock.now(), absorbed_by=attacker_id)
    )
    settle(conn, target_id)
    return up


def shield_state(conn: sa.Connection, participant_id: str) -> dict[str, Any]:
    """What the holder sees next to the clock: the one up, and how many wait.

    `ends_at` is null for a shield that stays up until it absorbs an attack.
    """
    if get_contest(conn).phase == "ended":
        return {"active": False, "ends_at": None, "queued": 0, "server_now": clock.now_ms()}
    up = _up(conn, participant_id)
    queued = sum(r.quantity for r in _queued(conn, participant_id))
    return {
        "active": up is not None,
        "ends_at": clock.iso(up.ends_at) if up and up.ends_at else None,
        "queued": queued,
        "server_now": clock.now_ms(),
    }


def shielded_now(conn: sa.Connection) -> set[str]:
    """Everyone with a shield up, for the attacker's list of targets."""
    return set(conn.execute(sa.select(shield.c.participant_id).where(_still_up())).scalars())


def tick() -> None:
    """Start the next shield for anyone whose last one ran out with more waiting.

    Only the holders whose queue advanced are told; a shield that ran out with
    nothing behind it needs no event, because its end time was already on
    their screen.
    """
    with db.transaction() as conn:
        waiting = set(
            conn.execute(
                sa.select(powerup_inventory.c.participant_id)
                .join(powerup, powerup.c.id == powerup_inventory.c.powerup_id)
                .where(powerup.c.kind == "shield", powerup_inventory.c.quantity > 0)
            ).scalars()
        )
        started = []
        for pid in waiting - shielded_now(conn):
            wallet.lock_participant(conn, pid)
            if settle(conn, pid) is not None:
                started.append(pid)
    for pid in started:
        events.publish("powerup", {"shield": "started"}, pid)
