"""Who may work on a question, and since when their clock has been running.

Until the last round a question belongs to whoever bought it, and only they may work on it,
timed from the purchase. In the common round (`final`) that flips: every question nobody
bought is open to everyone at once, timed from the moment the round began, and everything
that was bought in round 1 is closed for good.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

import sqlalchemy as sa

from engine.contest.rules import get_contest
from engine.core import clock
from engine.schema import ownership, p1_advancement, question

COMMON_PHASE = "final"


@dataclass(frozen=True)
class Access:
    kind: str  # "owned" or "common"
    since: datetime  # what a solve is timed from


def common_started_at(c: sa.Row) -> datetime:
    """When the common round began, worked out for a contest that was already in it."""
    if c.final_started_at:
        return c.final_started_at
    if c.phase_ends_at and c.final_minutes:
        return c.phase_ends_at - timedelta(minutes=c.final_minutes)
    return clock.now()


def selected(conn: sa.Connection, participant_id: str) -> bool:
    """Whether the organisers chose this person for Phase 2."""
    return bool(
        conn.execute(
            sa.select(p1_advancement.c.advanced).where(
                p1_advancement.c.participant_id == participant_id
            )
        ).scalar()
    )


def access_to(conn: sa.Connection, participant_id: str, question_id: str) -> Access | None:
    c = get_contest(conn)
    if c.phase == COMMON_PHASE:
        if not selected(conn, participant_id):
            return None
        status = conn.execute(
            sa.select(question.c.status).where(question.c.id == question_id)
        ).scalar()
        return Access("common", common_started_at(c)) if status == "unsold" else None
    own = conn.execute(
        sa.select(ownership.c.awarded_at).where(
            ownership.c.question_id == question_id,
            ownership.c.participant_id == participant_id,
            ownership.c.voided_at.is_(None),
        )
    ).first()
    return Access("owned", own.awarded_at) if own else None
