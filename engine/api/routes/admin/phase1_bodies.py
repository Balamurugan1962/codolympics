"""Request bodies for authoring Phase 1 questions.

A puzzle and a hacking question share one URL shape, `/api/admin/phase1/{section}`,
so the body is validated here once the section is known.
"""

from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import Field

from engine.core import errors
from engine.schema import P1_CATEGORIES, P1_GRADING, P1_KINDS

from ...common import Body, ProblemId, Reason

Category = Literal[P1_CATEGORIES]  # type: ignore[valid-type]
Kind = Literal[P1_KINDS]  # type: ignore[valid-type]
Grading = Literal[P1_GRADING]  # type: ignore[valid-type]


class PuzzleConfig(Body):
    options: list[str] | None = None
    items: list[str] | None = None
    partialCredit: bool | None = None
    tolerance: Annotated[float | None, Field(ge=0)] = None
    caseSensitive: bool | None = None


class AnswerKey(Body):
    option: int | None = None
    options: list[int] | None = None
    accepted: list[str] | None = None
    value: float | None = None
    order: list[int] | None = None
    members: list[str] | None = None


class PuzzleBody(Body):
    reason: Reason
    title: Annotated[str, Field(min_length=1, max_length=200)]
    body_md: Annotated[str, Field(max_length=100_000)]
    category: Category
    kind: Kind
    grading: Grading
    points: Annotated[int, Field(ge=0)]
    explain_points: Annotated[int, Field(ge=0)] = 0
    order_index: Annotated[int, Field(ge=0)] = 0
    config: PuzzleConfig = PuzzleConfig()
    answer_key: AnswerKey | None = None
    model_answer: Annotated[str | None, Field(max_length=20_000)] = None
    validator_py: Annotated[str | None, Field(max_length=100_000)] = None
    points_per_entry: Annotated[int | None, Field(ge=0)] = None
    max_entries: Annotated[int, Field(ge=1, le=1000)] = 100
    format_regex: Annotated[str | None, Field(max_length=500)] = None
    format_hint: Annotated[str | None, Field(max_length=200)] = None


class GivenSolution(Body):
    """One copy of the flawed code. `id` names an existing copy, so an unchanged
    one keeps its proof."""

    id: int | None = None
    language: Annotated[str, Field(min_length=1, max_length=32)]
    source: Annotated[str, Field(min_length=1, max_length=262_144)]


class HackBody(Body):
    reason: Reason
    title: Annotated[str, Field(min_length=1, max_length=200)]
    statement_md: Annotated[str, Field(max_length=100_000)]
    constraints_md: Annotated[str, Field(max_length=20_000)] = ""
    problem_id: ProblemId
    solutions: Annotated[list[GivenSolution], Field(min_length=1, max_length=12)]
    hack_points: Annotated[int, Field(ge=0)]
    fail_penalty: Annotated[int, Field(ge=0)] = 0
    order_index: Annotated[int, Field(ge=0)] = 0


class PuzzleTrial(Body):
    answer: Any = None
    should_pass: list[str] | None = None
    should_fail: list[str] | None = None


class HackTrial(Body):
    solution_id: int
    breaking_input: Annotated[str, Field(max_length=262_144)]


def question_fields(section: str, raw: dict[str, Any]) -> tuple[dict[str, Any], str]:
    """Validate a create or update body for its section. Returns (fields, reason)."""
    if section == "puzzles":
        return _puzzle_fields(PuzzleBody.model_validate(raw))
    if section == "hacking":
        hack = HackBody.model_validate(raw)
        return hack.model_dump(exclude={"reason"}), hack.reason
    raise errors.not_found("section")


def _puzzle_fields(puzzle: PuzzleBody) -> tuple[dict[str, Any], str]:
    values = puzzle.model_dump(exclude={"reason"})
    # Nested objects keep only the keys the author set, as they were stored before.
    values["config"] = puzzle.config.model_dump(exclude_none=True)
    if puzzle.answer_key:
        values["answer_key"] = puzzle.answer_key.model_dump(exclude_none=True)
    return values, puzzle.reason
