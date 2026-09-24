"""Phase 1 hacking with the flawed code in several languages: authoring, attempts and scoring."""

from __future__ import annotations

import itertools
from typing import Any

import pytest
import sqlalchemy as sa
from conftest import add_user, raises_code, rows, scalar, set_contest

from engine.core import db
from engine.judge import client as judge_client
from engine.packages import phase1_zip
from engine.phase1 import authoring, hack_jobs, hacking, puzzles, self_tests
from engine.schema import event, p1_hack_attempt, p1_hack_solution, participant

ORGANISER = "org"
BUGGY_CPP = "int main(){ /* cpp bug */ }"
BUGGY_PY = "print(0)  # py bug"


class FakeJudge:
    """Answers every hack the way the test says, and remembers what it was sent."""

    def __init__(self) -> None:
        self.sent: list[dict[str, Any]] = []
        self.hacked: bool = True
        self._ids = itertools.count(1)

    def hack(self, **request: Any) -> str:
        self.sent.append(request)
        return f"job-{next(self._ids)}"

    def job(self, job_id: str) -> dict[str, Any]:
        return {"state": "done", "result": self.result()}

    def result(self) -> dict[str, Any]:
        return {
            "valid_input": True,
            "invalid_reason": "",
            "hacked": self.hacked,
            "verdict": "WA" if self.hacked else "AC",
            "message": "",
        }


@pytest.fixture
def judge(monkeypatch: pytest.MonkeyPatch) -> FakeJudge:
    fake = FakeJudge()
    monkeypatch.setattr(judge_client, "hack", fake.hack)
    monkeypatch.setattr(judge_client, "job", fake.job)
    monkeypatch.setattr(judge_client, "wait_for_job", lambda job_id: fake.result())
    monkeypatch.setattr(self_tests, "latest_or_current", lambda problem_id: "v1")
    return fake


def organiser() -> None:
    if scalar(sa.text("select count(*) from \"user\" where id = 'org'")) == 0:
        add_user(ORGANISER, role="organiser", balance=None)


def new_hack(**overrides: Any) -> int:
    organiser()
    fields = {
        "title": "Sum",
        "statement_md": "add",
        "constraints_md": "",
        "problem_id": "hack-sum",
        "hack_points": 20,
        "fail_penalty": 5,
        "order_index": 0,
        "solutions": [
            {"language": "cpp", "source": BUGGY_CPP},
            {"language": "python", "source": BUGGY_PY},
        ],
    }
    fields.update(overrides)
    return authoring.create(ORGANISER, "hacking", fields, "test")


def copies_of(question_id: int) -> list[sa.Row]:
    return rows(
        sa.select(p1_hack_solution)
        .where(p1_hack_solution.c.question_id == question_id)
        .order_by(p1_hack_solution.c.order_index)
    )


def prove_all(question_id: int) -> None:
    for copy in copies_of(question_id):
        self_tests.self_test_hack(question_id, copy.id, "9 9")


def open_section() -> None:
    set_contest(phase="p1_puzzles", phase_ends_at=None)


def test_one_finish_closes_both_sections_at_the_same_moment() -> None:
    who = add_user("finisher")
    open_section()
    puzzles.finish_phase1(who)
    row = rows(sa.select(participant).where(participant.c.user_id == who))[0]
    assert row.p1_puzzles_finished_at is not None
    assert row.p1_puzzles_finished_at == row.p1_hacking_finished_at

    def attempt() -> None:
        with db.transaction() as conn:
            hacking._check_may_attempt(conn, who)

    raises_code("finished", attempt)
    set_contest(phase="review")
    raises_code("section_closed", lambda: puzzles.finish_phase1(who))


def event_names() -> list[str]:
    return [e.name for e in rows(sa.select(event).order_by(event.c.id))]


# --- authoring -------------------------------------------------------------


def test_a_question_keeps_one_copy_per_language_in_order() -> None:
    question_id = new_hack()
    assert [(c.language, c.source) for c in copies_of(question_id)] == [
        ("cpp", BUGGY_CPP),
        ("python", BUGGY_PY),
    ]


def test_a_question_needs_at_least_one_copy_and_one_per_language() -> None:
    raises_code("invalid_request", lambda: new_hack(solutions=[]))
    raises_code(
        "invalid_request",
        lambda: new_hack(
            solutions=[{"language": "cpp", "source": "a"}, {"language": "cpp", "source": "b"}]
        ),
    )


def test_readiness_needs_every_copy_proven(judge: FakeJudge) -> None:
    question_id = new_hack()
    cpp, py = copies_of(question_id)

    first = self_tests.self_test_hack(question_id, cpp.id, "1 2")
    assert first["proven"] is True and first["ready"] is False
    raises_code(
        "not_ready",
        lambda: authoring.set_published(ORGANISER, "hacking", question_id, True, "go"),
    )

    second = self_tests.self_test_hack(question_id, py.id, "3 4")
    assert second["ready"] is True
    assert [c.breaking_input for c in copies_of(question_id)] == ["1 2", "3 4"]
    assert [req["language"] for req in judge.sent] == ["cpp", "python"]


def test_editing_one_copy_loses_only_its_proof(judge: FakeJudge) -> None:
    question_id = new_hack()
    prove_all(question_id)
    cpp, py = copies_of(question_id)

    authoring.update(
        ORGANISER,
        "hacking",
        question_id,
        {
            "solutions": [
                {"id": cpp.id, "language": "cpp", "source": BUGGY_CPP},
                {"id": py.id, "language": "python", "source": "print(1)  # a different bug"},
            ]
        },
        "edit",
    )
    cpp_after, py_after = copies_of(question_id)
    assert cpp_after.proven is True and cpp_after.breaking_input == "9 9"
    assert py_after.proven is False and py_after.breaking_input == "9 9"
    assert scalar(sa.text("select ready from p1_hack_question")) is False


def test_editing_the_statement_keeps_readiness(judge: FakeJudge) -> None:
    question_id = new_hack()
    prove_all(question_id)
    authoring.update(ORGANISER, "hacking", question_id, {"title": "Sum, revised"}, "edit")
    assert scalar(sa.text("select ready from p1_hack_question")) is True


def test_removing_a_copy_keeps_the_attempts_made_on_it(judge: FakeJudge) -> None:
    question_id = new_hack()
    prove_all(question_id)
    authoring.set_published(ORGANISER, "hacking", question_id, True, "go")
    open_section()
    add_user("p1")
    cpp, py = copies_of(question_id)
    attempt_id = hacking.submit("p1", question_id, py.id, "5 5")
    hack_jobs.tick()

    authoring.update(
        ORGANISER,
        "hacking",
        question_id,
        {"solutions": [{"id": cpp.id, "language": "cpp", "source": BUGGY_CPP}]},
        "drop python",
    )
    attempt = rows(sa.select(p1_hack_attempt).where(p1_hack_attempt.c.id == attempt_id))[0]
    assert attempt.solution_id is None
    assert attempt.points_awarded == 20


def test_every_change_to_section_b_is_announced(judge: FakeJudge) -> None:
    question_id = new_hack()
    prove_all(question_id)
    authoring.update(ORGANISER, "hacking", question_id, {"title": "x"}, "edit")
    authoring.set_published(ORGANISER, "hacking", question_id, True, "go")
    authoring.reorder(ORGANISER, "hacking", [question_id], "order")
    authoring.set_published(ORGANISER, "hacking", question_id, False, "hide")
    authoring.void(ORGANISER, "hacking", question_id, "void")
    assert event_names().count("hacking") == 5


# --- attempts --------------------------------------------------------------


def test_an_attempt_runs_the_copy_the_participant_chose(judge: FakeJudge) -> None:
    question_id = new_hack()
    prove_all(question_id)
    authoring.set_published(ORGANISER, "hacking", question_id, True, "go")
    open_section()
    add_user("p1")
    _, py = copies_of(question_id)
    judge.sent.clear()

    hacking.submit("p1", question_id, py.id, "5 5")
    hack_jobs.tick()

    assert len(judge.sent) == 1
    assert judge.sent[0]["language"] == "python"
    assert judge.sent[0]["source"] == BUGGY_PY
    section = hacking.section_for("p1")
    assert section["attempts"][0]["solution_id"] == py.id
    assert [s["language"] for s in section["questions"][0]["solutions"]] == ["cpp", "python"]


def test_a_copy_must_belong_to_the_question(judge: FakeJudge) -> None:
    first = new_hack()
    second = authoring.create(
        ORGANISER,
        "hacking",
        {
            "title": "Other",
            "statement_md": "s",
            "problem_id": "hack-other",
            "hack_points": 5,
            "solutions": [{"language": "cpp", "source": "x"}],
        },
        "test",
    )
    for q in (first, second):
        prove_all(q)
        authoring.set_published(ORGANISER, "hacking", q, True, "go")
    open_section()
    add_user("p1")
    stray = copies_of(second)[0]
    raises_code("not_found", lambda: hacking.submit("p1", first, stray.id, "1 1"))


def test_the_question_scores_once_whichever_copy_is_hacked(judge: FakeJudge) -> None:
    question_id = new_hack()
    prove_all(question_id)
    authoring.set_published(ORGANISER, "hacking", question_id, True, "go")
    open_section()
    add_user("p1")
    cpp, py = copies_of(question_id)

    hacking.submit("p1", question_id, cpp.id, "1 1")
    hack_jobs.tick()
    with db.transaction() as conn:
        conn.execute(sa.update(p1_hack_attempt).values(ended_at=None))  # skip the cooldown
    hacking.submit("p1", question_id, py.id, "1 1")
    hack_jobs.tick()

    attempts = rows(sa.select(p1_hack_attempt).order_by(p1_hack_attempt.c.id))
    points = [a.points_awarded for a in attempts]
    assert points == [20, 0]


# --- zips ------------------------------------------------------------------


def test_a_zip_carries_every_copy_and_its_proof_and_comes_back(judge: FakeJudge) -> None:
    question_id = new_hack()
    prove_all(question_id)
    _, content = phase1_zip.export_one("hacking", question_id)

    out = phase1_zip.import_package(ORGANISER, content, "import", {"hack-sum"})
    new_id = out["created"][0]["id"]
    assert new_id != question_id
    copies = copies_of(new_id)
    assert [(c.language, c.source, c.proven, c.breaking_input) for c in copies] == [
        ("cpp", BUGGY_CPP, True, "9 9"),
        ("python", BUGGY_PY, True, "9 9"),
    ]
    assert scalar(sa.text(f"select ready from p1_hack_question where id = {new_id}")) is True


def test_a_zip_written_for_one_given_solution_still_imports() -> None:
    organiser()
    from engine.packages.zips import json_bytes, write_zip

    doc = {
        "format": 1,
        "type": "hack",
        "title": "Old",
        "statement_md": "s",
        "problem_id": "hack-sum",
        "given_language": "cpp",
        "given_file": "given.cpp",
        "hack_points": 10,
    }
    content = write_zip({"question.json": json_bytes(doc), "given.cpp": b"int main(){}"})
    out = phase1_zip.import_package(ORGANISER, content, "import", set())
    copies = copies_of(out["created"][0]["id"])
    assert [(c.language, c.source) for c in copies] == [("cpp", "int main(){}")]
