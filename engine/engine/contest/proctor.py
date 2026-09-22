"""Keeping a competitor on the page: full screen, focused, or locked out.

While a round runs, the browser holds the contest in full screen with the
window focused. The page itself watches for the three ways out (leaving full
screen, the window losing focus, the tab being hidden) and reports each one
here as an alert. The organisers hear about every alert. After the contest's
`proctor_warnings` alerts, the next one locks the account: the page shows a
locked screen, every write from that account is refused (see api/auth.py),
and only an administrator can unlock it, which also clears the count.

The count is per lock, not per contest: an unlock is a fresh start, or the
next slip would lock them straight away.
"""

from __future__ import annotations

from typing import Any

import sqlalchemy as sa

from engine.accounts import wallet
from engine.contest.rules import get_contest
from engine.core import clock, db, errors, events
from engine.core.audit import audit
from engine.schema import participant, proctor_event, user

KINDS = ("fullscreen", "blur", "hidden")

# Which way out, in the words the organisers read.
_LEFT = {
    "fullscreen": "left full screen",
    "blur": "switched away from the window",
    "hidden": "hid the tab",
}


def state_of(c: sa.Row, p: sa.Row) -> dict[str, Any]:
    """What the page needs: whether it must hold the screen, and where they stand."""
    return {
        "enabled": c.proctoring,
        "alerts": p.proctor_alerts,
        "warnings": c.proctor_warnings,
        "locked": p.proctor_locked_at is not None,
    }


def report(participant_id: str, kind: str) -> dict[str, Any]:
    """One more time they left the page. Locks them once the warnings are used up."""
    if kind not in KINDS:
        raise errors.invalid("unknown kind of alert")
    with db.transaction() as conn:
        c = get_contest(conn)
        p = wallet.lock_participant(conn, participant_id)
        if p is None:
            raise errors.not_found("participant")
        if not c.proctoring or p.proctor_locked_at is not None:
            return state_of(c, p)
        conn.execute(sa.insert(proctor_event).values(participant_id=participant_id, kind=kind))
        alerts = p.proctor_alerts + 1
        locked = alerts > c.proctor_warnings
        values: dict[str, Any] = {"proctor_alerts": alerts}
        if locked:
            values["proctor_locked_at"] = clock.now()
            audit(
                conn,
                actor_id=None,
                action="proctor.lock",
                target=participant_id,
                reason=f"{_LEFT[kind]}, alert {alerts} of {c.proctor_warnings} allowed",
                detail={"kind": kind, "alerts": alerts},
            )
        p = conn.execute(
            sa.update(participant)
            .where(participant.c.user_id == participant_id)
            .values(**values)
            .returning(participant)
        ).one()
        state = state_of(c, p)
        name = _name(conn, participant_id)
        admins = _admins(conn)
    for admin_id in admins:
        events.publish(
            "proctor",
            {"participant_id": participant_id, "name": name, "kind": kind, **state},
            admin_id,
        )
    if locked:
        events.publish("proctor", {"locked": True}, participant_id)
    return state


def unlock(actor_id: str, participant_id: str, reason: str) -> None:
    """An administrator lets them back in, with the count cleared."""
    with db.transaction() as conn:
        p = wallet.lock_participant(conn, participant_id)
        if p is None:
            raise errors.not_found("participant")
        if p.proctor_locked_at is None:
            raise errors.conflict("not_locked", "that account is not locked")
        conn.execute(
            sa.update(participant)
            .where(participant.c.user_id == participant_id)
            .values(proctor_alerts=0, proctor_locked_at=None)
        )
        audit(
            conn, actor_id=actor_id, action="proctor.unlock", target=participant_id, reason=reason
        )
        admins = _admins(conn)
        name = _name(conn, participant_id)
    events.publish("proctor", {"locked": False}, participant_id)
    for admin_id in admins:
        events.publish(
            "proctor",
            {"participant_id": participant_id, "name": name, "locked": False, "unlocked": True},
            admin_id,
        )


def alerts_for(conn: sa.Connection, participant_id: str) -> list[dict[str, Any]]:
    """Every time they left the page, newest first, for the organiser's record."""
    found = conn.execute(
        sa.select(proctor_event)
        .where(proctor_event.c.participant_id == participant_id)
        .order_by(proctor_event.c.id.desc())
    ).all()
    return [{"id": r.id, "kind": r.kind, "created_at": clock.iso(r.created_at)} for r in found]


def _name(conn: sa.Connection, participant_id: str) -> str:
    return conn.execute(sa.select(user.c.name).where(user.c.id == participant_id)).scalar_one()


def _admins(conn: sa.Connection) -> list[str]:
    return list(conn.execute(sa.select(user.c.id).where(user.c.role == "admin")).scalars())
