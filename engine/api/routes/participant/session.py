"""What every open page reads: its state, the event feed, languages and the leaderboard."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Query
from pydantic import Field

from engine.accounts.preferences import set_preferred_language
from engine.accounts.registration import register_participant
from engine.coding import scoring
from engine.contest import messages
from engine.core import events
from engine.judge import languages
from engine.marketplace.blackouts import blackout_for
from engine.state import state_for

from ...auth import Participant, SignedIn
from ...common import Body

router = APIRouter(prefix="/api")


class Registration(Body):
    username: Annotated[str, Field(min_length=2, max_length=32)]
    password: Annotated[str, Field(min_length=8, max_length=128)]
    preferred_language: Annotated[str | None, Field(max_length=32)] = None


@router.get("/state")
def read_state(viewer: SignedIn) -> dict[str, Any]:
    return state_for(viewer)


@router.get("/poll")
def read_events(viewer: SignedIn, after: Annotated[int, Query(ge=0)] = 0) -> dict[str, Any]:
    """The events since `after` this viewer may see. Every open page polls about once a second."""
    return events.since(viewer.id, after)


@router.get("/languages")
def read_languages(_: SignedIn) -> dict[str, Any]:
    return {"languages": languages.offered()}


class LanguageChoice(Body):
    language: Annotated[str, Field(min_length=1, max_length=32)]


@router.put("/me/language")
def choose_language(viewer: Participant, body: LanguageChoice) -> dict[str, str]:
    """The language a participant reads and writes by default. Asked at
    registration; changed from any language dropdown, and the change sticks."""
    set_preferred_language(viewer.id, body.language)
    return {"preferred_language": body.language}


@router.get("/leaderboard")
def read_leaderboard(_: SignedIn) -> dict[str, Any]:
    return scoring.for_participants()


@router.post("/register", status_code=201)
def register(body: Registration) -> dict[str, str]:
    """Self-registration in the hall.

    The only route that needs no session; the page signs in afterwards.
    """
    user_id = register_participant(body.username, body.password, body.preferred_language)
    return {"id": user_id}


@router.post("/notifications/read")
def mark_notifications_read(viewer: Participant) -> dict[str, bool]:
    messages.mark_all_read(viewer.id)
    return {"ok": True}


@router.get("/blackout")
def read_blackout(viewer: Participant) -> dict[str, Any]:
    """Only this answer lifts a blackout; the page's countdown is decoration."""
    return blackout_for(viewer.id)
