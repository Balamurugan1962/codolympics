"""Deleting a question outright, only while nothing has happened to it."""

from __future__ import annotations

import sqlalchemy as sa
from conftest import add_question, add_user, raises_code, rows, scalar
from test_hacking import new_hack

from engine.admin import corrections
from engine.core import db
from engine.packages import volume
from engine.phase1 import authoring
from engine.schema import (
    hint,
    lot,
    ownership,
    p1_answer,
    p1_hack_attempt,
    p1_hack_question,
    p1_question,
    question,
    submission,
)

ORG = "boss"


def _org() -> None:
    if scalar(sa.text("select count(*) from \"user\" where id = 'boss'")) == 0:
        add_user(ORG, role="admin", balance=None)


def _puzzle() -> int:
    _org()
    return authoring.create(
        ORG,
        "puzzles",
        {
            "title": "p",
            "body_md": "b",
            "category": "pattern",
            "kind": "fill_blank",
            "grading": "auto",
            "points": 5,
            "explain_points": 0,
            "order_index": 0,
            "config": {"caseSensitive": False},
            "answer_key": {"accepted": ["x"]},
        },
        "test",
    )


def _count(table: sa.Table) -> int:
    return scalar(sa.select(sa.func.count()).select_from(table))


def test_a_puzzle_nobody_answered_can_be_deleted_even_when_published() -> None:
    qid = _puzzle()
    with db.transaction() as conn:
        conn.execute(sa.update(p1_question).values(published=True, ready=True))
    authoring.delete_question(ORG, "puzzles", qid, "duplicate")
    assert _count(p1_question) == 0


def test_a_puzzle_someone_answered_must_be_voided_instead() -> None:
    qid = _puzzle()
    add_user("alice")
    with db.transaction() as conn:
        conn.execute(
            sa.insert(p1_answer).values(participant_id="alice", question_id=qid, answer="x")
        )
    raises_code("has_history", lambda: authoring.delete_question(ORG, "puzzles", qid, "oops"))
    assert _count(p1_question) == 1


def test_a_hacking_question_can_be_deleted_until_someone_attempts_it() -> None:
    _org()
    keep = new_hack()
    attempted = new_hack()
    add_user("bob")
    with db.transaction() as conn:
        solution = conn.execute(
            sa.text("select id from p1_hack_solution where question_id = :q limit 1"),
            {"q": attempted},
        ).scalar()
        conn.execute(
            sa.insert(p1_hack_attempt).values(
                participant_id="bob",
                question_id=attempted,
                solution_id=solution,
                input="1",
                state="done",
            )
        )
    authoring.delete_question(ORG, "hacking", keep, "duplicate")
    raises_code("has_history", lambda: authoring.delete_question(ORG, "hacking", attempted, "no"))
    assert [r.id for r in rows(sa.select(p1_hack_question))] == [attempted]


def test_a_fresh_question_is_deleted_with_its_hints_and_unopened_lots() -> None:
    _org()
    add_question("fresh")
    with db.transaction() as conn:
        conn.execute(sa.insert(hint).values(question_id="fresh", idx=0, price=10, body_md="h"))
        conn.execute(sa.insert(lot).values(question_id="fresh", round=1, order=1, state="pending"))
    result = corrections.delete_question(ORG, "fresh", "not needed")
    assert result == {"lots": 1}
    assert _count(question) == 0 and _count(hint) == 0 and _count(lot) == 0


def test_the_judge_package_goes_only_when_asked() -> None:
    _org()
    for pid, remove in (("keep-pkg", False), ("drop-pkg", True)):
        add_question(pid)
        base = volume.dir_for(pid, "v1")
        base.mkdir(parents=True, exist_ok=True)
        (base / "problem.json").write_text("{}")
        corrections.delete_question(ORG, pid, "cleanup", remove_package=remove)
    assert volume.dir_for("keep-pkg").is_dir()
    assert not volume.dir_for("drop-pkg").exists()
    volume.delete_package("keep-pkg")


def test_a_question_with_history_must_be_voided() -> None:
    _org()
    add_user("carol")
    add_question("sold")
    with db.transaction() as conn:
        conn.execute(
            sa.insert(ownership).values(question_id="sold", participant_id="carol", price_paid=50)
        )
    raises_code("has_history", lambda: corrections.delete_question(ORG, "sold", "no"))
    add_question("tried", order=2)
    with db.transaction() as conn:
        conn.execute(
            sa.insert(submission).values(
                participant_id="carol", question_id="tried", language="cpp", source="x"
            )
        )
    raises_code("has_history", lambda: corrections.delete_question(ORG, "tried", "no"))
    add_question("offered", order=3)
    with db.transaction() as conn:
        conn.execute(sa.insert(lot).values(question_id="offered", round=1, order=1, state="closed"))
    raises_code("has_history", lambda: corrections.delete_question(ORG, "offered", "no"))
    assert _count(question) == 3
