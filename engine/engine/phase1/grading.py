"""Manual grading of Section A: the evaluators' queue, and recording a grade.

The queue holds every answer to a published, unvoided question that needs a person:
manually graded questions, and any question that awards points for an explanation.
"""

from __future__ import annotations

from typing import Any

import sqlalchemy as sa

from engine.core import clock, db, errors, events
from engine.core.audit import audit
from engine.schema import p1_answer, p1_question, user


def grading_queue() -> dict[str, Any]:
    """Every manually graded answer, grouped by question."""
    with db.transaction() as conn:
        found = conn.execute(
            sa.select(
                p1_answer,
                p1_question.c.title,
                p1_question.c.body_md,
                p1_question.c.kind,
                p1_question.c.grading,
                p1_question.c.points,
                p1_question.c.explain_points,
                p1_question.c.model_answer,
                p1_question.c.order_index,
                user.c.name,
            )
            .join(p1_question, p1_question.c.id == p1_answer.c.question_id)
            .join(user, user.c.id == p1_answer.c.participant_id)
            .where(
                p1_question.c.published.is_(True),
                p1_question.c.voided.is_(False),
                sa.or_(p1_question.c.grading == "manual", p1_question.c.explain_points > 0),
            )
            .order_by(p1_question.c.order_index, p1_answer.c.updated_at)
        ).all()
    groups: dict[int, dict[str, Any]] = {}
    for r in found:
        group = groups.setdefault(r.question_id, {"question": _queue_question(r), "items": []})
        group["items"].append(_queue_item(r))
    ungraded = sum(
        1
        for r in found
        if (r.grading == "manual" and r.manual_score is None)
        or (r.explain_points > 0 and r.explain_score is None)
    )
    return {"ungraded": ungraded, "total": len(found), "groups": list(groups.values())}


def _queue_question(r: sa.Row) -> dict[str, Any]:
    return {
        "id": r.question_id,
        "title": r.title,
        "body_md": r.body_md,
        "kind": r.kind,
        "grading": r.grading,
        "points": r.points,
        "explain_points": r.explain_points,
        "model_answer": r.model_answer,
    }


def _queue_item(r: sa.Row) -> dict[str, Any]:
    return {
        "participant_id": r.participant_id,
        "name": r.name,
        "answer": r.answer,
        "explanation": r.explanation,
        "manual_score": r.manual_score,
        "explain_score": r.explain_score,
        "comment": r.grade_comment,
        "graded_by": r.graded_by,
        "flagged": r.flagged,
        "auto_score": r.auto_score,
    }


def grade(
    grader_id: str,
    participant_id: str,
    question_id: int,
    *,
    manual_score: int | None = None,
    explain_score: int | None = None,
    comment: str | None = None,
    flagged: bool | None = None,
) -> None:
    with db.transaction() as conn:
        q = conn.execute(
            sa.select(p1_question).where(p1_question.c.id == question_id)
        ).one_or_none()
        if q is None:
            raise errors.not_found("question")
        if manual_score is not None and (
            q.grading != "manual" or not 0 <= manual_score <= q.points
        ):
            raise errors.invalid(f"manual score must be 0–{q.points}")
        if explain_score is not None and not 0 <= explain_score <= q.explain_points:
            raise errors.invalid(f"explanation score must be 0–{q.explain_points}")
        values: dict[str, Any] = {
            "grade_comment": comment,
            "graded_by": grader_id,
            "graded_at": clock.now(),
        }
        # Fields left out of the request keep what they had.
        optional = {
            "manual_score": manual_score,
            "explain_score": explain_score,
            "flagged": flagged,
        }
        for column, value in optional.items():
            if value is not None:
                values[column] = value
        conn.execute(
            sa.update(p1_answer)
            .where(
                p1_answer.c.participant_id == participant_id,
                p1_answer.c.question_id == question_id,
            )
            .values(**values)
        )
        detail = {
            "participantId": participant_id,
            "questionId": question_id,
            "manualScore": manual_score,
            "explainScore": explain_score,
            "comment": comment,
            "flagged": flagged,
        }
        audit(
            conn,
            actor_id=grader_id,
            action="p1.grade",
            target=f"{participant_id}/{question_id}",
            reason="grading",
            detail=detail,
        )
    events.publish("leaderboard")
