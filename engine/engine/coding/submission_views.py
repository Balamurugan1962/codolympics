"""Submissions and judgements as their author may see them. Jury detail never leaves the server."""

from __future__ import annotations

from typing import Any

import sqlalchemy as sa

from engine.coding.submissions import cooldown_ms, in_flight
from engine.core import clock, db, errors
from engine.schema import judgement, participant, submission


def participant_view(j: sa.Row) -> dict[str, Any]:
    """A judgement as its author may see it. `jury_detail` is deliberately absent."""
    return {
        "id": j.id,
        "state": j.state,
        "verdict": j.verdict,
        "passed": j.passed,
        "total": j.total,
        "first_fail": j.first_fail,
        "max_time_ms": j.max_time_ms,
        "max_memory_kb": j.max_memory_kb,
        "compile_output": j.compile_output,
        "message": j.message,
        "progress": {"done": j.progress_done, "total": j.progress_total},
        "cancelled": j.cancelled,
        "created_at": clock.iso(j.created_at),
        "ended_at": clock.iso(j.ended_at),
    }


def history(conn: sa.Connection, participant_id: str, question_id: str) -> list[dict[str, Any]]:
    """A participant's submissions for one question, newest first, with current judgements."""
    found = conn.execute(
        sa.select(
            judgement,
            submission.c.id.label("sub_id"),
            submission.c.language,
            submission.c.created_at.label("submitted_at"),
        )
        .join(submission, submission.c.id == judgement.c.submission_id)
        .where(
            submission.c.participant_id == participant_id,
            submission.c.question_id == question_id,
            judgement.c.superseded_at.is_(None),
        )
        .order_by(submission.c.id.desc())
    ).all()
    return [
        {
            "id": r.sub_id,
            "language": r.language,
            "created_at": clock.iso(r.submitted_at),
            "judgement": participant_view(r),
        }
        for r in found
    ]


def submit_status(conn: sa.Connection, participant_id: str) -> dict[str, Any]:
    """Whether something is in flight, and how long until they may submit again."""
    p = conn.execute(
        sa.select(participant).where(participant.c.user_id == participant_id)
    ).one_or_none()
    return {
        "in_flight": bool(in_flight(conn, participant_id)),
        "cooldown_ms": cooldown_ms(p) if p else 0,
        "server_now": clock.now_ms(),
    }


def one_for_participant(participant_id: str, submission_id: int) -> dict[str, Any]:
    """One submission's current judgement -- the narrow response the workspace polls."""
    with db.transaction() as conn:
        row = conn.execute(
            sa.select(
                judgement,
                submission.c.id.label("sub_id"),
                submission.c.question_id,
                submission.c.language,
                submission.c.created_at.label("submitted_at"),
            )
            .join(submission, submission.c.id == judgement.c.submission_id)
            .where(
                submission.c.id == submission_id,
                submission.c.participant_id == participant_id,
                judgement.c.superseded_at.is_(None),
            )
        ).one_or_none()
    if row is None:
        raise errors.not_found("submission")
    return {
        "id": row.sub_id,
        "question_id": row.question_id,
        "language": row.language,
        "created_at": clock.iso(row.submitted_at),
        "judgement": participant_view(row),
        "server_now": clock.now_ms(),
    }
