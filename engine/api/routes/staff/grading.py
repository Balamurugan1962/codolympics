"""The evaluators' routes: the grading queue, grading an answer, and hack attempts in full."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter
from pydantic import Field

from engine.admin import records
from engine.phase1 import grading

from ...auth import Staff
from ...common import Body

router = APIRouter(prefix="/api/grade")

Score = Annotated[int | None, Field(ge=0)]


class GradeBody(Body):
    participant_id: str
    question_id: int
    manual_score: Score = None
    explain_score: Score = None
    comment: Annotated[str | None, Field(max_length=2000)] = None
    flagged: bool | None = None


@router.get("/queue")
def read_queue(_: Staff) -> dict[str, Any]:
    return grading.grading_queue()


@router.post("")
def grade_answer(viewer: Staff, body: GradeBody) -> dict[str, bool]:
    grading.grade(
        viewer.id,
        body.participant_id,
        body.question_id,
        manual_score=body.manual_score,
        explain_score=body.explain_score,
        comment=body.comment,
        flagged=body.flagged,
    )
    return {"ok": True}


@router.get("/hacks")
def read_hack_attempts(_: Staff) -> dict[str, Any]:
    return {"attempts": records.hack_attempts()}
