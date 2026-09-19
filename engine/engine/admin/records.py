"""Submissions and hack attempts in full, for staff resolving disputes.

These carry jury detail and verdicts, and the testcase a judgement failed on.
"""

from __future__ import annotations

from typing import Any

import sqlalchemy as sa

from engine.core import clock, db, errors
from engine.core.serialize import camel_row
from engine.judge import client as judge_client
from engine.judge.client import JudgeError
from engine.schema import judgement, p1_hack_attempt, p1_hack_question, question, submission, user


def failing_testcase(
    question_id: str, first_fail: int | None, version: str | None
) -> dict[str, Any] | None:
    """The testcase a judgement failed on, read at the exact version it was judged against."""
    if first_fail is None or not version:
        return None
    try:
        return judge_client.testcase(question_id, first_fail, version)
    except JudgeError:
        return None


def submissions(question_id: str | None, participant_id: str | None) -> list[dict[str, Any]]:
    """Submissions with full jury detail, for disputes."""
    query = (
        sa.select(
            judgement,
            submission.c.id.label("sub_id"),
            submission.c.participant_id.label("sub_participant"),
            user.c.name,
            submission.c.question_id.label("sub_question"),
            question.c.title,
            submission.c.language,
            submission.c.created_at.label("submitted_at"),
        )
        .select_from(submission)
        .join(
            judgement,
            sa.and_(
                judgement.c.submission_id == submission.c.id, judgement.c.superseded_at.is_(None)
            ),
        )
        .join(user, user.c.id == submission.c.participant_id)
        .join(question, question.c.id == submission.c.question_id)
        .order_by(submission.c.id.desc())
        .limit(500)
    )
    if question_id:
        query = query.where(submission.c.question_id == question_id)
    if participant_id:
        query = query.where(submission.c.participant_id == participant_id)
    with db.transaction() as conn:
        found = conn.execute(query).all()
    return [_submission_row(r) for r in found]


def _submission_row(r: sa.Row) -> dict[str, Any]:
    j = {column.name: r._mapping[column] for column in judgement.columns}
    return {
        "id": r.sub_id,
        "participant_id": r.sub_participant,
        "name": r.name,
        "question_id": r.sub_question,
        "title": r.title,
        "language": r.language,
        "created_at": clock.iso(r.submitted_at),
        "judgement": {
            **camel_row(j),
            "created_at": clock.iso(j["created_at"]),
            "ended_at": clock.iso(j["ended_at"]),
        },
    }


def submission_detail(submission_id: int) -> dict[str, Any]:
    """One submission with every judgement of it, and the testcase the current one failed on."""
    with db.transaction() as conn:
        s = (
            conn.execute(sa.select(submission).where(submission.c.id == submission_id))
            .mappings()
            .one_or_none()
        )
        if s is None:
            raise errors.not_found("submission")
        js = (
            conn.execute(
                sa.select(judgement)
                .where(judgement.c.submission_id == submission_id)
                .order_by(judgement.c.attempt.desc())
            )
            .mappings()
            .all()
        )
    current = next((j for j in js if j["superseded_at"] is None), None)
    failing = None
    if current:
        failing = failing_testcase(
            s["question_id"], current["first_fail"], current["problem_version"]
        )
    return {
        "submission": {**camel_row(s), "created_at": clock.iso(s["created_at"])},
        "judgements": [camel_row(j) for j in js],
        "failing_testcase": failing,
    }


def hack_attempts() -> list[dict[str, Any]]:
    """Hack attempts in full, verdicts included."""
    with db.transaction() as conn:
        found = (
            conn.execute(
                sa.select(p1_hack_attempt, p1_hack_question.c.title, user.c.name)
                .join(p1_hack_question, p1_hack_question.c.id == p1_hack_attempt.c.question_id)
                .join(user, user.c.id == p1_hack_attempt.c.participant_id)
                .order_by(p1_hack_attempt.c.id.desc())
                .limit(500)
            )
            .mappings()
            .all()
        )
    return [
        {
            **camel_row({k: v for k, v in r.items() if k not in ("title", "name")}),
            "created_at": clock.iso(r["created_at"]),
            "title": r["title"],
            "name": r["name"],
        }
        for r in found
    ]
