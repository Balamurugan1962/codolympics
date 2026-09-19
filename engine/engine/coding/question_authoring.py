"""The organisers' side of a question: its details, hints and auction running order."""

from __future__ import annotations

from typing import Any

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import insert as pg_insert

from engine.core import db, errors
from engine.core.audit import audit
from engine.core.serialize import camel_row
from engine.schema import hint, lot, question


def admin_list() -> list[dict[str, Any]]:
    questions_in_order = sa.select(question).order_by(question.c.auction_order, question.c.id)
    hints_in_order = sa.select(hint).order_by(hint.c.question_id, hint.c.idx)
    with db.transaction() as conn:
        questions = conn.execute(questions_in_order).mappings().all()
        hints = conn.execute(hints_in_order).mappings().all()
    listing: list[dict[str, Any]] = []
    for q in questions:
        own_hints = [camel_row(h) for h in hints if h["question_id"] == q["id"]]
        listing.append({**camel_row(q), "hints": own_hints})
    return listing


QUESTION_FIELDS = (
    "title",
    "topic",
    "difficulty",
    "score",
    "base_price",
    "statement_md",
    "sample_count",
    "auction_order",
)


def upsert(actor_id: str, fields: dict[str, Any], hints: list[dict[str, Any]], reason: str) -> None:
    """Create or update the contest-facing side of a question, and replace its hints."""
    question_id = fields["id"]
    values = {k: fields[k] for k in QUESTION_FIELDS}
    with db.transaction() as conn:
        write_question(conn, question_id, values, hints)
        detail = {"title": values["title"], "hints": len(hints)}
        audit(
            conn,
            actor_id=actor_id,
            action="question.upsert",
            target=question_id,
            reason=reason,
            detail=detail,
        )


def write_question(
    conn: sa.Connection, question_id: str, values: dict[str, Any], hints: list[dict[str, Any]]
) -> None:
    stmt = pg_insert(question).values(id=question_id, **values)
    conn.execute(stmt.on_conflict_do_update(index_elements=["id"], set_=values))
    conn.execute(sa.delete(hint).where(hint.c.question_id == question_id))
    if hints:
        rows = [
            {
                "question_id": question_id,
                "idx": i,
                "price": int(h.get("price") or 0),
                "body_md": str(h.get("body_md") or ""),
            }
            for i, h in enumerate(hints)
        ]
        conn.execute(sa.insert(hint), rows)


def reorder(actor_id: str, ids: list[str], reason: str) -> None:
    """Set the auction running order.

    Refused once lots exist: bidders plan their money around it.
    """
    with db.transaction() as conn:
        existing = set(conn.execute(sa.select(question.c.id).with_for_update()).scalars())
        if len(ids) != len(existing) or set(ids) != existing:
            raise errors.invalid("the order must list every question exactly once")
        lot_count = conn.execute(sa.select(sa.func.count()).select_from(lot)).scalar_one()
        if lot_count > 0:
            raise errors.conflict(
                "auction_started",
                "lots have been created; the auction order is fixed for this contest",
            )
        for position, question_id in enumerate(ids, start=1):
            conn.execute(
                sa.update(question)
                .where(question.c.id == question_id)
                .values(auction_order=position)
            )
        audit(
            conn,
            actor_id=actor_id,
            action="questions.reorder",
            reason=reason,
            detail={"ids": ids},
        )
