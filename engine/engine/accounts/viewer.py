"""Who is calling: the signed-in person behind a Better Auth session token.

The engine never issues sessions; it only reads Better Auth's session table,
whose timestamps are naive UTC (hence `naive_utc_now`).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

import sqlalchemy as sa

from engine.core import db
from engine.schema import participant, session, user


@dataclass(frozen=True)
class Viewer:
    id: str
    name: str
    username: str
    role: str
    # A participant locked out for leaving the page: reads are fine, writes are refused.
    locked: bool = False

    def as_dict(self) -> dict[str, str]:
        return {
            "id": self.id,
            "name": self.name,
            "username": self.username,
            "role": self.role,
        }


def viewer_for_session_token(token: str) -> Viewer | None:
    """The signed-in person behind a Better Auth session token.

    None unless the session is live and the user is not banned.
    """
    with db.transaction() as conn:
        row = conn.execute(
            sa.select(
                user.c.id,
                user.c.name,
                user.c.username,
                user.c.role,
                user.c.banned,
                participant.c.proctor_locked_at,
            )
            .join(session, session.c.user_id == user.c.id)
            .outerjoin(participant, participant.c.user_id == user.c.id)
            .where(session.c.token == token, session.c.expires_at > naive_utc_now())
        ).one_or_none()
    if row is None or row.banned:
        return None
    return Viewer(
        id=row.id,
        name=row.name,
        username=row.username or row.name,
        role=row.role or "participant",
        locked=row.proctor_locked_at is not None,
    )


def naive_utc_now() -> datetime:
    # Better Auth stores `timestamp without time zone`, in UTC.
    return datetime.now(UTC).replace(tzinfo=None)
