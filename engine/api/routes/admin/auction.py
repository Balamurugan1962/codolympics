"""Running the auction from the organisers' side.

Administrators only; every action carries a reason.
"""

from __future__ import annotations

from typing import Annotated, Any, Literal

from fastapi import APIRouter
from pydantic import Field

from engine.auction import control, lot_queue, lots, offline, organiser_view, takeback

from ...auth import Admin
from ...common import ReasonBody

router = APIRouter(prefix="/api/admin")


class LotBody(ReasonBody):
    lot_id: int


class ReorderLotsBody(ReasonBody):
    round: Annotated[int, Field(ge=1, le=2)]
    lot_ids: Annotated[list[int], Field(min_length=1)]


class TimerBody(ReasonBody):
    mode: Literal["off", "restart", "adjust"]
    seconds: Annotated[int | None, Field(ge=-3600, le=3600)] = None


class SaleBody(ReasonBody):
    lot_id: int
    participant_id: Annotated[str, Field(min_length=1)]
    price: Annotated[int, Field(ge=0)]


class TakeBackBody(ReasonBody):
    question_id: Annotated[str, Field(min_length=1)]
    refund_price: bool
    refund_hints: bool
    relist: bool


@router.get("/auction")
def read_auction_board(_: Admin) -> dict[str, Any]:
    """Every lot of the round with its owner and price, and everyone's balance."""
    return organiser_view.control_snapshot()


@router.post("/auction/pause")
def pause_auction(viewer: Admin, body: ReasonBody) -> dict[str, bool]:
    control.pause(viewer.id, body.reason)
    return {"ok": True}


@router.post("/auction/resume")
def resume_auction(viewer: Admin, body: ReasonBody) -> dict[str, int]:
    return {"held_ms": control.resume(viewer.id, body.reason)}


@router.post("/auction/close")
@router.post("/lots/close")
def close_open_lot(viewer: Admin, body: ReasonBody) -> dict[str, bool]:
    lots.close_lot_now(viewer.id, body.reason)
    return {"ok": True}


@router.post("/lots/disable-timer")
def disable_lot_timer(viewer: Admin, body: ReasonBody) -> dict[str, bool]:
    control.set_lot_timer(viewer.id, "off", body.reason)
    return {"ok": True}


@router.post("/auction/timer")
def set_lot_timer(viewer: Admin, body: TimerBody) -> dict[str, bool]:
    control.set_lot_timer(viewer.id, body.mode, body.reason, body.seconds)
    return {"ok": True}


@router.post("/auction/retract-bid")
def retract_top_bid(viewer: Admin, body: ReasonBody) -> dict[str, Any]:
    return control.retract_top_bid(viewer.id, body.reason)


@router.post("/auction/withdraw")
def withdraw_lot(viewer: Admin, body: LotBody) -> dict[str, bool]:
    lot_queue.withdraw_lot(viewer.id, body.lot_id, body.reason)
    return {"ok": True}


@router.post("/auction/restore")
def restore_lot(viewer: Admin, body: LotBody) -> dict[str, bool]:
    lot_queue.restore_lot(viewer.id, body.lot_id, body.reason)
    return {"ok": True}


@router.post("/auction/reorder")
def reorder_lots(viewer: Admin, body: ReorderLotsBody) -> dict[str, bool]:
    lot_queue.reorder_lots(viewer.id, body.round, body.lot_ids, body.reason)
    return {"ok": True}


@router.post("/auction/record-sale")
def record_sale(viewer: Admin, body: SaleBody) -> dict[str, bool]:
    offline.record_sale(viewer.id, body.lot_id, body.participant_id, body.price, body.reason)
    return {"ok": True}


@router.post("/auction/record-unsold")
def record_unsold(viewer: Admin, body: LotBody) -> dict[str, bool]:
    offline.record_unsold(viewer.id, body.lot_id, body.reason)
    return {"ok": True}


@router.post("/auction/take-back")
def take_back_question(viewer: Admin, body: TakeBackBody) -> dict[str, Any]:
    return takeback.take_back_question(
        viewer.id,
        body.question_id,
        refund_price=body.refund_price,
        refund_hints=body.refund_hints,
        relist=body.relist,
        reason=body.reason,
    )
