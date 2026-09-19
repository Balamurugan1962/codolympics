"""Announcements to everyone, and notifications to one participant.

Announcements are staff actions, so they are audited and pushed on the event
feed. Notifications are written inside the caller's transaction and show up as
unread in that participant's state until they mark them read.
"""

from __future__ import annotations

from typing import Any

import sqlalchemy as sa

from engine.core import clock, db, events
from engine.core.audit import audit
from engine.core.serialize import rows
from engine.schema import announcement, notification


def notify(conn: sa.Connection, participant_id: str, body_md: str) -> None:
    """Something one participant must be told. Written in the caller's transaction."""
    conn.execute(sa.insert(notification).values(participant_id=participant_id, body_md=body_md))


def announce(actor_id: str, body_md: str) -> None:
    with db.transaction() as conn:
        conn.execute(sa.insert(announcement).values(body_md=body_md))
        audit(
            conn,
            actor_id=actor_id,
            action="announce",
            reason="announcement",
            detail={"bodyMd": body_md},
        )
    events.publish("announce", {"body_md": body_md})


def recent_announcements(conn: sa.Connection, limit: int) -> list[dict[str, Any]]:
    newest_first = sa.select(announcement).order_by(announcement.c.id.desc()).limit(limit)
    return rows(conn.execute(newest_first))


def announcements(limit: int = 200) -> list[dict[str, Any]]:
    with db.transaction() as conn:
        return recent_announcements(conn, limit)


def unread(conn: sa.Connection, participant_id: str) -> list[dict[str, Any]]:
    found = conn.execute(
        sa.select(notification)
        .where(
            notification.c.participant_id == participant_id,
            notification.c.read_at.is_(None),
        )
        .order_by(notification.c.id.desc())
    ).all()
    return [
        {
            "id": n.id,
            "body_md": n.body_md,
            "created_at": clock.iso(n.created_at),
        }
        for n in found
    ]


def mark_all_read(participant_id: str) -> None:
    with db.transaction() as conn:
        conn.execute(
            sa.update(notification)
            .where(
                notification.c.participant_id == participant_id,
                notification.c.read_at.is_(None),
            )
            .values(read_at=clock.now())
        )
