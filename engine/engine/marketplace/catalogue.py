"""What is on sale: the powerup rows an organiser edits, their log, and the defaults."""

from __future__ import annotations

from typing import Any

import sqlalchemy as sa

from engine.core import clock, db, errors
from engine.core.audit import audit
from engine.core.serialize import camel_row
from engine.schema import powerup, powerup_event, user


def catalogue() -> list[sa.Row]:
    ensure_powerups()
    in_order = sa.select(powerup).order_by(powerup.c.sort_order, powerup.c.id)
    with db.transaction() as conn:
        return conn.execute(in_order).all()


def catalogue_rows() -> list[dict[str, Any]]:
    """The catalogue as whole rows, for the organisers' editor."""
    return [camel_row(item._mapping) for item in catalogue()]


EDITABLE = (
    "name",
    "description",
    "price",
    "duration_seconds",
    "enabled",
    "max_held",
    "max_purchases",
    "usable_phases",
)


def save(actor_id: str, powerup_id: int, patch: dict[str, Any], reason: str) -> None:
    """Edit a powerup. A blackout already running keeps the end time it landed with."""
    clean = {k: v for k, v in patch.items() if k in EDITABLE}
    if not clean:
        raise errors.invalid("nothing to change")
    with db.transaction() as conn:
        before = conn.execute(
            sa.select(powerup).where(powerup.c.id == powerup_id).with_for_update()
        ).one_or_none()
        if before is None:
            raise errors.not_found("powerup")
        clears_duration = "duration_seconds" in clean and not clean["duration_seconds"]
        if before.kind == "blackout" and clears_duration:
            raise errors.invalid("a blackout needs a duration")
        conn.execute(sa.update(powerup).where(powerup.c.id == powerup_id).values(**clean))
        audit(
            conn,
            actor_id=actor_id,
            action="powerup.update",
            target=str(powerup_id),
            reason=reason,
            detail={"name": before.name, **clean},
        )


def log(limit: int = 200) -> list[dict[str, Any]]:
    """Every purchase and attack, newest first, for the organiser's record."""
    with db.transaction() as conn:
        found = conn.execute(
            sa.select(powerup_event, powerup.c.name.label("powerup_name"))
            .outerjoin(powerup, powerup.c.id == powerup_event.c.powerup_id)
            .order_by(powerup_event.c.id.desc())
            .limit(limit)
        ).all()
        names = dict(conn.execute(sa.select(user.c.id, user.c.name)).all())
    return [
        {
            "id": r.id,
            "kind": r.kind,
            "powerup": r.powerup_name,
            "actor": names.get(r.actor_id, r.actor_id),
            "target": names.get(r.target_id, r.target_id) if r.target_id else None,
            "cost": r.cost,
            "at": clock.iso(r.created_at),
        }
        for r in found
    ]


DEFAULTS = (
    {
        "kind": "blackout",
        "name": "Blackout",
        "price": 150,
        "duration_seconds": 60,
        "sort_order": 1,
        "description": (
            "Blanks another competitor's screen and locks them out of the contest "
            "for a while. Stacks if several land."
        ),
    },
    {
        "kind": "shield",
        "name": "Shield",
        "price": 120,
        "duration_seconds": None,
        "sort_order": 2,
        "description": (
            "Absorbs one Blackout aimed at you. "
            "Works while you hold it — there is nothing to switch on."
        ),
    },
)


def ensure_powerups() -> None:
    """Seed the two default powerups into an empty table, once.

    Never overwrites an organiser's edits.
    """
    with db.transaction() as conn:
        if conn.execute(sa.select(powerup.c.id).limit(1)).first():
            return  # the usual case: already seeded, no lock taken
        # Two first requests arriving together would otherwise both see an empty table.
        db.advisory_xact_lock(conn, db.LOCK_POWERUP_SEED)
        if conn.execute(sa.select(powerup.c.id).limit(1)).first():
            return
        for item in DEFAULTS:
            conn.execute(
                sa.insert(powerup).values(
                    **item,
                    enabled=True,
                    max_held=3,
                    max_purchases=None,
                    usable_phases=["coding1", "final"],
                )
            )
