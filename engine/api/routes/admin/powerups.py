"""The powerup catalogue an organiser edits."""

from __future__ import annotations

from typing import Annotated, Any, Literal

from fastapi import APIRouter
from pydantic import Field

from engine.marketplace import catalogue
from engine.schema import PHASES

from ...auth import Admin, Staff
from ...common import Body, Reason, fields

router = APIRouter(prefix="/api/admin/powerups")

Phase = Literal[PHASES]  # type: ignore[valid-type]


class PowerupPatch(Body):
    reason: Reason
    id: int
    name: Annotated[str | None, Field(min_length=1, max_length=60)] = None
    description: Annotated[str | None, Field(max_length=500)] = None
    price: Annotated[int | None, Field(ge=0)] = None
    duration_seconds: Annotated[int | None, Field(ge=1, le=3600)] = None
    enabled: bool | None = None
    max_held: Annotated[int | None, Field(ge=1)] = None
    max_purchases: Annotated[int | None, Field(ge=1)] = None
    usable_phases: list[Phase] | None = None


@router.get("")
def list_powerups(_: Staff) -> dict[str, Any]:
    return {"powerups": catalogue.catalogue_rows()}


@router.patch("")
def update_powerup(viewer: Admin, body: PowerupPatch) -> dict[str, Any]:
    """Takes effect on the next purchase or use; a blackout already running keeps its end time."""
    changes = fields(body, exclude=("reason", "id"))
    catalogue.save(viewer.id, body.id, changes, body.reason)
    return {"powerups": catalogue.catalogue_rows()}
