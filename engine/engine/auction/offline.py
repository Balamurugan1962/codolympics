"""The offline auction: the room bids out loud and an organiser records each result.

The app does not police the bidding here, only the outcome it is told about, and
each recorded result moves straight on to the next lot.
"""

from __future__ import annotations

import sqlalchemy as sa

from engine.accounts import wallet
from engine.auction.board import lock_lot, publish_snapshot
from engine.auction.control import require_auction
from engine.auction.lots import open_next_lot
from engine.auction.rules import check_ownership_cap
from engine.auction.sales import announce_award, award
from engine.contest.rules import active_round, auction_round, lock_contest
from engine.core import clock, db, errors, events
from engine.core.audit import audit
from engine.schema import lot, question


def record_sale(actor_id: str, lot_id: int, participant_id: str, price: int, reason: str) -> None:
    """Write down a sale the auctioneer made in the room. Refuses only the impossible."""
    with db.transaction() as conn:
        c = lock_contest(conn)
        _check_offline_open(c)
        target = _lock_open_lot(conn, lot_id)
        base_price = conn.execute(
            sa.select(question.c.base_price).where(question.c.id == target.question_id)
        ).scalar_one()
        # The base price is published in advance; a sale under it is a different
        # deal from the one bid on.
        if price < base_price:
            raise errors.conflict("below_base", f"the base price is {base_price}")
        _check_buyer(conn, c, participant_id, price)
        award(conn, target.id, target.question_id, participant_id, price)
        detail = {
            "question": target.question_id,
            "to": participant_id,
            "price": price,
            "mode": "offline",
        }
        audit(
            conn,
            actor_id=actor_id,
            action="lot.record_sale",
            target=str(lot_id),
            reason=reason,
            detail=detail,
        )
        round_ = auction_round(c.phase)
    publish_snapshot()
    events.publish("leaderboard")
    announce_award(participant_id, target.question_id, price)
    open_next_lot(round_)


def _check_offline_open(c: sa.Row) -> None:
    if c.auction_mode != "offline":
        raise errors.conflict("not_offline", "this contest runs its auction online")
    require_auction(c.phase)
    if c.auction_paused_at:
        raise errors.conflict(
            "auction_paused", "the auction is paused — resume it before recording a sale"
        )


def _lock_open_lot(conn: sa.Connection, lot_id: int) -> sa.Row:
    target = lock_lot(conn, lot_id)
    if target.state != "open":
        raise errors.conflict("not_open", "that question is not on the block")
    return target


def _check_buyer(conn: sa.Connection, c: sa.Row, participant_id: str, price: int) -> None:
    p = wallet.lock_participant(conn, participant_id)
    if p is None:
        raise errors.not_found("participant")
    if p.disqualified_at:
        raise errors.conflict("disqualified", "that account is disqualified")
    if price > p.balance:
        raise errors.conflict(
            "insufficient_balance", f"they have {p.balance}, and this sale is {price}"
        )
    check_ownership_cap(conn, c, participant_id, "they already own")


def record_unsold(actor_id: str, lot_id: int, reason: str) -> None:
    """Nobody bid, or nobody bid enough: close the lot with nothing sold."""
    with db.transaction() as conn:
        c = lock_contest(conn)
        if c.auction_mode != "offline":
            raise errors.conflict("not_offline", "this contest runs its auction online")
        target = _lock_open_lot(conn, lot_id)
        conn.execute(
            sa.update(lot)
            .where(lot.c.id == lot_id)
            .values(
                state="unsold",
                closed_at=clock.now(),
                no_bid_deadline=None,
                bidding_ends_at=None,
            )
        )
        detail = {"question": target.question_id, "mode": "offline"}
        audit(
            conn,
            actor_id=actor_id,
            action="lot.record_unsold",
            target=str(lot_id),
            reason=reason,
            detail=detail,
        )
    publish_snapshot()
    if round_ := active_round(c.phase):
        open_next_lot(round_)
