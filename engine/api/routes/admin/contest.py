"""The contest as a whole: settings, phases, the reset, announcements, audit, health and export."""

from __future__ import annotations

import json
from typing import Annotated, Any, Literal

from fastapi import APIRouter
from fastapi.responses import Response
from pydantic import Field

from engine.admin import contest_reset, contest_settings, overview
from engine.coding import scoring
from engine.contest import messages, phase_checks, phases, readiness
from engine.core import clock
from engine.schema import AUCTION_MODES, LEADERBOARD_MODES

from ...auth import Admin, Staff
from ...common import Body, Reason, ReasonBody, download, fields

router = APIRouter(prefix="/api/admin")

Minutes = Annotated[int | None, Field(ge=1)]
LeaderboardMode = Literal[LEADERBOARD_MODES]  # type: ignore[valid-type]
AuctionMode = Literal[AUCTION_MODES]  # type: ignore[valid-type]


class ContestPatch(Body):
    reason: Reason
    auction_mode: AuctionMode | None = None
    marketplace_open: bool | None = None
    reveal_attacker: bool | None = None
    reveal_shields: bool | None = None
    starting_balance: Annotated[int | None, Field(ge=0)] = None
    bid_increment: Annotated[int | None, Field(ge=1)] = None
    countdown_seconds: Annotated[int | None, Field(ge=0)] = None  # 0 disables the countdown
    opening_window_seconds: Annotated[int | None, Field(ge=1)] = None
    ownership_cap: Annotated[int | None, Field(ge=1)] = None
    coding1_minutes: Minutes = None
    final_minutes: Minutes = None
    p1_puzzles_minutes: Minutes = None
    p1_hacking_minutes: Minutes = None
    p1_selection_basis: Annotated[str | None, Field(max_length=2000)] = None
    p1_leaderboard_mode: LeaderboardMode | None = None
    leaderboard_mode: LeaderboardMode | None = None


class AdvanceBody(ReasonBody):
    acknowledge_warnings: bool = False


class ExtendBody(ReasonBody):
    minutes: Annotated[int, Field(ge=1, le=600)]


class RegistrationBody(ReasonBody):
    open: bool


class ResetBody(ReasonBody):
    scope: Literal["run", "everything"]
    confirm: str


class AnnouncementBody(Body):
    body_md: Annotated[str, Field(min_length=1, max_length=5000)]


# ---------------------------------------------------------------------------
# Settings and phases
# ---------------------------------------------------------------------------


@router.get("/contest")
def read_contest(_: Staff) -> dict[str, Any]:
    return contest_settings.contest_row()


@router.patch("/contest")
def update_contest(viewer: Admin, body: ContestPatch) -> dict[str, Any]:
    # Only the fields actually sent: `ownership_cap: null` means uncapped on purpose.
    return contest_settings.update_contest(viewer.id, fields(body), body.reason)


@router.get("/contest/phase")
def read_advance_checks(_: Admin) -> dict[str, Any]:
    """What advancing would do, shown before an organiser confirms."""
    return phase_checks.advance_checks()


@router.post("/contest/phase")
def advance_phase(viewer: Admin, body: AdvanceBody) -> dict[str, str]:
    return {"phase": phases.advance(viewer.id, body.reason, body.acknowledge_warnings)}


@router.post("/contest/extend")
def extend_phase(viewer: Admin, body: ExtendBody) -> dict[str, bool]:
    phases.extend(viewer.id, body.minutes, body.reason)
    return {"ok": True}


@router.post("/contest/registration")
def set_registration(viewer: Admin, body: RegistrationBody) -> dict[str, bool]:
    phases.set_registration(viewer.id, body.open, body.reason)
    return {"ok": True}


@router.post("/contest/reset")
def reset_contest(viewer: Admin, body: ResetBody) -> dict[str, int]:
    return contest_reset.reset(viewer.id, body.scope, body.reason, body.confirm)


# ---------------------------------------------------------------------------
# Announcements, audit, health, boards, readiness, export
# ---------------------------------------------------------------------------


@router.get("/announcements")
def read_announcements(_: Staff) -> dict[str, Any]:
    return {"announcements": messages.announcements()}


@router.post("/announcements")
def post_announcement(viewer: Admin, body: AnnouncementBody) -> dict[str, bool]:
    messages.announce(viewer.id, body.body_md)
    return {"ok": True}


@router.get("/audit")
def read_audit_log(_: Staff) -> dict[str, Any]:
    return {"entries": overview.recent_audit()}


@router.get("/health")
def read_health(_: Staff) -> dict[str, Any]:
    """Judge reachability and the submission backlog."""
    return overview.health()


@router.get("/leaderboard")
def read_leaderboards(_: Staff) -> dict[str, Any]:
    """Both boards in full, ignoring the hidden/frozen setting participants are held to."""
    return scoring.for_staff()


@router.get("/readiness")
def read_readiness(_: Staff) -> dict[str, Any]:
    return readiness.checklist()


@router.get("/export")
def export_everything(_: Admin) -> Response:
    content = json.dumps(overview.export_all(), indent=2).encode()
    filename = f"contest-export-{clock.now_ms()}.json"
    return download(filename, content, "application/json")
