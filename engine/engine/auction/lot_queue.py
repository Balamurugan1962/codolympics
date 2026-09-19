"""The order lots are offered in: withdraw, restore, reorder and relist.

Each change is audited with its reason in the same transaction, and every page
is sent a fresh snapshot once it commits.
"""

from __future__ import annotations

import sqlalchemy as sa

from engine.auction.board import lock_lot, publish_snapshot
from engine.auction.lots import open_next_lot
from engine.contest.rules import active_round, get_contest
from engine.core import clock, db, errors
from engine.core.audit import audit
from engine.schema import lot


def withdraw_lot(actor_id: str, lot_id: int, reason: str) -> None:
    """Pull a question off the block.

    Settles nothing: no winner, no money, and the bids are kept for the record.
    """
    with db.transaction() as conn:
        target = lock_lot(conn, lot_id)
        if target.state == "withdrawn":
            raise errors.conflict("already_withdrawn", "that question is already off the block")
        if target.state in ("closed", "unsold"):
            raise errors.conflict(
                "already_settled",
                "that lot has already been settled, take the question back instead",
            )
        conn.execute(
            sa.update(lot)
            .where(lot.c.id == lot_id)
            .values(
                state="withdrawn",
                closed_at=clock.now(),
                no_bid_deadline=None,
                bidding_ends_at=None,
            )
        )
        detail = {
            "question": target.question_id,
            "was": target.state,
            "bids": target.current_bid,
        }
        audit(
            conn,
            actor_id=actor_id,
            action="lot.withdraw",
            target=str(lot_id),
            reason=reason,
            detail=detail,
        )
        phase = get_contest(conn).phase
    publish_snapshot()
    # Withdrawing what was on the block leaves a gap on every screen; fill it now
    # rather than on the next tick.
    if target.state == "open" and (round_ := active_round(phase)):
        open_next_lot(round_)


def restore_lot(actor_id: str, lot_id: int, reason: str) -> None:
    """Put a withdrawn question back at the end of the queue."""
    with db.transaction() as conn:
        target = lock_lot(conn, lot_id)
        if target.state != "withdrawn":
            raise errors.conflict("not_withdrawn", "that lot is not withdrawn")
        order = _last_order(conn, target.round) + 1
        conn.execute(
            sa.update(lot)
            .where(lot.c.id == lot_id)
            .values(
                state="pending",
                order=order,
                closed_at=None,
                opened_at=None,
                current_bid=None,
                current_bidder_id=None,
            )
        )
        detail = {"question": target.question_id, "order": order}
        audit(
            conn,
            actor_id=actor_id,
            action="lot.restore",
            target=str(lot_id),
            reason=reason,
            detail=detail,
        )
    publish_snapshot()


def _last_order(conn: sa.Connection, round_: int) -> int:
    return conn.execute(
        sa.select(sa.func.coalesce(sa.func.max(lot.c.order), 0)).where(lot.c.round == round_)
    ).scalar_one()


def reorder_lots(actor_id: str, round_: int, lot_ids: list[int], reason: str) -> None:
    """Reorder what has not been offered.

    Lots already offered keep their place: that is now history.
    """
    with db.transaction() as conn:
        pending = conn.execute(
            sa.select(lot.c.id, lot.c.order)
            .where(lot.c.round == round_, lot.c.state == "pending")
            .order_by(lot.c.order)
            .with_for_update()
        ).all()
        if sorted(lot_ids) != sorted(p.id for p in pending):
            raise errors.invalid(
                "the new order must list every question still to be offered, exactly once"
            )
        # Reuse the slots the pending lots already occupy.
        slots = sorted(p.order for p in pending)
        for lot_id, slot in zip(lot_ids, slots, strict=False):
            conn.execute(sa.update(lot).where(lot.c.id == lot_id).values(order=slot))
        audit(
            conn,
            actor_id=actor_id,
            action="lot.reorder",
            target=str(round_),
            reason=reason,
            detail={"order": lot_ids},
        )
    publish_snapshot()


def relist_question(conn: sa.Connection, question_id: str, round_: int) -> None:
    """Back to the end of the round's queue, as if never offered."""
    fresh = {
        "state": "pending",
        "order": _last_order(conn, round_) + 1,
        "opened_at": None,
        "closed_at": None,
        "current_bid": None,
        "current_bidder_id": None,
        "no_bid_deadline": None,
        "bidding_ends_at": None,
    }
    existing = conn.execute(
        sa.select(lot.c.id).where(lot.c.question_id == question_id, lot.c.round == round_)
    ).first()
    if existing:
        conn.execute(sa.update(lot).where(lot.c.id == existing.id).values(**fresh))
    else:
        conn.execute(sa.insert(lot).values(question_id=question_id, round=round_, **fresh))
