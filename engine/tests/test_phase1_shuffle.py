"""Every participant sees the Phase 1 questions in an order of their own."""

from __future__ import annotations

from types import SimpleNamespace

from conftest import add_user, set_contest

from engine.core import db
from engine.phase1 import hacking, puzzles
from engine.phase1.shuffle import for_participant
from engine.schema import p1_hack_question, p1_question


def _rows(n: int) -> list[SimpleNamespace]:
    return [SimpleNamespace(id=i) for i in range(1, n + 1)]


def test_the_order_is_stable_for_one_person_and_differs_between_people() -> None:
    rows = _rows(15)
    alice = [r.id for r in for_participant(rows, "alice", "puzzles")]
    assert alice == [r.id for r in for_participant(list(reversed(rows)), "alice", "puzzles")]
    assert sorted(alice) == list(range(1, 16))
    others = {tuple(r.id for r in for_participant(rows, f"p{i}", "puzzles")) for i in range(20)}
    assert len(others) == 20
    assert alice != [r.id for r in for_participant(rows, "alice", "hacking")]


def test_a_question_added_later_does_not_move_the_others() -> None:
    before = [r.id for r in for_participant(_rows(10), "bob", "puzzles")]
    after = [r.id for r in for_participant(_rows(11), "bob", "puzzles") if r.id != 11]
    assert before == after


def _puzzle(i: int) -> dict[str, object]:
    return {
        "title": f"P{i}",
        "body_md": "b",
        "category": "pattern",
        "kind": "mcq_single",
        "grading": "auto",
        "points": 1,
        "config": {"options": ["a", "b"]},
        "answer_key": {"option": 0},
        "published": True,
        "order_index": i,
    }


def test_sections_list_each_participant_their_own_order() -> None:
    add_user("alice")
    add_user("bob")
    with db.transaction() as conn:
        for i in range(12):
            conn.execute(p1_question.insert().values(**_puzzle(i)))
            conn.execute(
                p1_hack_question.insert().values(
                    title=f"H{i}",
                    statement_md="s",
                    problem_id="hack-x",
                    hack_points=10,
                    published=True,
                    order_index=i,
                )
            )
    set_contest(phase="p1_puzzles")
    a = [q["id"] for q in puzzles.section_for("alice")["questions"]]
    b = [q["id"] for q in puzzles.section_for("bob")["questions"]]
    assert sorted(a) == sorted(b) and a != b
    assert a == [q["id"] for q in puzzles.section_for("alice")["questions"]]
    ha = [q["id"] for q in hacking.section_for("alice")["questions"]]
    hb = [q["id"] for q in hacking.section_for("bob")["questions"]]
    assert sorted(ha) == sorted(hb) and ha != hb
