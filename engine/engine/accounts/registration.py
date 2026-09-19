"""Creating accounts: participants, staff, and the first administrator.

Signing in and out stays with Better Auth in the web app, which owns the
session cookie. The engine inserts users and credential accounts in the same
shape Better Auth's sign-up does, so an account made here signs in there.

Concurrency: a display name is unique because the database says so (unique
username and email). Two people registering the same name at the same moment
both reach the insert; one wins and the other gets `name_taken`. The user row,
their participant row and the starting-balance ledger line are one transaction,
so a half-registered account cannot exist.
"""

from __future__ import annotations

import logging
import re

import sqlalchemy as sa
from sqlalchemy.exc import IntegrityError

from engine.accounts.credentials import generate_id, hash_password
from engine.accounts.viewer import naive_utc_now
from engine.contest.rules import lock_contest
from engine.core import db, errors
from engine.core.audit import audit
from engine.core.config import settings
from engine.schema import account, ledger, participant, user

log = logging.getLogger("engine.accounts")


DISPLAY_NAME = re.compile(r"^[A-Za-z0-9_][A-Za-z0-9_ .-]{1,31}$")


BETTER_AUTH_USERNAME = re.compile(r"^[a-zA-Z0-9_.]+$")


def _new_user(
    conn: sa.Connection,
    display_name: str,
    password: str,
    role: str,
    preferred_language: str | None = None,
) -> str:
    """Insert the user and its credential account as Better Auth's sign-up would.

    Returns the user id.
    """
    display_name = display_name.strip()
    if not DISPLAY_NAME.match(display_name):
        raise errors.invalid("display name: 2–32 letters, digits, spaces, _ . -")
    if len(password) < 8:
        raise errors.invalid("password: at least 8 characters")
    handle = re.sub(r"\s+", "_", display_name)
    if not BETTER_AUTH_USERNAME.match(handle):
        raise errors.invalid("Username is invalid")
    user_id = generate_id()
    now = naive_utc_now()
    try:
        conn.execute(
            sa.insert(user).values(
                id=user_id,
                name=display_name,
                email=f"{handle.lower()}@contest.local",
                email_verified=False,
                created_at=now,
                updated_at=now,
                username=handle.lower(),
                display_username=display_name,
                role=role,
                banned=False,
                preferred_language=preferred_language,
            )
        )
    except IntegrityError:
        # The raise below ends the transaction, rolling back everything it did.
        raise errors.conflict(
            "name_taken",
            "that display name is already registered; pick another",
        ) from None
    conn.execute(
        sa.insert(account).values(
            id=generate_id(),
            account_id=user_id,
            provider_id="credential",
            user_id=user_id,
            password=hash_password(password),
            created_at=now,
            updated_at=now,
        )
    )
    return user_id


def _enrol(conn: sa.Connection, user_id: str, balance: int, preferred_language: str | None) -> None:
    """Everyone starts on the identical configured balance, with a ledger line saying so."""
    conn.execute(
        sa.insert(participant).values(
            user_id=user_id,
            balance=balance,
            preferred_language=preferred_language,
        )
    )
    conn.execute(
        sa.insert(ledger).values(
            participant_id=user_id,
            delta=balance,
            balance_after=balance,
            reason="starting_balance",
        )
    )


def register_participant(display_name: str, password: str, preferred_language: str | None) -> str:
    """Self-registration at a machine in the hall."""
    with db.transaction() as conn:
        c = lock_contest(conn)  # registration cannot close halfway through someone registering
        if not c.registration_open or c.phase != "registration":
            raise errors.conflict("registration_closed", "registration is closed")
        user_id = _new_user(conn, display_name, password, "participant", preferred_language)
        _enrol(conn, user_id, c.starting_balance, preferred_language)
    return user_id


def create_participant(
    actor_id: str,
    display_name: str,
    password: str,
    preferred_language: str | None,
    reason: str,
) -> str:
    """An organiser adding someone by hand.

    Ignores the registration gate, never the starting balance.
    """
    with db.transaction() as conn:
        c = lock_contest(conn)
        user_id = _new_user(conn, display_name, password, "participant", preferred_language)
        _enrol(conn, user_id, c.starting_balance, preferred_language)
        detail = {
            "username": display_name,
            "balance": c.starting_balance,
            "phase": c.phase,
        }
        audit(
            conn,
            actor_id=actor_id,
            action="participant.create",
            target=user_id,
            reason=reason,
            detail=detail,
        )
    return user_id


def create_staff(actor_id: str, display_name: str, password: str, role: str, reason: str) -> str:
    with db.transaction() as conn:
        user_id = _new_user(conn, display_name, password, role)
        audit(
            conn,
            actor_id=actor_id,
            action="staff.create",
            target=user_id,
            reason=reason,
            detail={"role": role, "username": display_name},
        )
    return user_id


def ensure_admin() -> None:
    """On first start, create the administrator named in the environment.

    Never a default password.
    """
    try:
        with db.transaction() as conn:
            any_admin = sa.select(user.c.id).where(user.c.role == "admin").limit(1)
            if conn.execute(any_admin).first():
                return
            if not settings.admin_password:
                log.warning(
                    "no administrator exists and ADMIN_PASSWORD is not set; set it and restart"
                )
                return
            _new_user(conn, settings.admin_username, settings.admin_password, "admin")
    except errors.EngineError as err:
        log.warning("could not create administrator: %s", err.message)
        return
    log.info("created administrator '%s'", settings.admin_username)
