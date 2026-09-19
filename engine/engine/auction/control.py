"""The administrator's hands on a running auction: pause, resume, the lot timer, retract.

Two rules hold throughout: nothing happens without a reason, and the audit row
is written in the same transaction as the change.

Pause needs care because the clock is a pair of deadline columns. A pause that
only stopped the scheduler would leave deadlines in the past and settle
everything the moment the auction resumed. So a pause records when it started,
and a resume pushes every live deadline forward by exactly that long. Both take
the contest row FOR UPDATE, which waits out any bid in flight (bids hold it
shared), so no bid can land "during" the instant of pausing.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

import sqlalchemy as sa

from engine.auction.board import lock_open_lot, publish_snapshot
from engine.contest.messages import notify
from engine.contest.rules import active_round, lock_contest
from engine.core import clock, db, errors
from engine.core.audit import audit
from engine.schema import bid, contest, lot


def require_auction(phase: str) -> None:
    if active_round(phase) is None:
        raise errors.conflict("not_auctioning", "no auction is running")


def pause(actor_id: str, reason: str) -> None:
    with db.transaction() as conn:
        c = lock_contest(conn, exclusive=True)
        require_auction(c.phase)
        if c.auction_paused_at:
            raise errors.conflict("already_paused", "the auction is already paused")
        conn.execute(sa.update(contest).values(auction_paused_at=clock.now()))
        open_lot = conn.execute(sa.select(lot.c.id).where(lot.c.state == "open")).first()
        audit(
            conn,
            actor_id=actor_id,
            action="auction.pause",
            target=str(open_lot.id) if open_lot else None,
            reason=reason,
        )
    publish_snapshot()


def resume(actor_id: str, reason: str) -> int:
    """Run again, giving back exactly the time the pause took. Returns the hold in ms."""
    with db.transaction() as conn:
        c = lock_contest(conn, exclusive=True)
        require_auction(c.phase)
        if not c.auction_paused_at:
            raise errors.conflict("not_paused", "the auction is not paused")
        held_ms = clock.ms(clock.now()) - clock.ms(c.auction_paused_at)
        # Postgres does the arithmetic, so a slow round trip cannot shave the gap.
        shift = sa.func.make_interval(0, 0, 0, 0, 0, 0, held_ms / 1000)
        conn.execute(
            sa.update(lot)
            .where(lot.c.state == "open")
            .values(
                no_bid_deadline=lot.c.no_bid_deadline + shift,
                bidding_ends_at=lot.c.bidding_ends_at + shift,
            )
        )
        conn.execute(sa.update(contest).values(auction_paused_at=None))
        audit(
            conn,
            actor_id=actor_id,
            action="auction.resume",
            reason=reason,
            detail={"held_ms": held_ms},
        )
    publish_snapshot()
    return held_ms


def set_lot_timer(actor_id: str, mode: str, reason: str, seconds: int | None = None) -> None:
    """off: close by hand only. restart: a full clock again. adjust: add or remove seconds."""
    with db.transaction() as conn:
        c = lock_contest(conn)
        open_lot = lock_open_lot(conn)
        window, ends_at = _new_clock(c, open_lot, mode, seconds)
        conn.execute(
            sa.update(lot)
            .where(lot.c.id == open_lot.id)
            .values(no_bid_deadline=window, bidding_ends_at=ends_at)
        )
        live = ends_at if open_lot.current_bidder_id else window
        detail = {"mode": mode, "seconds": seconds, "ends_at": clock.iso(live)}
        audit(
            conn,
            actor_id=actor_id,
            action="lot.timer",
            target=str(open_lot.id),
            reason=reason,
            detail=detail,
        )
    publish_snapshot()


def _new_clock(
    c: sa.Row, open_lot: sa.Row, mode: str, seconds: int | None
) -> tuple[datetime | None, datetime | None]:
    """(no_bid_deadline, bidding_ends_at) after the change.

    Only one clock is live: the countdown once anyone has bid, the opening
    window before that.
    """
    bidding = open_lot.current_bidder_id is not None
    if mode == "off":
        return None, None
    if mode == "restart":
        secs = c.countdown_seconds if bidding else c.opening_window_seconds
        if secs <= 0:
            raise errors.conflict(
                "no_countdown",
                "the countdown is set to 0 in Settings, so there is nothing to restart",
            )
        deadline = clock.seconds_from_now(secs)
        if bidding:
            return None, deadline
        return deadline, None
    if not seconds:
        raise errors.invalid("say how many seconds to add or remove")
    live = open_lot.bidding_ends_at if bidding else open_lot.no_bid_deadline
    if live is None:
        raise errors.conflict("timer_off", "this lot has no timer to adjust — restart it first")
    # Never into the past: that would be a close, and closing is its own action.
    moved = max(clock.seconds_from_now(1), live + timedelta(seconds=seconds))
    if bidding:
        return open_lot.no_bid_deadline, moved
    return moved, open_lot.bidding_ends_at


def retract_top_bid(actor_id: str, reason: str) -> dict[str, Any]:
    """Undo the top bid on the open lot. No money moves: bidding never debits."""
    with db.transaction() as conn:
        c = lock_contest(conn)
        open_lot = lock_open_lot(conn)
        bids = conn.execute(
            sa.select(bid).where(bid.c.lot_id == open_lot.id).order_by(bid.c.id.desc()).limit(2)
        ).all()
        if not bids:
            raise errors.conflict("no_bids", "there are no bids on this question to retract")
        top = bids[0]
        prev = bids[1] if len(bids) > 1 else None
        conn.execute(sa.delete(bid).where(bid.c.id == top.id))
        _restore_previous_bid(conn, c, open_lot.id, prev)
        detail = {
            "amount": top.amount,
            "bidder": top.participant_id,
            "restored_to": prev.participant_id if prev else None,
        }
        audit(
            conn,
            actor_id=actor_id,
            action="bid.retract",
            target=str(open_lot.id),
            reason=reason,
            detail=detail,
        )
        notify(
            conn,
            top.participant_id,
            f"Your bid of {top.amount} was retracted by an organiser. Reason: {reason}",
        )
    publish_snapshot()
    return {"removed": top.amount, "bidder": top.participant_id}


def _restore_previous_bid(conn: sa.Connection, c: sa.Row, lot_id: int, prev: sa.Row | None) -> None:
    """Back to whoever held it before, with the matching clock restarted.

    Restarting the clock gives the room its chance to bid again.
    """
    if prev:
        countdown = None
        if c.countdown_seconds > 0:
            countdown = clock.seconds_from_now(c.countdown_seconds)
        values = {
            "current_bid": prev.amount,
            "current_bidder_id": prev.participant_id,
            "no_bid_deadline": None,
            "bidding_ends_at": countdown,
        }
    else:
        values = {
            "current_bid": None,
            "current_bidder_id": None,
            "no_bid_deadline": clock.seconds_from_now(c.opening_window_seconds),
            "bidding_ends_at": None,
        }
    conn.execute(sa.update(lot).where(lot.c.id == lot_id).values(**values))
