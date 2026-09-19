"""The organisers' controls over a running auction, against a real Postgres."""

from __future__ import annotations

import time
from datetime import timedelta

import sqlalchemy as sa
from conftest import add_question, add_user, at_once, balance_of, raises_code, rows, set_contest

from engine.auction import bidding, control, lot_queue, lots, takeback
from engine.core import clock, db
from engine.schema import bid, hint_purchase, ledger, lot, ownership, participant, question


def open_lot() -> sa.Row:
    return rows(sa.select(lot).where(lot.c.state == "open"))[0]


def setup_round() -> None:
    set_contest(phase="auction1")
    add_user("alice")
    add_user("bob")
    add_question("q1", order=1)
    add_question("q2", order=2)
    with db.transaction() as conn:
        lots.create_lots_for_round(conn, 1)


def test_pause_gives_back_exactly_the_time_it_held() -> None:
    setup_round()
    lots.open_next_lot(1)
    bidding.place_bid("alice", open_lot().id, 100)
    before = open_lot().bidding_ends_at
    control.pause("admin", "projector died")
    time.sleep(1.2)
    held = control.resume("admin", "back on")
    moved_ms = clock.ms(open_lot().bidding_ends_at) - clock.ms(before)
    assert held >= 1100
    assert held - 200 < moved_ms < held + 400


def test_while_paused_bids_are_refused_and_nothing_settles() -> None:
    setup_round()
    lots.open_next_lot(1)
    lot_id = open_lot().id
    control.pause("admin", "hold")
    raises_code("auction_paused", lambda: bidding.place_bid("alice", lot_id, 100))
    with db.transaction() as conn:
        conn.execute(
            sa.update(lot)
            .where(lot.c.id == lot_id)
            .values(no_bid_deadline=clock.now() - timedelta(seconds=5))
        )
    lots.tick()
    assert open_lot().id == lot_id
    control.resume("admin", "resume")
    lots.tick()
    assert rows(sa.select(lot.c.state).where(lot.c.id == lot_id))[0].state == "unsold"
    assert open_lot().question_id == "q2"


def test_a_double_pause_and_a_resume_never_paused_are_refused() -> None:
    setup_round()
    raises_code("not_paused", lambda: control.resume("admin", "x"))
    control.pause("admin", "hold")
    raises_code("already_paused", lambda: control.pause("admin", "again"))


def test_two_organisers_pausing_at_once_pause_once() -> None:
    setup_round()
    results = at_once([lambda: control.pause("admin", "hold") for _ in range(5)])
    assert results.count(None) == 1


def test_withdrawing_the_open_lot_sells_nothing_and_moves_on() -> None:
    setup_round()
    lots.open_next_lot(1)
    first = open_lot()
    bidding.place_bid("alice", first.id, 100)
    lot_queue.withdraw_lot("admin", first.id, "package is broken")
    assert rows(sa.select(lot.c.state).where(lot.c.id == first.id))[0].state == "withdrawn"
    assert rows(sa.select(ownership)) == []
    assert balance_of("alice") == 1000
    assert len(rows(sa.select(bid))) == 1  # kept, for the record
    assert open_lot().question_id == "q2"


def test_a_restored_lot_goes_to_the_end_of_the_queue() -> None:
    setup_round()
    first = rows(sa.select(lot).where(lot.c.question_id == "q1"))[0]
    lot_queue.withdraw_lot("admin", first.id, "pulled")
    lot_queue.restore_lot("admin", first.id, "fixed")
    back = rows(sa.select(lot).where(lot.c.id == first.id))[0]
    assert (back.state, back.order) == ("pending", 3)


def test_a_settled_lot_cannot_be_withdrawn() -> None:
    setup_round()
    lots.open_next_lot(1)
    lot_id = open_lot().id
    bidding.place_bid("alice", lot_id, 100)
    lots.close_lot(lot_id)
    raises_code("already_settled", lambda: lot_queue.withdraw_lot("admin", lot_id, "too late"))


def test_retracting_the_top_bid_restores_the_previous_bidder() -> None:
    setup_round()
    lots.open_next_lot(1)
    lot_id = open_lot().id
    bidding.place_bid("alice", lot_id, 100)
    bidding.place_bid("bob", lot_id, 110)
    assert control.retract_top_bid("admin", "misclick") == {"removed": 110, "bidder": "bob"}
    now_open = open_lot()
    assert (now_open.current_bid, now_open.current_bidder_id) == (100, "alice")
    assert balance_of("alice") == balance_of("bob") == 1000


def test_retracting_the_only_bid_returns_to_the_opening_window() -> None:
    setup_round()
    lots.open_next_lot(1)
    bidding.place_bid("alice", open_lot().id, 100)
    control.retract_top_bid("admin", "misclick")
    now_open = open_lot()
    assert now_open.current_bid is None and now_open.no_bid_deadline is not None


def _sell_q1_to_alice_with_a_hint() -> None:
    setup_round()
    lots.open_next_lot(1)
    lot_id = open_lot().id
    bidding.place_bid("alice", lot_id, 100)
    lots.close_lot(lot_id)
    with db.transaction() as conn:
        conn.execute(
            sa.insert(hint_purchase).values(
                question_id="q1", hint_idx=0, participant_id="alice", price_paid=25
            )
        )
        conn.execute(
            sa.update(participant)
            .where(participant.c.user_id == "alice")
            .values(balance=participant.c.balance - 25)
        )


def test_taking_back_refunds_price_and_hints_and_relists() -> None:
    _sell_q1_to_alice_with_a_hint()
    assert balance_of("alice") == 875
    out = takeback.take_back_question(
        "admin", "q1", refund_price=True, refund_hints=True, relist=True, reason="wrong sale"
    )
    assert out["refunded"] == 125 and balance_of("alice") == 1000
    assert rows(sa.select(hint_purchase)) == []
    assert rows(sa.select(question.c.status).where(question.c.id == "q1"))[0].status == "unsold"
    relisted = rows(sa.select(lot).where(lot.c.question_id == "q1"))[0]
    assert (relisted.state, relisted.current_bid) == ("pending", None)
    alice_ledger = rows(sa.select(ledger).where(ledger.c.participant_id == "alice"))
    refund = [r for r in alice_ledger if r.reason == "refund"][0]
    assert (refund.delta, refund.ref) == (125, "takeback:q1")


def test_taking_back_without_refund_or_relist() -> None:
    _sell_q1_to_alice_with_a_hint()
    out = takeback.take_back_question(
        "admin", "q1", refund_price=False, refund_hints=False, relist=False, reason="keep"
    )
    assert out["refunded"] == 0 and balance_of("alice") == 875
    assert len(rows(sa.select(hint_purchase))) == 1
    assert rows(sa.select(lot.c.state).where(lot.c.question_id == "q1"))[0].state == "closed"


def test_taking_back_something_nobody_owns_is_refused() -> None:
    setup_round()
    raises_code(
        "not_owned",
        lambda: takeback.take_back_question(
            "admin", "q1", refund_price=True, refund_hints=True, relist=False, reason="x"
        ),
    )
