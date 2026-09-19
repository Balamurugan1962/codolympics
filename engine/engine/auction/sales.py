"""Paying for a question: awarding a lot, assigning an unsold question, and refunding a sale.

Ownership is sole: a question has at most one live ownership row, and a
taken-back question keeps a voided row that the next sale overwrites.
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import insert as pg_insert

from engine.accounts import wallet
from engine.core import clock, db, errors, events
from engine.core.audit import audit
from engine.schema import hint_purchase, lot, ownership, participant, question


def award(conn: sa.Connection, lot_id: int, question_id: str, winner_id: str, price: int) -> None:
    """Charge exactly the winning price and make ownership sole."""
    wallet.move(conn, winner_id, -price, "bid_won", question_id)
    grant_ownership(conn, question_id, winner_id, price)
    conn.execute(
        sa.update(lot).where(lot.c.id == lot_id).values(state="closed", closed_at=clock.now())
    )
    conn.execute(sa.update(question).where(question.c.id == question_id).values(status="sold"))


def grant_ownership(conn: sa.Connection, question_id: str, participant_id: str, price: int) -> None:
    """Record the sale.

    A question taken back earlier keeps its voided row, which a new sale replaces.
    """
    values = {
        "participant_id": participant_id,
        "price_paid": price,
        "awarded_at": clock.now(),
        "voided_at": None,
    }
    stmt = pg_insert(ownership).values(question_id=question_id, **values)
    stmt = stmt.on_conflict_do_update(
        index_elements=["question_id"],
        set_=values,
        where=ownership.c.voided_at.is_not(None),
    )
    if conn.execute(stmt).rowcount == 0:
        raise errors.conflict("already_owned", "that question already has an owner")


def announce_award(winner_id: str, question_id: str, price: int) -> None:
    with db.transaction() as conn:
        balance = conn.execute(
            sa.select(participant.c.balance).where(participant.c.user_id == winner_id)
        ).scalar()
    events.publish("balance", {"balance": balance}, winner_id)
    events.publish("notify", {"body": f"You won **{question_id}** for {price}."}, winner_id)


def assign_question(
    actor_id: str, question_id: str, participant_id: str, price: int, reason: str
) -> None:
    with db.transaction() as conn:
        q = conn.execute(
            sa.select(question).where(question.c.id == question_id).with_for_update()
        ).one_or_none()
        if q is None:
            raise errors.not_found("question")
        if q.status != "unsold":
            raise errors.conflict("not_unsold", "only an unsold question can be assigned")
        p = wallet.lock_participant(conn, participant_id)
        if p is None:
            raise errors.not_found("participant")
        if price > p.balance:
            raise errors.conflict("insufficient_balance", f"they have {p.balance}")
        wallet.move(conn, participant_id, -price, "bid_won", question_id)
        grant_ownership(conn, question_id, participant_id, price)
        conn.execute(sa.update(question).where(question.c.id == question_id).values(status="sold"))
        detail = {
            "questionId": question_id,
            "participantId": participant_id,
            "price": price,
            "reason": reason,
        }
        audit(
            conn,
            actor_id=actor_id,
            action="question.assign",
            target=question_id,
            reason=reason,
            detail=detail,
        )
    events.publish("balance", {}, participant_id)
    body = f"An organiser assigned you **{question_id}**."
    events.publish("notify", {"body": body}, participant_id)


def current_owner(conn: sa.Connection, question_id: str) -> sa.Row | None:
    return conn.execute(
        sa.select(ownership).where(
            ownership.c.question_id == question_id, ownership.c.voided_at.is_(None)
        )
    ).one_or_none()


def refund_note(refunded: int) -> str:
    return f" and {refunded} was refunded to you" if refunded else ""


def refund_sale(
    conn: sa.Connection,
    own: sa.Row,
    *,
    refund_price: bool,
    refund_hints: bool,
    ref: str,
    drop_hints: bool = True,
) -> int:
    """Credit back the price and/or the hints bought for a question.

    Refunded hints stop being bought, unless the caller passes drop_hints=False.
    """
    refunded = own.price_paid if refund_price else 0
    if refund_hints:
        mine = sa.and_(
            hint_purchase.c.question_id == own.question_id,
            hint_purchase.c.participant_id == own.participant_id,
        )
        refunded += conn.execute(
            sa.select(sa.func.coalesce(sa.func.sum(hint_purchase.c.price_paid), 0)).where(mine)
        ).scalar_one()
        # Money back and the hints still bought would unlock them for free if the
        # question were won again.
        if drop_hints:
            conn.execute(sa.delete(hint_purchase).where(mine))
    if refunded > 0:
        wallet.move(conn, own.participant_id, refunded, "refund", ref)
    return refunded


def owned_counts(conn: sa.Connection) -> dict[str, int]:
    found = conn.execute(
        sa.select(ownership.c.participant_id, sa.func.count())
        .where(ownership.c.voided_at.is_(None))
        .group_by(ownership.c.participant_id)
    ).all()
    return {pid: n for pid, n in found}
