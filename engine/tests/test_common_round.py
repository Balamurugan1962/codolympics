"""The common round: what nobody bought is open to everyone, and what was bought is closed."""

from __future__ import annotations

from datetime import timedelta

import sqlalchemy as sa
from conftest import add_question, add_user, raises_code, set_contest
from test_submissions import FakeJudge, current, judge  # noqa: F401 (the judge fixture)

from engine.coding import judging, questions, scoring, submissions
from engine.contest import phase_checks, rules
from engine.core import clock, db
from engine.schema import ownership, p1_advancement, question


def _select(*people: str) -> None:
    with db.transaction() as conn:
        for who in people:
            conn.execute(
                sa.insert(p1_advancement).values(
                    participant_id=who, advanced=True, decided_by="admin", reason="test"
                )
            )


def _final(started_ago_s: int = 600) -> None:
    set_contest(phase="final", final_started_at=clock.now() - timedelta(seconds=started_ago_s))


def _sell(question_id: str, to: str) -> None:
    with db.transaction() as conn:
        conn.execute(sa.update(question).where(question.c.id == question_id).values(status="sold"))
        conn.execute(
            sa.insert(ownership).values(question_id=question_id, participant_id=to, price_paid=50)
        )


def test_the_phase_after_coding_1_is_the_common_round() -> None:
    assert rules.next_phase("coding1") == "final"
    assert rules.next_phase("auction1") == "coding1"


def test_everyone_may_submit_to_an_unsold_question_in_the_common_round(judge: FakeJudge) -> None:  # noqa: F811
    add_question("open", order=2)
    add_user("bob")
    add_user("carol")
    _select("bob")
    _final()
    assert isinstance(submissions.submit("bob", "open", "cpp", "x"), int)
    raises_code(
        "forbidden", lambda: submissions.submit("carol", "open", "cpp", "x")
    )  # not selected


def test_what_was_bought_in_round_1_is_closed_even_to_its_owner(judge: FakeJudge) -> None:  # noqa: F811
    _select("alice")
    with db.transaction() as conn:  # the fixture already made alice its owner
        conn.execute(sa.update(question).where(question.c.id == "q").values(status="sold"))
    _final()
    raises_code("forbidden", lambda: submissions.submit("alice", "q", "cpp", "x"))


def test_a_voided_question_is_not_in_the_common_round(judge: FakeJudge) -> None:  # noqa: F811
    add_question("gone", order=2)
    with db.transaction() as conn:
        conn.execute(sa.update(question).where(question.c.id == "gone").values(status="void"))
    _select("alice")
    _final()
    raises_code("forbidden", lambda: submissions.submit("alice", "gone", "cpp", "x"))


def test_the_common_list_shows_every_unsold_question_and_hides_topic_tier_and_points() -> None:
    add_question("a", order=1)
    add_question("b", order=2)
    add_question("sold", order=3)
    add_user("bob")
    add_user("dan")
    _sell("sold", "bob")
    _select("bob")
    _final()
    with db.transaction() as conn:
        assert questions.working_questions(conn, "dan") == []  # not selected
        listed = questions.working_questions(conn, "bob")
    assert [q["id"] for q in listed] == ["a", "b"]
    assert all(q["difficulty"] is None and q["score"] is None and q["common"] for q in listed)
    shown = questions.for_owner("bob", "a")
    assert shown["difficulty"] is None and shown["score"] is None and shown["common"] is True
    assert "topic" not in shown


def test_common_solves_add_to_round_1_points_and_are_timed_from_the_round_start(
    judge: FakeJudge,  # noqa: F811
) -> None:
    add_question("open", order=2, score=300)
    with db.transaction() as conn:
        conn.execute(sa.update(ownership).values(awarded_at=clock.now() - timedelta(hours=3)))
    first = submissions.submit("alice", "q", "cpp", "x")
    judge.finish(current(first).job_id, "AC")
    judging.poll_in_flight()
    _select("alice")
    _final(started_ago_s=900)
    with db.transaction() as conn:
        conn.execute(sa.text("update participant set last_judgement_ended_at = null"))
    second = submissions.submit("alice", "open", "cpp", "x")
    judge.finish(current(second).job_id, "AC")
    judging.poll_in_flight()
    standing = next(s for s in scoring.for_staff()["phase2"] if s["participant_id"] == "alice")
    assert standing["score"] == 100 + 300 and standing["solved"] == 2
    # 3 hours from the purchase for one solve, 15 minutes from the round start for the other
    expected_ms = (3 * 3600 + 900) * 1000
    assert abs(standing["total_time_ms"] - expected_ms) < 60_000


def test_entering_the_common_round_needs_an_unsold_question_and_says_what_closes() -> None:
    set_contest(phase="coding1")
    with db.transaction() as conn:
        blockers, _ = phase_checks._checks_for(conn, _contest(conn), "final", {})
    assert any("would be empty" in b for b in blockers)
    add_question("left")
    with db.transaction() as conn:
        blockers, warnings = phase_checks._checks_for(conn, _contest(conn), "final", {})
    assert not blockers and any("open to everyone" in w for w in warnings)


def _contest(conn: sa.Connection) -> sa.Row:
    from engine.contest.rules import get_contest

    return get_contest(conn)
