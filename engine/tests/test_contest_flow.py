"""Phases, the event feed, hints, registration and Phase 1 scoring."""

from __future__ import annotations

import sqlalchemy as sa
from conftest import (
    add_question,
    add_user,
    at_once,
    balance_of,
    codes,
    raises_code,
    rows,
    set_contest,
)

from engine.accounts import credentials, registration
from engine.coding import hints
from engine.contest import phases
from engine.core import clock, db, events
from engine.phase1 import selection
from engine.phase1.answers import distinct_entries, normalise_answer, score_auto
from engine.schema import announcement, contest, hint, ownership, user

# --- phases -----------------------------------------------------------------------


def test_two_organisers_advancing_together_move_the_contest_one_phase() -> None:
    add_user("alice")
    # coding1 -> auction2 has no checks to wait on
    set_contest(phase="coding1", registration_open=False)
    calls = [lambda: phases.advance("admin", "go", acknowledge_warnings=True) for _ in range(4)]
    results = at_once(calls)
    assert results.count("auction2") == 1
    assert set(codes(results)) <= {"phase_changed"}
    assert rows(sa.select(contest.c.phase))[0].phase == "auction2"


def test_advancing_is_blocked_while_registration_is_open() -> None:
    add_user("alice")
    raises_code("blocked", lambda: phases.advance("admin", "go"))


def test_extending_a_round_moves_the_deadline_and_tells_everyone() -> None:
    set_contest(phase="coding1", phase_ends_at=clock.seconds_from_now(60))
    with db.transaction() as conn:
        start = events.cursor(conn)

    phases.extend("admin", 10, "more time")

    ends_at = rows(sa.select(contest.c.phase_ends_at))[0].phase_ends_at
    assert 600 < (ends_at - clock.now()).total_seconds() <= 660
    posted = rows(sa.select(announcement.c.body_md))
    assert len(posted) == 1
    assert posted[0].body_md.startswith("**Coding round 1 has been extended by 10 minutes.**")
    names = [e["name"] for e in events.since("alice", start)["events"]]
    assert names == ["phase", "announce"]


def test_a_round_without_a_deadline_cannot_be_extended() -> None:
    set_contest(phase="registration", phase_ends_at=None)
    raises_code("no_deadline", lambda: phases.extend("admin", 10, "more time"))
    assert rows(sa.select(announcement.c.id)) == []


# --- the event feed ----------------------------------------------------------------


def test_a_viewer_sees_broadcasts_and_their_own_events_only() -> None:
    with db.transaction() as conn:
        start = events.cursor(conn)
    events.publish("announce", {"body_md": "hello"})
    events.publish("balance", {"balance": 5}, "alice")
    events.publish("balance", {"balance": 9}, "bob")
    feed = events.since("alice", start)
    seen = [(e["name"], e["data"].get("balance")) for e in feed["events"]]
    assert seen == [("announce", None), ("balance", 5)]
    assert feed["cursor"] >= start + 3 and feed["reset"] is False
    assert events.since("alice", feed["cursor"])["events"] == []


def test_concurrent_publishers_never_leave_a_gap_behind_the_cursor() -> None:
    at_once([lambda i=i: events.publish("tick", {"i": i}) for i in range(30)])
    feed = events.since("anyone", 0)
    ids = [e["id"] for e in feed["events"]]
    assert ids == sorted(ids) and len(ids) == 30


# --- hints ---------------------------------------------------------------------------


def _owned_question_with_hints() -> None:
    set_contest(phase="coding1")
    add_user("alice")
    add_question("q")
    with db.transaction() as conn:
        conn.execute(
            sa.insert(ownership).values(question_id="q", participant_id="alice", price_paid=100)
        )
        conn.execute(
            sa.insert(hint),
            [
                {"question_id": "q", "idx": 0, "price": 30, "body_md": "one"},
                {"question_id": "q", "idx": 1, "price": 40, "body_md": "two"},
            ],
        )


def test_a_double_clicked_hint_purchase_buys_one_hint() -> None:
    _owned_question_with_hints()
    results = at_once([lambda: hints.buy_hint("alice", "q", 0) for _ in range(5)])
    assert sum(1 for r in results if isinstance(r, dict) and not r["replayed"]) == 1
    assert balance_of("alice") == 970


def test_hints_unlock_in_order_and_run_out() -> None:
    _owned_question_with_hints()
    assert hints.buy_hint("alice", "q")["idx"] == 0
    raises_code("hint_order", lambda: hints.buy_hint("alice", "q", 0 + 5))
    assert hints.buy_hint("alice", "q", 1)["body_md"] == "two"
    raises_code("no_more_hints", lambda: hints.buy_hint("alice", "q"))
    assert balance_of("alice") == 930


# --- accounts ---------------------------------------------------------------------------


def test_two_people_registering_one_name_at_once_get_one_account() -> None:
    def register_same_name() -> str:
        return registration.register_participant("Same Name", "password123", "cpp")

    results = at_once([register_same_name for _ in range(5)])
    assert sum(isinstance(r, str) for r in results) == 1
    assert set(codes(results)) == {"name_taken"}
    person = rows(sa.select(user).where(user.c.username == "same_name"))[0]
    assert (person.display_username, person.role) == ("Same Name", "participant")
    # Coins arrive with Phase 2, not with the account.
    assert balance_of(person.id) == 0


def test_coins_arrive_when_phase_2_selection_is_made() -> None:
    through = registration.register_participant("Through", "password123", "cpp")
    out = registration.register_participant("Out", "password123", "cpp")
    assert balance_of(through) == balance_of(out) == 0

    selection.set_advancement("admin", [through], "top of the board")
    assert balance_of(through) == 1000
    assert balance_of(out) == 0

    # Revising the same selection pays nobody twice.
    selection.set_advancement("admin", [through], "unchanged")
    assert balance_of(through) == 1000

    # Dropped, so the coins go back; put through again, and they return.
    selection.set_advancement("admin", [out], "swapped")
    assert (balance_of(through), balance_of(out)) == (0, 1000)
    selection.set_advancement("admin", [through, out], "both after all")
    assert (balance_of(through), balance_of(out)) == (1000, 1000)


def test_registration_is_refused_once_closed() -> None:
    set_contest(registration_open=False)
    raises_code(
        "registration_closed",
        lambda: registration.register_participant("late", "password123", None),
    )


def test_a_password_hash_has_better_auths_shape() -> None:
    salt, key = credentials.hash_password("password123").split(":")
    assert len(salt) == 32 and len(key) == 128


# --- Phase 1 auto scoring (pure) --------------------------------------------------------


class Q:
    def __init__(self, **kw: object) -> None:
        defaults = {
            "id": 1,
            "points": 10,
            "kind": "fill_blank",
            "grading": "auto",
            "config": {},
            "answer_key": None,
            "format_regex": None,
            "format_hint": None,
            "max_entries": 100,
        }
        self.__dict__.update(defaults | kw)


def test_auto_scoring_matches_each_kind() -> None:
    single = Q(kind="mcq_single", config={"options": ["a", "b"]}, answer_key={"option": 1})
    assert score_auto(single, 1) == 10
    multi = Q(
        kind="mcq_multi",
        config={"options": list("abcd"), "partialCredit": True},
        answer_key={"options": [0, 2]},
    )
    assert (
        score_auto(multi, [0, 2]) == 10
        and score_auto(multi, [0]) == 5
        and score_auto(multi, [0, 1]) == 0
    )
    assert score_auto(Q(answer_key={"accepted": ["Paris"]}), "  paris ") == 10
    numeric = Q(kind="numeric", config={"tolerance": 0.5}, answer_key={"value": 3})
    assert score_auto(numeric, "3.4") == 10
    sequence = Q(kind="sequence", config={"items": list("abc")}, answer_key={"order": [2, 0, 1]})
    assert score_auto(sequence, [2, 0, 1]) == 10


def test_normalising_enforces_shape_and_format() -> None:
    numbers_only = Q(format_regex=r"^\d+$", format_hint="a number")
    raises_code("invalid_request", lambda: normalise_answer(numbers_only, "forty"))
    sequence = Q(kind="sequence", config={"items": list("ab")})
    raises_code("invalid_request", lambda: normalise_answer(sequence, [0, 0]))
    multi = Q(kind="mcq_multi", config={"options": list("abc")})
    assert normalise_answer(multi, [2, 0, 2, 9]) == [0, 2]


def test_distinct_entries_collapse_case_and_space() -> None:
    assert distinct_entries(Q(kind="set"), ["5239", " 5239 ", "abc", "ABC"]) == ["5239", "abc"]


def test_phase_one_is_a_single_window() -> None:
    from engine.contest.rules import next_phase

    assert next_phase("registration") == "p1_puzzles"
    assert next_phase("p1_puzzles") == "review"
    assert next_phase("ended") is None
