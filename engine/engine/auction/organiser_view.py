"""The organisers' board: every lot with its owner, and who can still afford what."""

from __future__ import annotations

from typing import Any

import sqlalchemy as sa

from engine.auction.sales import owned_counts
from engine.contest.rules import auction_round, get_contest
from engine.core import clock, db
from engine.schema import lot, ownership, participant, question, user


def control_snapshot() -> dict[str, Any]:
    """Every lot of the round with its owner, and everyone's balance. Administrators only."""
    with db.transaction() as conn:
        c = get_contest(conn)
        round_ = auction_round(c.phase)
        query = (
            sa.select(
                lot.c.id,
                lot.c.question_id,
                question.c.title,
                question.c.difficulty,
                question.c.score,
                question.c.base_price,
                question.c.status,
                lot.c.state,
                lot.c.order,
                lot.c.current_bid,
                lot.c.opened_at,
                lot.c.closed_at,
                ownership.c.participant_id.label("owner_id"),
                user.c.name.label("owner_name"),
                ownership.c.price_paid,
            )
            .join(question, question.c.id == lot.c.question_id)
            .outerjoin(
                ownership,
                sa.and_(
                    ownership.c.question_id == lot.c.question_id,
                    ownership.c.voided_at.is_(None),
                ),
            )
            .outerjoin(user, user.c.id == ownership.c.participant_id)
            .where(lot.c.round == round_)
            .order_by(lot.c.order)
        )
        found = conn.execute(query).mappings().all()
        balances = bidder_balances(conn)
    lots = []
    for r in found:
        row = dict(r)
        row["opened_at"] = clock.iso(row["opened_at"])
        row["closed_at"] = clock.iso(row["closed_at"])
        lots.append(row)
    return {
        "round": round_,
        "mode": c.auction_mode,
        "paused_at": clock.iso(c.auction_paused_at),
        "countdown_seconds": c.countdown_seconds,
        "opening_window_seconds": c.opening_window_seconds,
        "lots": lots,
        "balances": balances,
        "server_now": clock.now_ms(),
    }


def bidder_balances(conn: sa.Connection) -> list[dict[str, Any]]:
    """Who can still afford what, for the organiser running the room."""
    people = conn.execute(
        sa.select(
            participant.c.user_id,
            user.c.name,
            participant.c.balance,
            participant.c.disqualified_at,
        )
        .join(user, user.c.id == participant.c.user_id)
        .order_by(participant.c.balance.desc())
    ).all()
    owned = owned_counts(conn)
    return [
        {
            "id": r.user_id,
            "name": r.name,
            "balance": r.balance,
            "owned": owned.get(r.user_id, 0),
            "disqualified": r.disqualified_at is not None,
        }
        for r in people
    ]
