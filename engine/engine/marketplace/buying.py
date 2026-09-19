"""Buying powerups.

The server is the only authority: price, limits and the buyer's balance are re-read
inside the transaction that acts on them, with the buyer's participant row locked so
one person's purchases run one at a time.

A replayed request (double click, retry, refresh) collides on its powerup_event row
and is answered from what the first attempt left behind; see
`engine.marketplace.inventory`.
"""

from __future__ import annotations

from typing import Any

import sqlalchemy as sa

from engine.accounts import wallet
from engine.contest.rules import lock_contest, marketplace_closed_reason
from engine.core import db, errors, events
from engine.marketplace.inventory import add_to_inventory, event_for, holdings
from engine.schema import participant, powerup, powerup_event


def buy(participant_id: str, powerup_id: int, request_id: str) -> dict[str, Any]:
    try:
        with db.transaction() as conn:
            result = _buy(conn, participant_id, powerup_id, request_id)
    except Exception as err:
        if not db.is_unique_violation(err):
            raise
        return {**_replay_buy(participant_id, request_id), "replayed": True}
    events.publish("balance", {"balance": result["balance"]}, participant_id)
    return result


def _buy(
    conn: sa.Connection, participant_id: str, powerup_id: int, request_id: str
) -> dict[str, Any]:
    if closed := marketplace_closed_reason(lock_contest(conn)):
        raise errors.conflict("marketplace_closed", closed[0].lower() + closed[1:].rstrip("."))
    p = wallet.lock_participant(conn, participant_id)
    if p is None:
        raise errors.forbidden("not a participant")
    if p.disqualified_at:
        raise errors.forbidden("your account is disqualified")
    item = conn.execute(sa.select(powerup).where(powerup.c.id == powerup_id)).one_or_none()
    if item is None:
        raise errors.not_found("powerup")
    _check_can_buy(conn, item, p)

    balance = wallet.move(conn, participant_id, -item.price, "powerup", item.name)
    owned = add_to_inventory(conn, participant_id, item.id)
    # Last, so a replayed request collides here and rolls everything above back.
    conn.execute(
        sa.insert(powerup_event).values(
            kind="purchase",
            powerup_id=item.id,
            actor_id=participant_id,
            cost=item.price,
            request_id=request_id,
            detail={"name": item.name},
        )
    )
    return {"ok": True, "balance": balance, "owned": owned, "replayed": False}


def _check_can_buy(conn: sa.Connection, item: sa.Row, p: sa.Row) -> None:
    if not item.enabled:
        raise errors.conflict("powerup_disabled", f"{item.name} is not on sale")
    if item.price > p.balance:
        raise errors.conflict(
            "insufficient_balance", f"you have {p.balance}; this costs {item.price}"
        )
    owned, bought = holdings(conn, p.user_id, item.id)
    if item.max_held is not None and owned >= item.max_held:
        raise errors.conflict("hold_limit", f"you can hold at most {item.max_held} {item.name}")
    if item.max_purchases is not None and bought >= item.max_purchases:
        raise errors.conflict(
            "purchase_limit", f"you have used your {item.max_purchases} for this contest"
        )


def _replay_buy(participant_id: str, request_id: str) -> dict[str, Any]:
    """What the first copy of a replayed purchase left behind."""
    with db.transaction() as conn:
        balance = conn.execute(
            sa.select(participant.c.balance).where(participant.c.user_id == participant_id)
        ).scalar()
        first = event_for(conn, participant_id, request_id)
        owned, _ = holdings(conn, participant_id, first.powerup_id if first else None)
    return {"ok": True, "balance": balance or 0, "owned": owned}
