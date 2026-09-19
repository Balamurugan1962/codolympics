"""Phase 2 questions as their owner sees them, and saving a code draft.

Ownership is checked on every read. A question you do not own is not hidden,
it is unreachable.
"""

from __future__ import annotations

from typing import Any

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import insert as pg_insert

from engine.coding.hints import hints_for
from engine.coding.submission_views import history, submit_status
from engine.coding.submissions import MAX_SOURCE_BYTES, owns
from engine.core import clock, db, errors
from engine.judge import client as judge_client
from engine.judge.client import JudgeError
from engine.packages.volume import samples_for
from engine.schema import draft, judgement, ownership, question, submission


def owned_questions(conn: sa.Connection, participant_id: str) -> list[dict[str, Any]]:
    mine = conn.execute(
        sa.select(question, ownership.c.price_paid, ownership.c.awarded_at)
        .join(ownership, ownership.c.question_id == question.c.id)
        .where(ownership.c.participant_id == participant_id, ownership.c.voided_at.is_(None))
    ).all()
    stats = {s.question_id: s for s in _attempt_stats(conn, participant_id)}
    return [_owned_view(q, stats.get(q.id)) for q in mine]


def _attempt_stats(conn: sa.Connection, participant_id: str) -> list[sa.Row]:
    return conn.execute(
        sa.select(
            submission.c.question_id,
            sa.func.count().label("attempts"),
            sa.func.bool_or(judgement.c.verdict == "AC").label("solved"),
            sa.func.bool_or(judgement.c.state != "done").label("in_flight"),
        )
        .join(
            judgement,
            sa.and_(
                judgement.c.submission_id == submission.c.id,
                judgement.c.superseded_at.is_(None),
            ),
        )
        .where(submission.c.participant_id == participant_id)
        .group_by(submission.c.question_id)
    ).all()


def _owned_view(q: sa.Row, st: sa.Row | None) -> dict[str, Any]:
    attempts = st.attempts if st else 0
    if st and st.solved:
        progress = "solved"
    elif st and st.in_flight:
        progress = "judging"
    elif attempts:
        progress = "attempted"
    else:
        progress = "unattempted"
    return {
        "id": q.id,
        "title": q.title,
        "difficulty": q.difficulty,
        "score": q.score,
        "status": q.status,
        "price_paid": q.price_paid,
        "awarded_at": clock.iso(q.awarded_at),
        "attempts": attempts,
        "progress": progress,
    }


def for_owner(participant_id: str, question_id: str) -> dict[str, Any]:
    with db.transaction() as conn:
        own = owns(conn, participant_id, question_id)
        if own is None:
            raise errors.forbidden("you do not own this question")
        q = conn.execute(sa.select(question).where(question.c.id == question_id)).one_or_none()
        if q is None:
            raise errors.not_found("question")
        saved = conn.execute(
            sa.select(draft).where(
                draft.c.participant_id == participant_id,
                draft.c.question_id == question_id,
            )
        ).one_or_none()
        mine = {
            "hints": hints_for(conn, participant_id, question_id),
            "history": history(conn, participant_id, question_id),
            "submit": submit_status(conn, participant_id),
        }
    info = _judge_info(q.id)
    time_limit_ms = None
    memory_limit_mb = None
    hidden_testcases = None
    if info:
        time_limit_ms = info.get("time_limit_ms")
        memory_limit_mb = info.get("memory_limit_mb")
        # How many hidden testcases, never what is in them.
        hidden_testcases = max(0, info["testcases"] - q.sample_count)
    saved_draft = None
    if saved:
        saved_draft = {
            "source": saved.source,
            "language": saved.language,
            "updated_at": clock.iso(saved.updated_at),
        }
    return {
        "id": q.id,
        "title": q.title,
        "difficulty": q.difficulty,
        "score": q.score,
        "status": q.status,
        "statement_md": q.statement_md,
        "time_limit_ms": time_limit_ms,
        "memory_limit_mb": memory_limit_mb,
        "hidden_testcases": hidden_testcases,
        "sample_count": q.sample_count,
        "samples": samples_for(q.id, q.sample_count, q.problem_version),
        "hints": mine["hints"],
        "history": mine["history"],
        "draft": saved_draft,
        "submit": mine["submit"],
        "awarded_at": clock.iso(own.awarded_at),
    }


def _judge_info(problem_id: str) -> dict[str, Any] | None:
    try:
        return judge_client.problem(problem_id)
    except JudgeError:
        return None


def save_draft(participant_id: str, question_id: str, source: str, language: str) -> None:
    if len(source.encode()) > MAX_SOURCE_BYTES:
        raise errors.invalid("draft is larger than 256 KB")
    values = {"source": source, "language": language, "updated_at": clock.now()}
    stmt = pg_insert(draft).values(participant_id=participant_id, question_id=question_id, **values)
    upsert = stmt.on_conflict_do_update(
        index_elements=["participant_id", "question_id"],
        set_=values,
    )
    with db.transaction() as conn:
        conn.execute(upsert)
