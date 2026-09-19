"""What the auction looks like right now, and the locks for reaching a lot.

`snapshot` gathers the lot on the block, its recent bids and the round's running
order into one participant-safe payload; `publish_snapshot` pushes it to every
page after a change. `lock_lot` and `lock_open_lot` are shared by everything
that changes a lot, so they all take the row the same way.
"""

from __future__ import annotations

from typing import Any

import sqlalchemy as sa

from engine.auction.rules import next_bid_amount
from engine.contest.rules import auction_round, get_contest, is_auction
from engine.core import clock, db, errors, events
from engine.schema import bid, lot, ownership, question, user


def current_lot(conn: sa.Connection) -> sa.Row | None:
    """The lot on the block, with its question's details and the top bidder's name."""
    return conn.execute(
        sa.select(
            lot,
            question.c.title,
            question.c.difficulty,
            question.c.score,
            question.c.base_price,
            user.c.name.label("bidder_name"),
        )
        .join(question, question.c.id == lot.c.question_id)
        .outerjoin(user, user.c.id == lot.c.current_bidder_id)
        .where(lot.c.state == "open")
        .limit(1)
    ).one_or_none()


def lock_lot(conn: sa.Connection, lot_id: int) -> sa.Row:
    """The lot, held FOR UPDATE until the transaction ends, or a 404."""
    found = conn.execute(sa.select(lot).where(lot.c.id == lot_id).with_for_update()).one_or_none()
    if found is None:
        raise errors.not_found("lot")
    return found


def lock_open_lot(conn: sa.Connection) -> sa.Row:
    """The lot on the block, held FOR UPDATE, or a 409 when nothing is open."""
    found = conn.execute(
        sa.select(lot).where(lot.c.state == "open").with_for_update()
    ).one_or_none()
    if found is None:
        raise errors.conflict("no_open_lot", "no question is open for bidding")
    return found


def snapshot(conn: sa.Connection, round_: int) -> dict[str, Any]:
    """Everything a client needs to draw the auction. Participant-safe."""
    c = get_contest(conn)
    open_lot = current_lot(conn)
    return {
        "round": round_,
        # Participants see mode and pause too: a frozen countdown with no reason
        # reads as a broken page.
        "mode": c.auction_mode,
        "paused": c.auction_paused_at is not None,
        "paused_at": clock.iso(c.auction_paused_at),
        "increment": c.bid_increment,
        "countdown_seconds": c.countdown_seconds,
        "opening_window_seconds": c.opening_window_seconds,
        "recent_bids": _recent_bids(conn, open_lot.id) if open_lot else [],
        "lot": _lot_view(open_lot, c.bid_increment) if open_lot else None,
        "order": _round_order(conn, round_),
        "server_now": clock.now_ms(),
    }


def _lot_view(open_lot: sa.Row, increment: int) -> dict[str, Any]:
    return {
        "id": open_lot.id,
        "question_id": open_lot.question_id,
        "title": open_lot.title,
        "difficulty": open_lot.difficulty,
        "score": open_lot.score,
        "base_price": open_lot.base_price,
        "current_bid": open_lot.current_bid,
        "current_bidder_id": open_lot.current_bidder_id,
        "current_bidder_name": open_lot.bidder_name,
        "next_bid": next_bid_amount(open_lot.current_bid, open_lot.base_price, increment),
        "no_bid_deadline": clock.iso(open_lot.no_bid_deadline),
        "bidding_ends_at": clock.iso(open_lot.bidding_ends_at),
        "opened_at": clock.iso(open_lot.opened_at),
    }


def _recent_bids(conn: sa.Connection, lot_id: int) -> list[dict[str, Any]]:
    found = conn.execute(
        sa.select(bid.c.id, bid.c.amount, bid.c.participant_id, user.c.name, bid.c.created_at)
        .join(user, user.c.id == bid.c.participant_id)
        .where(bid.c.lot_id == lot_id)
        .order_by(bid.c.id.desc())
        .limit(12)
    ).all()
    return [
        {
            "id": b.id,
            "amount": b.amount,
            "participant_id": b.participant_id,
            "name": b.name,
            "at": clock.iso(b.created_at),
        }
        for b in found
    ]


def _round_order(conn: sa.Connection, round_: int) -> list[dict[str, Any]]:
    """The running order, with who bought what. A closed lot's buyer and price are public."""
    found = conn.execute(
        sa.select(
            lot.c.id,
            lot.c.question_id,
            question.c.title,
            question.c.difficulty,
            question.c.score,
            question.c.base_price,
            lot.c.state,
            lot.c.current_bid,
            lot.c.order,
            ownership.c.participant_id.label("winner_id"),
            ownership.c.price_paid,
            user.c.name.label("winner_name"),
        )
        .join(question, question.c.id == lot.c.question_id)
        .outerjoin(
            ownership,
            sa.and_(ownership.c.question_id == lot.c.question_id, ownership.c.voided_at.is_(None)),
        )
        .outerjoin(user, user.c.id == ownership.c.participant_id)
        .where(lot.c.round == round_)
        .order_by(lot.c.order)
    ).all()
    return [
        {
            "id": o.id,
            "questionId": o.question_id,
            "title": o.title,
            "difficulty": o.difficulty,
            "score": o.score,
            "state": o.state,
            "order": o.order,
            "base_price": o.base_price,
            "current_bid": o.current_bid,
            "winner_id": o.winner_id,
            "winner_name": o.winner_name,
            "price_paid": o.price_paid,
        }
        for o in found
    ]


def publish_snapshot() -> None:
    """Tell every page what the auction looks like now, if one is running."""
    with db.transaction() as conn:
        phase = get_contest(conn).phase
        if not is_auction(phase):
            return
        data = snapshot(conn, auction_round(phase))
    events.publish("auction", data)
