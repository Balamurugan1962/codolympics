"""Repairs to existing accounts: passwords, names, removal, and the staff list."""

from __future__ import annotations

from typing import Any

import sqlalchemy as sa

from engine.accounts.credentials import hash_password
from engine.accounts.viewer import naive_utc_now
from engine.contest.rules import lock_contest
from engine.core import clock, db, errors
from engine.core.audit import audit
from engine.schema import account, ledger, participant, user


def reset_password(actor_id: str, user_id: str, password: str, reason: str) -> None:
    if len(password) < 8:
        raise errors.invalid("password: at least 8 characters")
    with db.transaction() as conn:
        updated = conn.execute(
            sa.update(account)
            .where(account.c.user_id == user_id, account.c.provider_id == "credential")
            .values(password=hash_password(password), updated_at=naive_utc_now())
        ).rowcount
        if not updated:
            raise errors.not_found("account")
        audit(conn, actor_id=actor_id, action="password.reset", target=user_id, reason=reason)


def rename(actor_id: str, user_id: str, name: str, reason: str) -> None:
    with db.transaction() as conn:
        conn.execute(
            sa.update(user).where(user.c.id == user_id).values(name=name, display_username=name)
        )
        audit(
            conn,
            actor_id=actor_id,
            action="user.rename",
            target=user_id,
            reason=reason,
            detail={"name": name},
        )


def remove(actor_id: str, user_id: str, reason: str) -> None:
    """Delete an account outright -- only before the contest starts.

    Afterwards, disqualify instead.
    """
    with db.transaction() as conn:
        if lock_contest(conn, exclusive=True).phase != "registration":
            raise errors.conflict(
                "contest_running",
                "accounts can only be removed during registration; disqualify instead",
            )
        conn.execute(sa.delete(ledger).where(ledger.c.participant_id == user_id))
        conn.execute(sa.delete(participant).where(participant.c.user_id == user_id))
        conn.execute(sa.delete(user).where(user.c.id == user_id))
        audit(conn, actor_id=actor_id, action="user.remove", target=user_id, reason=reason)


def staff_overview() -> list[dict[str, Any]]:
    with db.transaction() as conn:
        found = conn.execute(
            sa.select(user.c.id, user.c.name, user.c.username, user.c.role, user.c.created_at)
            .where(user.c.role.in_(("admin", "evaluator")))
            .order_by(user.c.role, user.c.name)
        ).all()
    return [
        {
            "id": r.id,
            "name": r.name,
            "username": r.username,
            "role": r.role or "evaluator",
            "created_at": clock.iso(r.created_at),
        }
        for r in found
    ]
