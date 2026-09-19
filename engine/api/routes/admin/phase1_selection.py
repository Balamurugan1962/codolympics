"""Phase 1 results for the organisers: the standings, who advances, and score overrides."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter
from pydantic import Field

from engine.phase1 import authoring, selection, standings

from ...auth import Admin, Staff
from ...common import ReasonBody

router = APIRouter(prefix="/api/admin/phase1")

Score = Annotated[int | None, Field(ge=0)]


class AdvanceBody(ReasonBody):
    participant_ids: list[str]


class OverrideBody(ReasonBody):
    participant_id: str
    question_id: int
    auto_score: Score = None
    manual_score: Score = None
    explain_score: Score = None


@router.get("/advance")
def read_standings(_: Staff) -> dict[str, Any]:
    return {"standings": standings.standings()}


@router.post("/advance")
def select_advancing(viewer: Admin, body: AdvanceBody) -> dict[str, bool]:
    """The full set each time; revisable until Phase 2 opens."""
    selection.set_advancement(viewer.id, body.participant_ids, body.reason)
    return {"ok": True}


@router.post("/override")
def override_score(viewer: Admin, body: OverrideBody) -> dict[str, bool]:
    authoring.override_score(
        viewer.id,
        body.participant_id,
        body.question_id,
        body.reason,
        auto_score=body.auto_score,
        manual_score=body.manual_score,
        explain_score=body.explain_score,
    )
    return {"ok": True}
