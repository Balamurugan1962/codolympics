"""Phase 2 for a participant: bidding, questions, hints, drafts and submissions."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Path
from fastapi import Body as BodyParam
from pydantic import Field

from engine.auction import bidding
from engine.coding import hints, questions, runs, submission_views, submissions
from engine.coding.runs import MAX_CUSTOM_INPUT_BYTES
from engine.coding.submissions import MAX_SOURCE_BYTES
from engine.core import clock

from ...auth import Participant
from ...common import Body, ProblemId

router = APIRouter(prefix="/api")


class BidBody(Body):
    lot_id: Annotated[int, Field(gt=0)]
    amount: Annotated[int, Field(gt=0)]


class HintBody(Body):
    # Which hint the buyer was looking at, so a double click buys it once.
    idx: int | None = None


class DraftBody(Body):
    source: Annotated[str, Field(max_length=MAX_SOURCE_BYTES)]
    language: Annotated[str, Field(max_length=32)]


class SubmissionBody(Body):
    question_id: ProblemId
    language: Annotated[str, Field(min_length=1, max_length=32)]
    source: Annotated[str, Field(max_length=MAX_SOURCE_BYTES)]


@router.post("/bids")
def place_bid(viewer: Participant, body: BidBody) -> dict[str, bool]:
    bidding.place_bid(viewer.id, body.lot_id, body.amount)
    return {"ok": True}


@router.get("/questions/{question_id}")
def read_question(viewer: Participant, question_id: str) -> dict[str, Any]:
    """Owned questions only. Anything else is 403, not hidden."""
    return questions.for_owner(viewer.id, question_id)


@router.post("/questions/{question_id}/hints")
def buy_hint(
    viewer: Participant,
    question_id: str,
    body: Annotated[HintBody | None, BodyParam()] = None,
) -> dict[str, Any]:
    idx = body.idx if body else None
    return hints.buy_hint(viewer.id, question_id, idx)


@router.put("/drafts/{question_id}")
def save_draft(viewer: Participant, question_id: str, body: DraftBody) -> dict[str, str | None]:
    questions.save_draft(viewer.id, question_id, body.source, body.language)
    return {"saved_at": clock.iso(clock.now())}


class RunBody(Body):
    language: Annotated[str, Field(min_length=1, max_length=32)]
    source: Annotated[str, Field(max_length=MAX_SOURCE_BYTES)]
    # An input of the participant's own, run after the samples.
    custom_input: Annotated[str | None, Field(max_length=MAX_CUSTOM_INPUT_BYTES)] = None


@router.post("/questions/{question_id}/run", status_code=202)
def run_samples(viewer: Participant, question_id: str, body: RunBody) -> dict[str, int]:
    """A practice run on the samples and an optional custom input. Nothing is scored."""
    return {"id": runs.start(viewer.id, question_id, body.language, body.source, body.custom_input)}


@router.get("/runs/{run_id}")
def read_run(viewer: Participant, run_id: Annotated[int, Path(gt=0)]) -> dict[str, Any]:
    """The workspace polls this until the run is done."""
    return runs.poll(viewer.id, run_id)


@router.post("/submissions", status_code=202)
def submit(viewer: Participant, body: SubmissionBody) -> dict[str, int]:
    """Stored before the judge is called."""
    submission_id = submissions.submit(viewer.id, body.question_id, body.language, body.source)
    return {"id": submission_id}


@router.delete("/submissions/current")
def cancel_submission(viewer: Participant) -> dict[str, bool]:
    return {"cancelled": submissions.cancel_in_flight(viewer.id)}


@router.get("/submissions/{submission_id}")
def read_submission(
    viewer: Participant,
    submission_id: Annotated[int, Path(gt=0)],
) -> dict[str, Any]:
    """One judgement, and nothing else: the workspace polls this while judging."""
    return submission_views.one_for_participant(viewer.id, submission_id)
