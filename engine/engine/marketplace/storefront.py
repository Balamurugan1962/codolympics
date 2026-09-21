"""The marketplace as one participant sees it: prices, what they hold, and why they cannot act."""

from __future__ import annotations

from typing import Any

import sqlalchemy as sa

from engine.contest.rules import get_contest, in_phase2, marketplace_closed_reason
from engine.core import clock, db, errors
from engine.marketplace import shields
from engine.marketplace.catalogue import catalogue
from engine.schema import blackout, participant, powerup_inventory, user


def marketplace_for(participant_id: str) -> dict[str, Any]:
    items = catalogue()
    with db.transaction() as conn:
        c = get_contest(conn)
        p = conn.execute(
            sa.select(participant).where(participant.c.user_id == participant_id)
        ).one_or_none()
        if p is None:
            raise errors.forbidden("not a participant")
        inventory = conn.execute(
            sa.select(powerup_inventory).where(powerup_inventory.c.participant_id == participant_id)
        )
        held = {h.powerup_id: h for h in inventory}
        targets = _attackable_targets(conn, participant_id, c.reveal_shields)
        my_shield = shields.shield_state(conn, participant_id)
    return {
        "open": marketplace_closed_reason(c) is None,
        "in_phase2": in_phase2(c.phase),
        "phase": c.phase,
        "balance": p.balance,
        "items": [_offer(item, held.get(item.id), c, p) for item in items if item.enabled],
        "targets": targets,
        "shield": my_shield,
        # Organisers decide whether an attacker can see who has a shield up.
        "reveal_shields": c.reveal_shields,
        "server_now": clock.now_ms(),
    }


def _offer(item: sa.Row, held: sa.Row | None, c: sa.Row, p: sa.Row) -> dict[str, Any]:
    owned = held.quantity if held else 0
    bought = held.purchased if held else 0
    usable_now = c.phase in item.usable_phases
    if owned <= 0:
        use_blocked = "You do not own one."
    elif usable_now:
        use_blocked = None
    else:
        use_blocked = "Not usable in this part of the contest."
    return {
        "id": item.id,
        "kind": item.kind,
        "name": item.name,
        "description": item.description,
        "price": item.price,
        "duration_seconds": item.duration_seconds,
        "owned": owned,
        "max_held": item.max_held,
        "max_purchases": item.max_purchases,
        "purchased": bought,
        "usable_phases": item.usable_phases,
        "usable_now": usable_now,
        # Every reason a buy would be refused, as a sentence, so the button and the API agree.
        "buy_blocked": _buy_blocked(item, c, p, owned, bought),
        "use_blocked": use_blocked,
    }


def _buy_blocked(item: sa.Row, c: sa.Row, p: sa.Row, owned: int, bought: int) -> str | None:
    if closed := marketplace_closed_reason(c):
        return closed
    if p.disqualified_at:
        return "Your account is disqualified."
    if item.price > p.balance:
        return f"You have {p.balance}; this costs {item.price}."
    if item.max_held is not None and owned >= item.max_held:
        return f"You can hold at most {item.max_held}."
    if item.max_purchases is not None and bought >= item.max_purchases:
        return f"You have used your {item.max_purchases} for this contest."
    return None


def _attackable_targets(
    conn: sa.Connection, actor_id: str, reveal_shields: bool
) -> list[dict[str, Any]]:
    people = conn.execute(
        sa.select(participant.c.user_id, user.c.name, participant.c.disqualified_at)
        .join(user, user.c.id == participant.c.user_id)
        .order_by(user.c.name)
    ).all()
    shielded = shields.shielded_now(conn) if reveal_shields else set()
    blacked = set(
        conn.execute(
            sa.select(blackout.c.participant_id).where(blackout.c.ends_at > clock.now())
        ).scalars()
    )
    return [
        {
            "id": r.user_id,
            "name": r.name,
            "disqualified": r.disqualified_at is not None,
            # With shields revealed, spending an attack is a decision, not a dice roll.
            "shielded": r.user_id in shielded,
            "blacked_out": r.user_id in blacked,
        }
        for r in people
        if r.user_id != actor_id
    ]
