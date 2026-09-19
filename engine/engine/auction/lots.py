"""A lot's life on the block: created for a round, opened, then settled by clock or by hand.

The clock lives in the database as a pair of deadline columns, and `tick` runs
once a second to open the next lot and settle one whose clock has run out.

The scheduler settles a lot only after re-reading its deadline under the lot's
row lock (see `settle_if_due`). An organiser adding thirty seconds, or a last
bid restarting the countdown, cannot be settled over by a scheduler that looked
a moment early.

The database allows at most one open lot (a partial unique index), so two
processes opening "the next lot" at once cannot put two on the block.
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import insert as pg_insert

from engine.auction.board import current_lot, publish_snapshot
from engine.auction.rules import deadline_passed
from engine.auction.sales import announce_award, award
from engine.contest.rules import auction_round, get_contest, is_auction, lock_contest
from engine.core import clock, db, errors, events
from engine.core.audit import audit
from engine.schema import lot, question


def create_lots_for_round(conn: sa.Connection, round_: int) -> int:
    """Round 1 offers every question in auction order; round 2 offers what went unsold."""
    where = question.c.status != "void" if round_ == 1 else question.c.status == "unsold"
    query = sa.select(question.c.id).where(where).order_by(question.c.auction_order, question.c.id)
    ids = conn.execute(query).scalars().all()
    if ids:
        rows = []
        for i, qid in enumerate(ids):
            rows.append({"question_id": qid, "round": round_, "order": i + 1, "state": "pending"})
        conn.execute(pg_insert(lot).values(rows).on_conflict_do_nothing())
    return len(ids)


def open_next_lot(round_: int) -> bool:
    """Put the round's next pending lot on the block.

    Does nothing if a lot is already open or the auction is paused.
    """
    try:
        with db.transaction() as conn:
            opened = _open_next(conn, round_)
    except Exception as err:
        # Another process opened a lot in the same instant; the index kept it to one.
        if not db.is_unique_violation(err):
            raise
        return False
    if opened:
        publish_snapshot()
    return opened


def _open_next(conn: sa.Connection, round_: int) -> bool:
    c = lock_contest(conn)
    if c.auction_paused_at:
        return False
    already_open = conn.execute(sa.select(lot.c.id).where(lot.c.state == "open")).first()
    if already_open:
        return False
    nxt = conn.execute(
        sa.select(lot.c.id)
        .where(lot.c.round == round_, lot.c.state == "pending")
        .order_by(lot.c.order)
        .limit(1)
        .with_for_update()
    ).first()
    if nxt is None:
        return False
    # Offline, a person decides when a lot is done, so it opens with no clock at all.
    if c.auction_mode == "offline":
        window = None
    else:
        window = clock.seconds_from_now(c.opening_window_seconds)
    conn.execute(
        sa.update(lot)
        .where(lot.c.id == nxt.id)
        .values(
            state="open",
            opened_at=clock.now(),
            no_bid_deadline=window,
            bidding_ends_at=None,
        )
    )
    return True


def close_lot(lot_id: int, actor_id: str | None = None, reason: str | None = None) -> str:
    """Settle an open lot now: award it to the highest bidder, or mark it unsold."""
    with db.transaction() as conn:
        target = conn.execute(
            sa.select(lot).where(lot.c.id == lot_id).with_for_update()
        ).one_or_none()
        if target is None or target.state != "open":
            raise errors.conflict("not_open", "that lot is not open")
        outcome = _settle(conn, target)
        if actor_id:
            detail = {"outcome": outcome}
            if outcome == "sold":
                detail["to"] = target.current_bidder_id
                detail["price"] = target.current_bid
            audit(
                conn,
                actor_id=actor_id,
                action="lot.close",
                target=str(lot_id),
                reason=reason or "",
                detail=detail,
            )
    _announce_settlement(target, outcome)
    return outcome


def settle_if_due(lot_id: int) -> str | None:
    """The scheduler's close: only if the clock really has run out, re-read under the lot's lock."""
    with db.transaction() as conn:
        c = lock_contest(conn)
        target = conn.execute(
            sa.select(lot).where(lot.c.id == lot_id).with_for_update()
        ).one_or_none()
        if (
            c.auction_paused_at
            or c.auction_mode == "offline"
            or target is None
            or target.state != "open"
        ):
            return None
        if not deadline_passed(target):
            return None
        outcome = _settle(conn, target)
    _announce_settlement(target, outcome)
    return outcome


def _settle(conn: sa.Connection, target: sa.Row) -> str:
    if target.current_bidder_id is None or target.current_bid is None:
        conn.execute(
            sa.update(lot)
            .where(lot.c.id == target.id)
            .values(state="unsold", closed_at=clock.now())
        )
        return "unsold"
    award(conn, target.id, target.question_id, target.current_bidder_id, target.current_bid)
    return "sold"


def _announce_settlement(target: sa.Row, outcome: str) -> None:
    publish_snapshot()
    events.publish("leaderboard")
    if outcome == "sold":
        announce_award(target.current_bidder_id, target.question_id, target.current_bid)


def close_lot_now(actor_id: str, reason: str) -> None:
    """Administrator: close bidding on the open lot now, then offer the next."""
    with db.transaction() as conn:
        open_lot = current_lot(conn)
        phase = get_contest(conn).phase
    if open_lot is None:
        raise errors.conflict("no_open_lot", "no question is open for bidding")
    close_lot(open_lot.id, actor_id, reason)
    open_next_lot(auction_round(phase))


def tick() -> None:
    """Once a second: open the next lot if none is open, or settle the open one if it is due."""
    with db.transaction() as conn:
        c = get_contest(conn)
        if not is_auction(c.phase) or c.auction_paused_at:
            return
        open_lot = current_lot(conn)
    round_ = auction_round(c.phase)
    if open_lot is None:
        open_next_lot(round_)
    elif c.auction_mode == "online" and deadline_passed(open_lot):
        if settle_if_due(open_lot.id):
            open_next_lot(round_)
