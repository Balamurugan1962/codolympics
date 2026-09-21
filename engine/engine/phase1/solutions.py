"""The flawed code behind a hacking question, one copy per language.

Every copy solves the same problem and every copy is wrong somewhere. A
participant reads whichever language they like and attacks that copy; the
proof that it breaks is kept per copy, because the bug need not be the same
one in every language.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any

import sqlalchemy as sa

from engine.core import errors
from engine.core.serialize import camel_row
from engine.schema import p1_hack_question, p1_hack_solution


def participant_view(s: sa.Row) -> dict[str, Any]:
    """The code is the task; the breaking input is an answer and stays here."""
    return {"id": s.id, "language": s.language, "source": s.source}


def staff_view(s: sa.Row) -> dict[str, Any]:
    return camel_row(s._mapping)


def for_questions(conn: sa.Connection, question_ids: list[int]) -> dict[int, list[sa.Row]]:
    """Every question's solutions, in order, keyed by question id."""
    found: dict[int, list[sa.Row]] = defaultdict(list)
    if not question_ids:
        return found
    for s in conn.execute(
        sa.select(p1_hack_solution)
        .where(p1_hack_solution.c.question_id.in_(question_ids))
        .order_by(p1_hack_solution.c.order_index, p1_hack_solution.c.id)
    ):
        found[s.question_id].append(s)
    return found


def get(conn: sa.Connection, question_id: int, solution_id: int) -> sa.Row:
    """One of the question's solutions, or a 404 when it is not one of them."""
    found = conn.execute(
        sa.select(p1_hack_solution).where(
            p1_hack_solution.c.id == solution_id,
            p1_hack_solution.c.question_id == question_id,
        )
    ).one_or_none()
    if found is None:
        raise errors.not_found("solution")
    return found


def replace(conn: sa.Connection, question_id: int, wanted: list[dict[str, Any]]) -> bool:
    """Make the question's solutions exactly `wanted`, in that order.

    A row is kept, with its proof, when its id is given back and its code has
    not changed. Anything edited loses its proof, anything left out is removed
    (attempts on it keep their score and forget which copy they hit).

    Returns whether anything changed.
    """
    if not wanted:
        raise errors.invalid("a hacking question needs at least one given solution")
    languages = [w["language"] for w in wanted]
    if len(set(languages)) != len(languages):
        raise errors.invalid("one given solution per language")

    current = {s.id: s for s in for_questions(conn, [question_id])[question_id]}
    keep: set[int] = set()
    changed = False
    for position, w in enumerate(wanted):
        existing = current.get(w.get("id") or 0)
        if existing is None:
            conn.execute(
                sa.insert(p1_hack_solution).values(
                    question_id=question_id,
                    language=w["language"],
                    source=w["source"],
                    order_index=position,
                )
            )
            changed = True
            continue
        keep.add(existing.id)
        same_code = existing.language == w["language"] and existing.source == w["source"]
        values: dict[str, Any] = {"order_index": position}
        if not same_code:
            values.update(language=w["language"], source=w["source"], proven=False)
            changed = True
        conn.execute(
            sa.update(p1_hack_solution).where(p1_hack_solution.c.id == existing.id).values(**values)
        )
    removed = set(current) - keep
    if removed:
        conn.execute(sa.delete(p1_hack_solution).where(p1_hack_solution.c.id.in_(removed)))
        changed = True
    return changed


def record_proof(
    conn: sa.Connection,
    question_id: int,
    solution_id: int,
    proven: bool,
    breaking_input: str | None,
) -> bool:
    """Store one copy's proof and recompute whether the question is ready:
    it is when every copy is proven. Returns the question's readiness."""
    values: dict[str, Any] = {"proven": proven}
    if proven:
        # The input that proved it is kept: it is how the copy is proven again
        # after an edit or import.
        values["breaking_input"] = breaking_input
    conn.execute(
        sa.update(p1_hack_solution).where(p1_hack_solution.c.id == solution_id).values(**values)
    )
    # Proven here, so whatever an imported zip claimed no longer applies.
    conn.execute(
        sa.update(p1_hack_question)
        .where(p1_hack_question.c.id == question_id)
        .values(verified_elsewhere=False)
    )
    return refresh_ready(conn, question_id)


def refresh_ready(conn: sa.Connection, question_id: int) -> bool:
    """The question is ready when every copy is proven."""
    copies = for_questions(conn, [question_id])[question_id]
    ready = bool(copies) and all(s.proven for s in copies)
    conn.execute(
        sa.update(p1_hack_question).where(p1_hack_question.c.id == question_id).values(ready=ready)
    )
    return ready
