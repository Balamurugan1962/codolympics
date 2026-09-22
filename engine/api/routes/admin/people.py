"""People: participants and their accounts, and the staff who run the contest."""

from __future__ import annotations

from typing import Annotated, Any, Literal

from fastapi import APIRouter
from pydantic import Field

from engine.accounts import management, registration
from engine.admin import corrections, dossier, overview
from engine.contest import proctor
from engine.phase1 import selection

from ...auth import Admin, Staff
from ...common import ReasonBody

router = APIRouter(prefix="/api/admin")

Password = Annotated[str, Field(min_length=8, max_length=128)]
DisplayName = Annotated[str, Field(min_length=2, max_length=32)]


class NewParticipant(ReasonBody):
    username: DisplayName
    password: Password
    preferred_language: Annotated[str | None, Field(max_length=32)] = None


class NewStaff(ReasonBody):
    username: DisplayName
    password: Password
    role: Literal["evaluator", "admin"]


class AdjustBody(ReasonBody):
    delta: int


class PasswordBody(ReasonBody):
    password: Password


class RenameBody(ReasonBody):
    name: DisplayName


# ---------------------------------------------------------------------------
# Participants
# ---------------------------------------------------------------------------


@router.get("/participants")
def list_participants(_: Staff) -> dict[str, Any]:
    return {"participants": overview.participants_overview()}


@router.post("/participants", status_code=201)
def add_participant(viewer: Admin, body: NewParticipant) -> dict[str, str]:
    """The organiser's repair for when self-registration did not work."""
    user_id = registration.create_participant(
        viewer.id, body.username, body.password, body.preferred_language, body.reason
    )
    return {"id": user_id}


@router.get("/participants/{participant_id}")
def read_participant(_: Staff, participant_id: str) -> dict[str, Any]:
    """Everything one participant did, across both phases."""
    return dossier.dossier(participant_id)


@router.get("/participants/{participant_id}/questions/{question_id}")
def read_participant_question(_: Staff, participant_id: str, question_id: str) -> dict[str, Any]:
    """One question they own, with every submission's code and every hint's time."""
    return dossier.owned_question(participant_id, question_id)


@router.get("/participants/{participant_id}/hacks/{question_id}")
def read_participant_hack(_: Staff, participant_id: str, question_id: int) -> dict[str, Any]:
    """One hacking question, with every input they sent."""
    return dossier.hack_question(participant_id, question_id)


@router.delete("/participants/{participant_id}")
def remove_participant(viewer: Admin, participant_id: str, body: ReasonBody) -> dict[str, bool]:
    management.remove(viewer.id, participant_id, body.reason)
    return {"ok": True}


@router.post("/participants/{participant_id}/adjust")
def adjust_balance(viewer: Admin, participant_id: str, body: AdjustBody) -> dict[str, int]:
    balance = corrections.adjust_balance(viewer.id, participant_id, body.delta, body.reason)
    return {"balance": balance}


@router.post("/participants/{participant_id}/password")
def reset_password(viewer: Admin, participant_id: str, body: PasswordBody) -> dict[str, bool]:
    management.reset_password(viewer.id, participant_id, body.password, body.reason)
    return {"ok": True}


@router.post("/participants/{participant_id}/rename")
def rename_participant(viewer: Admin, participant_id: str, body: RenameBody) -> dict[str, bool]:
    management.rename(viewer.id, participant_id, body.name, body.reason)
    return {"ok": True}


@router.post("/participants/{participant_id}/disqualify")
def disqualify(viewer: Admin, participant_id: str, body: ReasonBody) -> dict[str, bool]:
    selection.disqualify(viewer.id, participant_id, body.reason)
    return {"ok": True}


@router.post("/participants/{participant_id}/requalify")
def requalify(viewer: Admin, participant_id: str, body: ReasonBody) -> dict[str, bool]:
    selection.disqualify(viewer.id, participant_id, body.reason, undo=True)
    return {"ok": True}


@router.post("/participants/{participant_id}/unlock")
def unlock(viewer: Admin, participant_id: str, body: ReasonBody) -> dict[str, bool]:
    """Let a participant locked out for leaving the page back in, with a clean count."""
    proctor.unlock(viewer.id, participant_id, body.reason)
    return {"ok": True}


# ---------------------------------------------------------------------------
# Staff
# ---------------------------------------------------------------------------


@router.get("/staff")
def list_staff(_: Admin) -> dict[str, Any]:
    return {"staff": management.staff_overview()}


@router.post("/staff", status_code=201)
def add_staff(viewer: Admin, body: NewStaff) -> dict[str, str]:
    """Evaluators do not self-register; an administrator creates them."""
    user_id = registration.create_staff(
        viewer.id, body.username, body.password, body.role, body.reason
    )
    return {"id": user_id}
