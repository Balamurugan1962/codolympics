"""Organiser corrections: voiding a question, rejudge outcomes, balances and ownership."""

from __future__ import annotations

import sqlalchemy as sa

from engine.accounts import wallet
from engine.auction.board import publish_snapshot
from engine.auction.sales import current_owner, refund_note, refund_sale
from engine.contest.messages import notify
from engine.core import clock, db, errors, events
from engine.core.audit import audit
from engine.packages import volume
from engine.schema import (
    announcement,
    draft,
    hint_purchase,
    lot,
    ownership,
    practice_run,
    question,
    submission,
)


def void_question(
    actor_id: str,
    question_id: str,
    reason: str,
    refund_price: bool = True,
    refund_hints: bool = True,
) -> None:
    """The question was bad: it leaves the contest for everyone, and its owner is refunded."""
    with db.transaction() as conn:
        q = conn.execute(
            sa.select(question).where(question.c.id == question_id).with_for_update()
        ).one_or_none()
        if q is None:
            raise errors.not_found("question")
        own = current_owner(conn, question_id)
        conn.execute(sa.update(question).where(question.c.id == question_id).values(status="void"))
        refunded = _void_ownership(conn, q, own, reason, refund_price, refund_hints)
        conn.execute(
            sa.insert(announcement).values(
                body_md=f"Question **{q.title}** has been voided. {reason}"
            )
        )
        detail = {"refunded": refunded, "owner": own.participant_id if own else None}
        audit(
            conn,
            actor_id=actor_id,
            action="question.void",
            target=question_id,
            reason=reason,
            detail=detail,
        )
    events.publish("leaderboard")
    events.publish("announce")
    events.publish("balance")


def _void_ownership(
    conn: sa.Connection,
    q: sa.Row,
    own: sa.Row | None,
    reason: str,
    refund_price: bool,
    refund_hints: bool,
) -> int:
    """Mark the owner's ownership void and refund them. Returns the amount refunded."""
    if own is None:
        return 0
    conn.execute(
        sa.update(ownership).where(ownership.c.question_id == q.id).values(voided_at=clock.now())
    )
    # A voided question cannot be won again, so its hint purchases stay on the record.
    refunded = refund_sale(
        conn,
        own,
        refund_price=refund_price,
        refund_hints=refund_hints,
        ref=f"void:{q.id}",
        drop_hints=False,
    )
    notify(
        conn,
        own.participant_id,
        f"**{q.title}** was voided by the organisers{refund_note(refunded)}. Reason: {reason}",
    )
    return refunded


def rejudge_outcome(actor_id: str, question_id: str, outcome: str, reason: str) -> None:
    """After a rejudge, the explicit choice: let the verdicts stand, refund the owner, or void."""
    if outcome == "void":
        void_question(actor_id, question_id, reason)
        return
    with db.transaction() as conn:
        q = conn.execute(
            sa.select(question.c.id).where(question.c.id == question_id).with_for_update()
        ).one_or_none()
        own = current_owner(conn, question_id)
        if q is not None and own is not None:
            _apply_rejudge_outcome(conn, own, outcome)
        audit(
            conn,
            actor_id=actor_id,
            action="rejudge.outcome",
            target=question_id,
            reason=reason,
            detail={"outcome": outcome},
        )
    events.publish("balance")


def _apply_rejudge_outcome(conn: sa.Connection, own: sa.Row, outcome: str) -> None:
    if outcome == "refund":
        wallet.move(
            conn, own.participant_id, own.price_paid, "refund", f"rejudge:{own.question_id}"
        )
        notify(
            conn,
            own.participant_id,
            f"You were refunded {own.price_paid} for **{own.question_id}** after a correction."
            " You keep the question.",
        )
    else:
        notify(
            conn,
            own.participant_id,
            f"**{own.question_id}** was corrected and your submissions were rejudged;"
            " the verdicts stand.",
        )


def adjust_balance(actor_id: str, participant_id: str, delta: int, reason: str) -> int:
    with db.transaction() as conn:
        balance = wallet.move(conn, participant_id, delta, "admin_adjust", "admin")
        sign = "+" if delta > 0 else ""
        notify(
            conn,
            participant_id,
            f"An organiser adjusted your balance by {sign}{delta}. Reason: {reason}",
        )
        detail = {"delta": delta, "balanceAfter": balance}
        audit(
            conn,
            actor_id=actor_id,
            action="balance.adjust",
            target=participant_id,
            reason=reason,
            detail=detail,
        )
    events.publish("balance", {"balance": balance}, participant_id)
    return balance


def transfer_ownership(
    actor_id: str, question_id: str, to_participant_id: str, reason: str
) -> None:
    """Move a sold question to someone else without money changing hands.

    Solve time restarts for the new owner.
    """
    with db.transaction() as conn:
        own = conn.execute(
            sa.select(ownership).where(ownership.c.question_id == question_id).with_for_update()
        ).one_or_none()
        if own is None:
            raise errors.not_found("ownership")
        conn.execute(
            sa.update(ownership)
            .where(ownership.c.question_id == question_id)
            .values(participant_id=to_participant_id, awarded_at=clock.now())
        )
        notify(
            conn,
            own.participant_id,
            f"**{question_id}** was reassigned by an organiser. Reason: {reason}",
        )
        notify(conn, to_participant_id, f"**{question_id}** was assigned to you by an organiser.")
        detail = {"from": own.participant_id, "to": to_participant_id}
        audit(
            conn,
            actor_id=actor_id,
            action="ownership.transfer",
            target=question_id,
            reason=reason,
            detail=detail,
        )
    events.publish("leaderboard")


def delete_question(
    actor_id: str, question_id: str, reason: str, remove_package: bool = False
) -> dict[str, int]:
    """Remove a question that nothing has happened to: never sold, attempted, or bought a hint for.

    Its hints and any lot that has not opened go with it. The judge package stays unless
    asked for, because it is the expensive part to rewrite. Anything with history is voided.
    """
    with db.transaction() as conn:
        q = conn.execute(
            sa.select(question).where(question.c.id == question_id).with_for_update()
        ).one_or_none()
        if q is None:
            raise errors.not_found("question")
        history = {
            "sales": (ownership, ownership.c.question_id),
            "submissions": (submission, submission.c.question_id),
            "practice runs": (practice_run, practice_run.c.question_id),
            "hint purchases": (hint_purchase, hint_purchase.c.question_id),
        }
        for name, (table, col) in history.items():
            found = conn.execute(
                sa.select(sa.func.count()).select_from(table).where(col == question_id)
            ).scalar_one()
            if found:
                raise errors.conflict(
                    "has_history", f"it has {found} {name}, so void it instead of deleting it"
                )
        opened = conn.execute(
            sa.select(sa.func.count())
            .select_from(lot)
            .where(lot.c.question_id == question_id, lot.c.state.notin_(("pending", "withdrawn")))
        ).scalar_one()
        if opened:
            raise errors.conflict(
                "has_history", "it has been offered at auction, so void it instead of deleting it"
            )
        lots = conn.execute(sa.delete(lot).where(lot.c.question_id == question_id)).rowcount
        conn.execute(sa.delete(draft).where(draft.c.question_id == question_id))
        conn.execute(sa.delete(question).where(question.c.id == question_id))
        audit(
            conn,
            actor_id=actor_id,
            action="question.delete",
            target=question_id,
            reason=reason,
            detail={"title": q.title, "package_removed": remove_package, "lots_removed": lots},
        )
    if remove_package:
        volume.delete_package(question_id)
    if lots:
        publish_snapshot()
    return {"lots": lots}
