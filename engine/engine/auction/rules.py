"""The auction's rules as plain checks: the bid ladder, a lot's clock, and the ownership cap."""

from __future__ import annotations

import sqlalchemy as sa

from engine.core import clock, errors
from engine.schema import ownership


def next_bid_amount(current_bid: int | None, base_price: int, increment: int) -> int:
    """The first bid is the base price; every later bid is exactly one increment higher."""
    return base_price if current_bid is None else current_bid + increment


def deadline_passed(target: sa.Row) -> bool:
    """A lot whose clock has run out is closed to bids, even before the scheduler settles it."""
    now = clock.now()
    if target.current_bidder_id is None:
        return target.no_bid_deadline is not None and target.no_bid_deadline <= now
    return target.bidding_ends_at is not None and target.bidding_ends_at <= now


def check_ownership_cap(conn: sa.Connection, c: sa.Row, participant_id: str, who: str) -> None:
    if c.ownership_cap is None:
        return
    owned = conn.execute(
        sa.select(sa.func.count())
        .select_from(ownership)
        .where(ownership.c.participant_id == participant_id, ownership.c.voided_at.is_(None))
    ).scalar_one()
    if owned >= c.ownership_cap:
        raise errors.conflict(
            "ownership_cap_reached", f"{who} the maximum of {c.ownership_cap} questions"
        )
