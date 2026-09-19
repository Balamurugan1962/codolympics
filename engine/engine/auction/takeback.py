"""Taking a sold question back off its owner: the sale was wrong, the question is fine."""

from __future__ import annotations

from typing import Any

import sqlalchemy as sa

from engine.auction.board import publish_snapshot
from engine.auction.lot_queue import relist_question
from engine.auction.sales import current_owner, refund_note, refund_sale
from engine.contest.messages import notify
from engine.contest.rules import auction_round, lock_contest
from engine.core import clock, db, errors, events
from engine.core.audit import audit
from engine.schema import ownership, question


def take_back_question(
    actor_id: str,
    question_id: str,
    *,
    refund_price: bool,
    refund_hints: bool,
    relist: bool,
    reason: str,
) -> dict[str, Any]:
    """The sale was wrong, the question is fine: it returns to unsold. Submissions are kept."""
    with db.transaction() as conn:
        phase = lock_contest(conn).phase
        q = conn.execute(
            sa.select(question).where(question.c.id == question_id).with_for_update()
        ).one_or_none()
        if q is None:
            raise errors.not_found("question")
        own = current_owner(conn, question_id)
        if own is None:
            raise errors.conflict("not_owned", "nobody owns that question")
        conn.execute(
            sa.update(ownership)
            .where(ownership.c.question_id == question_id)
            .values(voided_at=clock.now())
        )
        refunded = refund_sale(
            conn,
            own,
            refund_price=refund_price,
            refund_hints=refund_hints,
            ref=f"takeback:{question_id}",
        )
        conn.execute(
            sa.update(question).where(question.c.id == question_id).values(status="unsold")
        )
        if relist:
            relist_question(conn, question_id, auction_round(phase))
        note = refund_note(refunded)
        notify(
            conn,
            own.participant_id,
            f"**{q.title}** was taken back by the organisers{note}. Reason: {reason}",
        )
        detail = {
            "owner": own.participant_id,
            "price": own.price_paid,
            "refunded": refunded,
            "relisted": relist,
        }
        audit(
            conn,
            actor_id=actor_id,
            action="question.take_back",
            target=question_id,
            reason=reason,
            detail=detail,
        )
    publish_snapshot()
    events.publish("balance", {}, own.participant_id)
    events.publish("leaderboard")
    return {"refunded": refunded, "owner": own.participant_id}
