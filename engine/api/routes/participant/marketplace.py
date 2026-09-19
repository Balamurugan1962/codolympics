"""The marketplace: what is on sale, buying a powerup, and using one."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter
from pydantic import Field

from engine.marketplace import buying, storefront, using

from ...auth import Participant
from ...common import Body

router = APIRouter(prefix="/api/marketplace")

# The client's idempotency key: the same request id sent twice acts once.
RequestId = Annotated[str, Field(min_length=8, max_length=64)]


class BuyBody(Body):
    powerup_id: int
    request_id: RequestId


class UseBody(Body):
    powerup_id: int
    target_id: Annotated[str | None, Field(min_length=1)] = None
    request_id: RequestId


@router.get("")
def read_marketplace(viewer: Participant) -> dict[str, Any]:
    return storefront.marketplace_for(viewer.id)


@router.post("/buy")
def buy_powerup(viewer: Participant, body: BuyBody) -> dict[str, Any]:
    return buying.buy(viewer.id, body.powerup_id, body.request_id)


@router.post("/use")
def use_powerup(viewer: Participant, body: UseBody) -> dict[str, Any]:
    return using.use(viewer.id, body.powerup_id, body.target_id, body.request_id)
