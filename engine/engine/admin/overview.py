"""What the organisers read: participants, judge health, the audit log, and the full export."""

from __future__ import annotations

from typing import Any

import sqlalchemy as sa

from engine.auction.sales import owned_counts
from engine.core import clock, db
from engine.core.serialize import camel_row, rows
from engine.judge import client as judge_client
from engine.judge.client import JudgeError
from engine.schema import (
    audit_log,
    contest,
    hint_purchase,
    judgement,
    ledger,
    ownership,
    p1_answer,
    p1_hack_question,
    p1_question,
    participant,
    question,
    submission,
    user,
)


def participants_overview() -> list[dict[str, Any]]:
    """Balances and ownership counts.

    Owning nothing after an auction is the flag organisers look for.
    """
    with db.transaction() as conn:
        people = conn.execute(
            sa.select(participant, user.c.name, user.c.username)
            .join(user, user.c.id == participant.c.user_id)
            .order_by(user.c.name)
        ).all()
        owned = owned_counts(conn)
    return [
        {
            "id": p.user_id,
            "name": p.name,
            "username": p.username,
            "balance": p.balance,
            "preferred_language": p.preferred_language,
            "owned": owned.get(p.user_id, 0),
            "disqualified": p.disqualified_at is not None,
            "disqualified_reason": p.disqualified_reason,
            "proctor_alerts": p.proctor_alerts,
            "proctor_locked": p.proctor_locked_at is not None,
        }
        for p in people
    ]


def health() -> dict[str, Any]:
    """Whether the judge answers, and how much work is waiting on it."""
    try:
        judge = judge_client.health()
    except JudgeError:
        judge = None
    backlog_query = sa.text("""
        select count(*) filter (where state = 'pending') as "pending",
               count(*) filter (where state in ('queued', 'running')) as "inFlight",
               count(*) filter (where retries > 0 and state <> 'done') as "retrying",
               count(*) filter (where verdict = 'IE' and cancelled = false) as "internalErrors"
        from judgement where superseded_at is null
    """)
    with db.transaction() as conn:
        backlog = conn.execute(backlog_query).mappings().one()
    return {"judge": judge, "backlog": dict(backlog), "server_now": clock.now_ms()}


def recent_audit(limit: int = 200) -> list[dict[str, Any]]:
    with db.transaction() as conn:
        found = (
            conn.execute(
                sa.select(audit_log, user.c.name.label("actor"))
                .outerjoin(user, user.c.id == audit_log.c.actor_id)
                .order_by(audit_log.c.id.desc())
                .limit(limit)
            )
            .mappings()
            .all()
        )
    return [
        {
            **camel_row({k: v for k, v in r.items() if k != "actor"}),
            "actor": r["actor"],
            "created_at": clock.iso(r["created_at"]),
        }
        for r in found
    ]


def export_all() -> dict[str, Any]:
    """Everything, for the record."""
    with db.transaction() as conn:
        people = (
            conn.execute(
                sa.select(participant, user.c.name).join(user, user.c.id == participant.c.user_id)
            )
            .mappings()
            .all()
        )
        participants = []
        for r in people:
            without_name = {k: v for k, v in r.items() if k != "name"}
            participants.append({"p": camel_row(without_name), "name": r["name"]})
        return {
            "exported_at": clock.iso(clock.now()),
            "contest": camel_row(conn.execute(sa.select(contest)).mappings().one()),
            "participants": participants,
            "questions": rows(conn.execute(sa.select(question))),
            "ownership": rows(conn.execute(sa.select(ownership))),
            "ledger": rows(conn.execute(sa.select(ledger).order_by(ledger.c.id))),
            "submissions": rows(conn.execute(sa.select(submission).order_by(submission.c.id))),
            "judgements": rows(conn.execute(sa.select(judgement).order_by(judgement.c.id))),
            "hint_purchases": rows(conn.execute(sa.select(hint_purchase))),
            "phase1_questions": rows(conn.execute(sa.select(p1_question))),
            "phase1_answers": rows(conn.execute(sa.select(p1_answer))),
            "phase1_hack_questions": rows(conn.execute(sa.select(p1_hack_question))),
            "audit": rows(conn.execute(sa.select(audit_log).order_by(audit_log.c.id))),
        }
