"""Nothing secret reaches a participant.

These are the view functions every participant-facing route goes through: if a
field is not in their output, it is not in the response.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from types import SimpleNamespace

from engine.coding.submission_views import participant_view
from engine.phase1.hacking import participant_attempt
from engine.phase1.hacking import participant_question as hack_question
from engine.phase1.puzzles import participant_question as puzzle_question

SECRET = "EXPECTED-GRAPE-GOT-MELON"  # distinctive, so a timestamp can never contain it by accident
NOW = datetime(2026, 1, 1, tzinfo=UTC)


def test_a_judgement_never_carries_jury_detail() -> None:
    row = SimpleNamespace(
        id=1,
        state="done",
        verdict="WA",
        passed=3,
        total=10,
        first_fail=3,
        max_time_ms=12.0,
        max_memory_kb=100,
        compile_output="",
        message="wrong answer on test 3",
        jury_detail=f"token 2: {SECRET}",
        progress_done=4,
        progress_total=10,
        cancelled=False,
        created_at=NOW,
        ended_at=NOW,
    )
    text = json.dumps(participant_view(row, sample_count=2))
    assert SECRET not in text and "jury" not in text.lower()


def test_a_judgement_says_sample_or_hidden_never_which_test() -> None:
    def view(first_fail: int | None) -> dict:
        row = SimpleNamespace(
            id=1, state="done", verdict="WA", passed=3, total=10, first_fail=first_fail,
            max_time_ms=1.0, max_memory_kb=1, compile_output="", message=None,
            progress_done=4, progress_total=10, cancelled=False, created_at=NOW, ended_at=NOW,
        )
        return participant_view(row, sample_count=2)

    assert "first_fail" not in view(5)
    assert view(1)["failed_on_sample"] is True
    assert view(5)["failed_on_sample"] is False
    assert view(None)["failed_on_sample"] is None


def test_a_puzzle_never_carries_its_answer_key_validator_or_model_answer() -> None:
    row = SimpleNamespace(
        id=1,
        title="t",
        body_md="b",
        category="pattern",
        kind="fill_blank",
        grading="auto",
        points=10,
        explain_points=0,
        order_index=0,
        config={},
        max_entries=100,
        format_regex=None,
        format_hint=None,
        answer_key={"accepted": [SECRET]},
        validator_py=f"# {SECRET}",
        model_answer=SECRET,
    )
    assert SECRET not in json.dumps(puzzle_question(row))


def test_a_hacking_question_never_carries_its_breaking_inputs() -> None:
    row = SimpleNamespace(
        id=1,
        title="t",
        statement_md="s",
        constraints_md="c",
        hack_points=20,
        fail_penalty=0,
        order_index=0,
        problem_id=SECRET,
    )
    copies = [
        SimpleNamespace(
            id=7,
            question_id=1,
            language="cpp",
            source="int main(){}",
            proven=True,
            breaking_input=SECRET,
        ),
        SimpleNamespace(
            id=8,
            question_id=1,
            language="python",
            source="print(1)",
            proven=False,
            breaking_input=SECRET,
        ),
    ]
    view = hack_question(row, copies)
    assert SECRET not in json.dumps(view)
    assert [s["language"] for s in view["solutions"]] == ["cpp", "python"]


def test_a_hack_attempt_never_carries_the_verdict() -> None:
    row = SimpleNamespace(
        id=1,
        question_id=1,
        solution_id=7,
        state="done",
        valid_input=True,
        invalid_reason=None,
        hacked=True,
        points_awarded=20,
        created_at=NOW,
        verdict=SECRET,
    )
    view = participant_attempt(row)
    assert "verdict" not in view and SECRET not in json.dumps(view)
