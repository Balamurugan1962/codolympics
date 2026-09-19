"""Phase 2 questions: their details and running order, and the repairs an organiser can make."""

from __future__ import annotations

from typing import Annotated, Any, Literal

from fastapi import APIRouter
from pydantic import Field

from engine.admin import corrections
from engine.auction import sales
from engine.coding import question_authoring, rejudge
from engine.schema import DIFFICULTIES

from ...auth import Admin, Staff
from ...common import Body, ProblemId, ReasonBody, fields

router = APIRouter(prefix="/api/admin/questions")

Difficulty = Literal[DIFFICULTIES]  # type: ignore[valid-type]


class HintInput(Body):
    price: Annotated[int, Field(ge=0)]
    body_md: Annotated[str, Field(max_length=20_000)]


class QuestionBody(ReasonBody):
    id: ProblemId
    title: Annotated[str, Field(min_length=1, max_length=200)]
    # What the room is told it is bidding on. The title is not.
    topic: Annotated[str, Field(max_length=80)] = ""
    difficulty: Difficulty
    score: Annotated[int, Field(ge=0)]
    base_price: Annotated[int, Field(ge=0)]
    statement_md: Annotated[str, Field(max_length=200_000)]
    sample_count: Annotated[int, Field(ge=0, le=20)]
    auction_order: Annotated[int, Field(ge=0)]
    hints: Annotated[list[HintInput], Field(max_length=20)]


class OrderBody(ReasonBody):
    ids: Annotated[list[str], Field(max_length=500)]


class VoidBody(ReasonBody):
    refund_price: bool = True
    refund_hints: bool = True


class OutcomeBody(ReasonBody):
    outcome: Literal["stand", "refund", "void"]


class AssignBody(ReasonBody):
    participant_id: str
    price: Annotated[int, Field(ge=0)]


class TransferBody(ReasonBody):
    participant_id: str


@router.get("")
def list_questions(_: Staff) -> dict[str, Any]:
    return {"questions": question_authoring.admin_list()}


@router.post("")
def save_question(viewer: Staff, body: QuestionBody) -> dict[str, bool]:
    """The contest-facing side of a question: form fields, not the judge package."""
    details = fields(body, exclude=("reason", "hints"))
    hints = [hint.model_dump() for hint in body.hints]
    question_authoring.upsert(viewer.id, details, hints, body.reason)
    return {"ok": True}


@router.post("/order")
def reorder_questions(viewer: Admin, body: OrderBody) -> dict[str, bool]:
    """Administrators only: bidders plan their money around the published order."""
    question_authoring.reorder(viewer.id, body.ids, body.reason)
    return {"ok": True}


@router.post("/{question_id}/void")
def void_question(viewer: Admin, question_id: str, body: VoidBody) -> dict[str, bool]:
    corrections.void_question(
        viewer.id, question_id, body.reason, body.refund_price, body.refund_hints
    )
    return {"ok": True}


@router.post("/{question_id}/rejudge")
def rejudge_question(viewer: Admin, question_id: str, body: ReasonBody) -> dict[str, int]:
    return {"rejudged": rejudge.rejudge_question(question_id, viewer.id, body.reason)}


@router.post("/{question_id}/rejudge-outcome")
def settle_rejudge(viewer: Admin, question_id: str, body: OutcomeBody) -> dict[str, bool]:
    corrections.rejudge_outcome(viewer.id, question_id, body.outcome, body.reason)
    return {"ok": True}


@router.post("/{question_id}/assign")
def assign_question(viewer: Admin, question_id: str, body: AssignBody) -> dict[str, bool]:
    sales.assign_question(viewer.id, question_id, body.participant_id, body.price, body.reason)
    return {"ok": True}


@router.post("/{question_id}/transfer")
def transfer_question(viewer: Admin, question_id: str, body: TransferBody) -> dict[str, bool]:
    corrections.transfer_ownership(viewer.id, question_id, body.participant_id, body.reason)
    return {"ok": True}
