"""Hints: author-written, unlocked in order, bought with contest money."""

from __future__ import annotations

from typing import Any

import sqlalchemy as sa

from engine.accounts import wallet
from engine.coding.submissions import owns
from engine.core import db, errors, events
from engine.core.audit import audit
from engine.marketplace.blackouts import assert_not_blacked_out
from engine.schema import hint, hint_purchase


def hints_for(conn: sa.Connection, participant_id: str, question_id: str) -> dict[str, Any]:
    """Bought hints in full; the next one's price only."""
    all_hints = _hints(conn, question_id)
    bought = _bought_indexes(conn, participant_id, question_id)
    revealed: list[dict[str, Any]] = []
    for h in all_hints:
        if h.idx in bought:
            revealed.append({"idx": h.idx, "body_md": h.body_md, "price": h.price})
    nxt = next((h for h in all_hints if h.idx not in bought), None)
    return {
        "total": len(all_hints),
        "revealed": revealed,
        "next": {"idx": nxt.idx, "price": nxt.price} if nxt else None,
    }


def _hints(conn: sa.Connection, question_id: str) -> list[sa.Row]:
    return conn.execute(
        sa.select(hint).where(hint.c.question_id == question_id).order_by(hint.c.idx)
    ).all()


def _bought_indexes(conn: sa.Connection, participant_id: str, question_id: str) -> set[int]:
    return set(
        conn.execute(
            sa.select(hint_purchase.c.hint_idx).where(
                hint_purchase.c.question_id == question_id,
                hint_purchase.c.participant_id == participant_id,
            )
        ).scalars()
    )


def buy_hint(participant_id: str, question_id: str, idx: int | None = None) -> dict[str, Any]:
    """Buy the next hint.

    `idx` says which hint the buyer was looking at. Sent twice -- a double click,
    a retry -- the second finds it already bought and returns it without charging,
    instead of buying the hint after it.
    """
    with db.transaction() as conn:
        assert_not_blacked_out(conn, participant_id)
        # One purchase at a time per participant.
        p = wallet.lock_participant(conn, participant_id)
        if p is None:
            raise errors.forbidden("not a participant")
        if owns(conn, participant_id, question_id) is None:
            raise errors.forbidden("you do not own this question")
        result = _buy_next_hint(conn, p, question_id, idx)
    if not result["replayed"]:
        events.publish("balance", {"balance": result["balance"]}, participant_id)
    return result


def _buy_next_hint(
    conn: sa.Connection, p: sa.Row, question_id: str, idx: int | None
) -> dict[str, Any]:
    all_hints = _hints(conn, question_id)
    bought = _bought_indexes(conn, p.user_id, question_id)
    if idx is not None and idx in bought:
        h = next(h for h in all_hints if h.idx == idx)
        return {"idx": h.idx, "body_md": h.body_md, "balance": p.balance, "replayed": True}
    nxt = next((h for h in all_hints if h.idx not in bought), None)
    if nxt is None:
        raise errors.conflict("no_more_hints", "there are no more hints for this question")
    if idx is not None and idx != nxt.idx:
        raise errors.conflict(
            "hint_order", f"hints unlock in order; the next one is #{nxt.idx + 1}"
        )
    if nxt.price > p.balance:
        raise errors.conflict(
            "insufficient_balance", f"this hint costs {nxt.price}; you have {p.balance}"
        )
    target = f"{question_id}#{nxt.idx}"
    balance = wallet.move(conn, p.user_id, -nxt.price, "hint", target)
    conn.execute(
        sa.insert(hint_purchase).values(
            question_id=question_id,
            hint_idx=nxt.idx,
            participant_id=p.user_id,
            price_paid=nxt.price,
        )
    )
    audit(
        conn,
        actor_id=p.user_id,
        action="hint.buy",
        target=target,
        reason="participant purchase",
        detail={"price": nxt.price},
    )
    return {"idx": nxt.idx, "body_md": nxt.body_md, "balance": balance, "replayed": False}
