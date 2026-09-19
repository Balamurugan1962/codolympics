"""Placing a bid on the lot that is on the block.

Balance is not debited when bidding. Lots are offered one at a time, so a
participant's whole balance is available for the question in front of them and
no reservation exists anywhere. Only winning moves money.

A bid locks the lot row. Every bid on one question queues on that lock, so the
"next legal amount" each one checks is the amount the previous bid left.
Twenty people pressing Bid at once produce one accepted bid per rung
(README.md has the long form).

Lock order: contest row (shared), then lot, then participant.
"""

from __future__ import annotations

import sqlalchemy as sa

from engine.accounts import wallet
from engine.auction.board import lock_lot, publish_snapshot
from engine.auction.rules import check_ownership_cap, deadline_passed, next_bid_amount
from engine.contest.rules import lock_contest
from engine.core import clock, db, errors
from engine.marketplace.blackouts import assert_not_blacked_out
from engine.schema import bid, lot, question


def place_bid(participant_id: str, lot_id: int, amount: int) -> None:
    with db.transaction() as conn:
        c = lock_contest(conn)
        assert_not_blacked_out(conn, participant_id)
        # Every bid for this question queues here; that is what orders them.
        target = lock_lot(conn, lot_id)
        p = wallet.lock_participant(conn, participant_id)
        if p is None:
            raise errors.forbidden("not a participant")
        base_price = conn.execute(
            sa.select(question.c.base_price).where(question.c.id == target.question_id)
        ).scalar_one()
        _check_bid(conn, c, target, p, amount, base_price)
        _record_bid(conn, c, target, participant_id, amount)
    publish_snapshot()


def _check_bid(
    conn: sa.Connection,
    c: sa.Row,
    target: sa.Row,
    p: sa.Row,
    amount: int,
    base_price: int,
) -> None:
    if p.disqualified_at:
        raise errors.conflict("disqualified", "your account is disqualified")
    if c.auction_mode == "offline":
        raise errors.conflict(
            "bidding_closed", "bidding for this contest happens in the room, not here"
        )
    if c.auction_paused_at:
        raise errors.conflict("auction_paused", "the organisers have paused the auction")
    if target.state != "open" or deadline_passed(target):
        raise errors.conflict("bidding_closed", "bidding on this question has closed")
    if target.current_bidder_id == p.user_id:
        raise errors.conflict("already_highest", "you already hold the highest bid")
    expected = next_bid_amount(target.current_bid, base_price, c.bid_increment)
    if amount != expected:
        raise errors.conflict("wrong_increment", f"the next legal bid is {expected}")
    if amount > p.balance:
        raise errors.conflict("insufficient_balance", f"you have {p.balance}; this bid is {amount}")
    check_ownership_cap(conn, c, p.user_id, "you already own")


def _record_bid(
    conn: sa.Connection, c: sa.Row, target: sa.Row, participant_id: str, amount: int
) -> None:
    conn.execute(
        sa.insert(bid).values(lot_id=target.id, participant_id=participant_id, amount=amount)
    )
    # The countdown restarts on every bid; 0 seconds means the organisers close lots by hand.
    ends_at = clock.seconds_from_now(c.countdown_seconds) if c.countdown_seconds > 0 else None
    conn.execute(
        sa.update(lot)
        .where(lot.c.id == target.id)
        .values(
            current_bid=amount,
            current_bidder_id=participant_id,
            no_bid_deadline=None,
            bidding_ends_at=ends_at,
        )
    )
