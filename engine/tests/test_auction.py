"""The money transaction and the auction clock, against a real Postgres."""

from __future__ import annotations

from datetime import timedelta

import pytest
import sqlalchemy as sa
from conftest import (
    add_question,
    add_user,
    at_once,
    balance_of,
    codes,
    raises_code,
    rows,
    scalar,
    set_contest,
)
from sqlalchemy.exc import IntegrityError

from engine.auction import bidding, lots, rules
from engine.auction.takeback import take_back_question
from engine.core import clock, db
from engine.schema import bid, ledger, lot, ownership, participant


def open_lot() -> sa.Row:
    return rows(sa.select(lot).where(lot.c.state == "open"))[0]


def start_auction(*question_ids: str) -> None:
    set_contest(phase="auction1")
    for i, qid in enumerate(question_ids, start=1):
        add_question(qid, order=i)
    with db.transaction() as conn:
        lots.create_lots_for_round(conn, 1)
    lots.open_next_lot(1)


def test_next_bid_is_base_price_then_one_increment() -> None:
    assert rules.next_bid_amount(None, 100, 10) == 100
    assert rules.next_bid_amount(100, 100, 10) == 110


def test_twenty_bidders_at_once_get_exactly_one_bid_per_rung() -> None:
    bidders = [add_user(f"bidder-{i}", balance=150) for i in range(20)]
    start_auction("q")
    lot_id = open_lot().id

    first = at_once([lambda b=b: bidding.place_bid(b, lot_id, 100) for b in bidders])
    assert sum(r is None for r in first) == 1
    assert set(codes(first)) <= {"wrong_increment", "already_highest"}

    second = at_once([lambda b=b: bidding.place_bid(b, lot_id, 110) for b in bidders])
    assert sum(r is None for r in second) == 1
    assert [b.amount for b in rows(sa.select(bid).order_by(bid.c.id))] == [100, 110]

    winner = open_lot().current_bidder_id
    assert lots.close_lot(lot_id) == "sold"
    assert balance_of(winner) == 150 - 110
    winner_ledger = rows(sa.select(ledger).where(ledger.c.participant_id == winner))
    assert [e.delta for e in winner_ledger] == [-110]
    negative = sa.select(sa.func.count()).select_from(participant).where(participant.c.balance < 0)
    assert scalar(negative) == 0


def test_a_second_owner_row_is_impossible() -> None:
    add_user("a")
    add_user("b")
    start_auction("q")
    bidding.place_bid("a", open_lot().id, 100)
    lots.close_lot(open_lot().id)
    with pytest.raises(IntegrityError), db.transaction() as conn:
        conn.execute(sa.insert(ownership).values(question_id="q", participant_id="b", price_paid=1))


def test_a_bid_after_the_clock_ran_out_is_refused_even_before_settlement() -> None:
    add_user("a")
    add_user("b")
    start_auction("q")
    bidding.place_bid("a", open_lot().id, 100)
    with db.transaction() as conn:
        conn.execute(sa.update(lot).values(bidding_ends_at=clock.now() - timedelta(seconds=1)))
    raises_code("bidding_closed", lambda: bidding.place_bid("b", open_lot().id, 110))


def test_the_scheduler_does_not_settle_a_lot_whose_deadline_moved() -> None:
    add_user("a")
    start_auction("q")
    lot_id = open_lot().id
    bidding.place_bid("a", lot_id, 100)
    # The scheduler looked while the deadline was past; an organiser extended it before it acted.
    with db.transaction() as conn:
        conn.execute(sa.update(lot).values(bidding_ends_at=clock.now() + timedelta(seconds=30)))
    assert lots.settle_if_due(lot_id) is None
    assert open_lot().id == lot_id


def test_two_processes_opening_the_next_lot_put_only_one_on_the_block() -> None:
    set_contest(phase="auction1")
    for i in range(5):
        add_question(f"q{i}", order=i)
    with db.transaction() as conn:
        lots.create_lots_for_round(conn, 1)
    results = at_once([lambda: lots.open_next_lot(1) for _ in range(8)])
    assert results.count(True) == 1
    assert scalar(sa.select(sa.func.count()).select_from(lot).where(lot.c.state == "open")) == 1


def test_the_scheduler_settles_an_expired_lot_and_opens_the_next() -> None:
    add_user("a")
    start_auction("q1", "q2")
    bidding.place_bid("a", open_lot().id, 100)
    with db.transaction() as conn:
        conn.execute(
            sa.update(lot)
            .where(lot.c.state == "open")
            .values(bidding_ends_at=clock.now() - timedelta(seconds=1))
        )
    lots.tick()
    assert open_lot().question_id == "q2"
    q1_owner = sa.select(ownership.c.participant_id).where(ownership.c.question_id == "q1")
    assert scalar(q1_owner) == "a"


def test_a_question_taken_back_and_relisted_can_be_sold_again() -> None:
    add_user("a")
    add_user("b")
    start_auction("q")
    bidding.place_bid("a", open_lot().id, 100)
    lots.close_lot(open_lot().id)
    take_back_question(
        "admin", "q", refund_price=True, refund_hints=True, relist=True, reason="wrong sale"
    )
    lots.open_next_lot(1)
    bidding.place_bid("b", open_lot().id, 100)
    assert lots.close_lot(open_lot().id) == "sold"
    owner = rows(sa.select(ownership).where(ownership.c.question_id == "q"))[0]
    assert (owner.participant_id, owner.voided_at) == ("b", None)
