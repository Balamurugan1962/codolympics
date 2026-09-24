"""Authoring Phase 1 questions: create, edit, publish, void, reorder, override scores.

Covers both Section A puzzles and Section B hack questions. Readiness is earned by
a self-test (see self_tests) and lost by an edit: any edit to a puzzle, an edit to
the code of a hack question. A question can only be published while ready, so what
participants see has always been proven to work.

Section B is read live, so every change to it is announced with a `hacking` event
and each open page re-reads the section.
"""

from __future__ import annotations

import re
from typing import Any

import sqlalchemy as sa

from engine.core import db, errors, events
from engine.core.audit import audit
from engine.core.serialize import rows, to_camel
from engine.phase1 import solutions
from engine.schema import p1_answer, p1_hack_attempt, p1_hack_question, p1_question

PUZZLE_FIELDS = (
    "title",
    "body_md",
    "category",
    "kind",
    "grading",
    "points",
    "explain_points",
    "order_index",
    "config",
    "answer_key",
    "model_answer",
    "validator_py",
    "points_per_entry",
    "max_entries",
    "format_regex",
    "format_hint",
)


HACK_FIELDS = (
    "title",
    "statement_md",
    "constraints_md",
    "problem_id",
    "hack_points",
    "fail_penalty",
    "order_index",
)


def table_for(section: str) -> sa.Table:
    if section == "puzzles":
        return p1_question
    if section == "hacking":
        return p1_hack_question
    raise errors.not_found("section")


def get_question(
    conn: sa.Connection, table: sa.Table, question_id: int, *, lock: bool = False
) -> sa.Row:
    query = sa.select(table).where(table.c.id == question_id)
    if lock:
        query = query.with_for_update()
    found = conn.execute(query).one_or_none()
    if found is None:
        raise errors.not_found("question")
    return found


def list_section(section: str) -> list[dict[str, Any]]:
    """Every question in a section, secrets included. Staff only."""
    table = table_for(section)
    with db.transaction() as conn:
        found = rows(conn.execute(sa.select(table).order_by(table.c.order_index, table.c.id)))
        if section == "hacking":
            copies = solutions.for_questions(conn, [q["id"] for q in found])
            for q in found:
                q["solutions"] = [solutions.staff_view(s) for s in copies[q["id"]]]
        return found


def _changed(section: str) -> None:
    """Section B is on participants' screens while it is edited."""
    if section == "hacking":
        events.publish("hacking")


def _check_puzzle(fields: dict[str, Any]) -> None:
    if fields["grading"] == "auto" and not fields.get("answer_key"):
        raise errors.invalid("auto grading needs an answer key")
    if fields["grading"] == "validator" and not fields.get("validator_py"):
        raise errors.invalid("validator grading needs validator code")
    if fields["grading"] == "validator" and not fields.get("points_per_entry"):
        raise errors.invalid("validator grading needs points per entry")
    if fields.get("format_regex"):
        try:
            re.compile(fields["format_regex"])
        except re.error:
            raise errors.invalid("format regex does not compile") from None


def create(actor_id: str, section: str, fields: dict[str, Any], reason: str) -> int:
    table = table_for(section)
    allowed = PUZZLE_FIELDS if section == "puzzles" else HACK_FIELDS
    values = {k: fields[k] for k in allowed if k in fields}
    if section == "puzzles":
        _check_puzzle(values)
    with db.transaction() as conn:
        new_id = conn.execute(
            sa.insert(table).values(**values, published=False, ready=False).returning(table.c.id)
        ).scalar_one()
        if section == "hacking":
            solutions.replace(conn, new_id, fields.get("solutions") or [])
        action = "p1.puzzle.create" if section == "puzzles" else "p1.hack.create"
        audit(
            conn,
            actor_id=actor_id,
            action=action,
            target=str(new_id),
            reason=reason,
            detail={"title": values["title"]},
        )
    return new_id


def update(
    actor_id: str, section: str, question_id: int, fields: dict[str, Any], reason: str
) -> None:
    """A puzzle edit voids readiness: the self-test must run again.

    A hack question's readiness follows its solutions: a copy whose code changed
    loses its proof and keeps its breaking input, so it can be tried first; a copy
    given back unchanged keeps its proof.
    """
    table = table_for(section)
    allowed = PUZZLE_FIELDS if section == "puzzles" else HACK_FIELDS
    values = {k: fields[k] for k in allowed if k in fields}
    with db.transaction() as conn:
        current = get_question(conn, table, question_id, lock=True)
        if section == "puzzles":
            _check_puzzle({**current._mapping, **values})
            values.update(ready=False, verified_elsewhere=False)
        if values:
            conn.execute(sa.update(table).where(table.c.id == question_id).values(**values))
        if section == "hacking":
            if "solutions" in fields:
                solutions.replace(conn, question_id, fields["solutions"])
                values["solutions"] = fields["solutions"]
            solutions.refresh_ready(conn, question_id)
        action = "p1.puzzle.update" if section == "puzzles" else "p1.hack.update"
        audit(
            conn,
            actor_id=actor_id,
            action=action,
            target=str(question_id),
            reason=reason,
            detail=[to_camel(k) for k in values],
        )
    _changed(section)


def delete_question(actor_id: str, section: str, question_id: int, reason: str) -> None:
    """Remove a question altogether, if nobody has done anything with it yet.

    Answers and attempts are people's work and results, so a question that has any
    is voided instead: it leaves the contest but the record stays.
    """
    table = table_for(section)
    history = p1_answer if section == "puzzles" else p1_hack_attempt
    with db.transaction() as conn:
        get_question(conn, table, question_id, lock=True)
        used = conn.execute(
            sa.select(sa.func.count())
            .select_from(history)
            .where(history.c.question_id == question_id)
        ).scalar_one()
        if used:
            noun = "answered" if section == "puzzles" else "attempted"
            raise errors.conflict(
                "has_history",
                f"{used} {'answers' if section == 'puzzles' else 'attempts'} exist: "
                f"someone has {noun} this question, so void it instead of deleting it",
            )
        conn.execute(sa.delete(table).where(table.c.id == question_id))
        noun = "puzzle" if section == "puzzles" else "hack"
        audit(
            conn,
            actor_id=actor_id,
            action=f"p1.{noun}.delete",
            target=str(question_id),
            reason=reason,
        )
    _changed(section)


def set_published(
    actor_id: str, section: str, question_id: int, published: bool, reason: str
) -> None:
    table = table_for(section)
    with db.transaction() as conn:
        q = get_question(conn, table, question_id, lock=True)
        if published and not q.ready:
            if section == "puzzles":
                proof = "run the self-test first"
            else:
                proof = "prove a breaking input first"
            raise errors.conflict("not_ready", f"{proof}; the question is not marked ready")
        conn.execute(sa.update(table).where(table.c.id == question_id).values(published=published))
        noun = "puzzle" if section == "puzzles" else "hack"
        verb = "publish" if published else "unpublish"
        audit(
            conn,
            actor_id=actor_id,
            action=f"p1.{noun}.{verb}",
            target=str(question_id),
            reason=reason,
        )
    _changed(section)


def void(actor_id: str, section: str, question_id: int, reason: str) -> None:
    table = table_for(section)
    with db.transaction() as conn:
        conn.execute(sa.update(table).where(table.c.id == question_id).values(voided=True))
        noun = "puzzle" if section == "puzzles" else "hack"
        audit(
            conn,
            actor_id=actor_id,
            action=f"p1.{noun}.void",
            target=str(question_id),
            reason=reason,
        )
    events.publish("leaderboard")
    _changed(section)


def reorder(actor_id: str, section: str, ids: list[int], reason: str) -> None:
    """The whole order at once.

    Two organisers reordering together then cannot produce an order neither chose.
    """
    table = table_for(section)
    with db.transaction() as conn:
        existing = set(conn.execute(sa.select(table.c.id).with_for_update()).scalars())
        if len(ids) != len(existing) or set(ids) != existing:
            raise errors.invalid("the order must list every question exactly once")
        for position, question_id in enumerate(ids):
            conn.execute(
                sa.update(table).where(table.c.id == question_id).values(order_index=position)
            )
        audit(
            conn,
            actor_id=actor_id,
            action=f"phase1.{section}.reorder",
            reason=reason,
            detail={"ids": ids},
        )
    _changed(section)


def override_score(
    actor_id: str,
    participant_id: str,
    question_id: int,
    reason: str,
    *,
    auto_score: int | None = None,
    manual_score: int | None = None,
    explain_score: int | None = None,
) -> None:
    values: dict[str, Any] = {"graded_by": actor_id, "graded_at": sa.func.now()}
    if auto_score is not None:
        values["auto_score"] = auto_score
        values["score_state"] = "done"
        values["score_error"] = None
    if manual_score is not None:
        values["manual_score"] = manual_score
    if explain_score is not None:
        values["explain_score"] = explain_score
    with db.transaction() as conn:
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
            "autoScore": auto_score,
            "manualScore": manual_score,
            "explainScore": explain_score,
            "reason": reason,
        }
        audit(
            conn,
            actor_id=actor_id,
            action="p1.score.override",
            target=f"{participant_id}/{question_id}",
            reason=reason,
            detail=detail,
        )
    events.publish("leaderboard")
