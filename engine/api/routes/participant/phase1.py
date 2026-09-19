"""Phase 1 for a participant: Section A answers, Section B hacks, finishing and results."""

from __future__ import annotations

from typing import Annotated, Any, Literal

from fastapi import APIRouter
from pydantic import Field

from engine.core import clock
from engine.phase1 import hacking, puzzles, results

from ...auth import Participant, SignedIn
from ...common import Body

router = APIRouter(prefix="/api/phase1")


class AnswerBody(Body):
    answer: Any = None
    explanation: Annotated[str | None, Field(max_length=20_000)] = None


class AttemptBody(Body):
    input: Annotated[str, Field(max_length=262_144)]


class FinishBody(Body):
    section: Literal["puzzles", "hacking"]


@router.get("/puzzles")
def read_puzzles(viewer: Participant) -> dict[str, Any]:
    """Section A with secrets stripped, and my current answers."""
    return puzzles.section_for(viewer.id)


@router.put("/puzzles/{question_id}/answer")
def save_answer(viewer: Participant, question_id: int, body: AnswerBody) -> dict[str, str | None]:
    """Autosaved, and revisable until the section closes."""
    puzzles.save_answer(
        viewer.id,
        question_id,
        body.answer,
        body.explanation,
        # An explicit `"answer": null` is an answer; a missing field leaves the saved one alone.
        has_answer="answer" in body.model_fields_set,
    )
    return {"saved_at": clock.iso(clock.now())}


@router.get("/hacking")
def read_hacking(viewer: Participant) -> dict[str, Any]:
    """Section B, and my attempts: valid and hacked only, never the verdict."""
    return hacking.section_for(viewer.id)


@router.post("/hacking/{question_id}/attempts", status_code=202)
def attempt_hack(viewer: Participant, question_id: int, body: AttemptBody) -> dict[str, int]:
    """A test input, never code."""
    return {"id": hacking.submit(viewer.id, question_id, body.input)}


@router.post("/finish")
def finish_section(viewer: Participant, body: FinishBody) -> dict[str, bool]:
    """The explicit finish: records the time used to break ties."""
    puzzles.finish_section(viewer.id, body.section)
    return {"ok": True}


@router.get("/leaderboard")
def read_leaderboard(viewer: SignedIn) -> dict[str, Any]:
    return results.phase1_leaderboard(viewer.role)


@router.get("/results")
def read_results(viewer: Participant) -> dict[str, Any]:
    return results.phase1_results(viewer.id)
