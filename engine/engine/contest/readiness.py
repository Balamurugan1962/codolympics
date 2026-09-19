"""The pre-contest checklist on the admin overview. Computed fresh on every read.

Each item says whether it is satisfied, a one-line detail and where in the admin
UI to fix it. Judge packages are fetched before the transaction opens, so no
connection waits on the judge.
"""

from __future__ import annotations

from typing import Any

import sqlalchemy as sa

from engine.contest.rules import get_contest
from engine.core import db
from engine.judge import client as judge_client
from engine.judge.client import JudgeError
from engine.schema import p1_hack_question, p1_question, participant, question, user


def checklist() -> dict[str, Any]:
    try:
        packages = judge_client.problems()
    except JudgeError:
        packages = None
    with db.transaction() as conn:
        c = get_contest(conn)
        qs = conn.execute(sa.select(question.c.id, question.c.validated)).all()
        puzzles = _published_counts(conn, p1_question)
        hacks = _published_counts(conn, p1_hack_question)
        people = conn.execute(sa.select(sa.func.count()).select_from(participant)).scalar_one()
        evaluators = conn.execute(
            sa.select(sa.func.count()).select_from(user).where(user.c.role == "evaluator")
        ).scalar_one()
    package_items = _package_items(packages, qs)
    people_items = _people_items(c, puzzles, hacks, people, evaluators)
    items = package_items + people_items
    return {
        "items": items,
        "done": sum(1 for i in items if i["ok"]),
        "total": len(items),
    }


def _published_counts(conn: sa.Connection, table: sa.Table) -> tuple[int, int]:
    """(total, published)."""
    counts = sa.select(sa.func.count(), sa.func.count().filter(table.c.published))
    row = conn.execute(counts).one()
    return row[0], row[1]


def _package_items(packages: list[dict] | None, qs: list[sa.Row]) -> list[dict[str, Any]]:
    by_id = {p["problem_id"]: p for p in packages or []}
    contest_qs = [q for q in qs if not by_id.get(q.id, {}).get("hack_only")]
    unvalidated = []
    for q in contest_qs:
        if not q.validated and not by_id.get(q.id, {}).get("validated"):
            unvalidated.append(q.id)
    missing = [q.id for q in qs if q.id not in by_id]
    described = {q.id for q in qs}
    orphans = []
    for p in packages or []:
        if not p["hack_only"] and p["problem_id"] not in described:
            orphans.append(p["problem_id"])

    if packages is None:
        judge_detail = "the judge is not answering"
    else:
        judge_detail = f"{len(packages)} package(s) on disk"

    problems_detail = f"missing: {', '.join(missing)}" if missing else f"{len(qs)} question(s)"

    if orphans:
        details_detail = f"no title/statement yet: {', '.join(orphans)}"
    else:
        details_detail = "titles, statements and prices set"

    if unvalidated:
        validated_detail = f"not validated: {', '.join(unvalidated)}"
    elif contest_qs:
        validated_detail = "all passed"
    else:
        validated_detail = "no questions to validate yet"

    return [
        _item(
            "judge",
            "Judge reachable",
            packages is not None,
            judge_detail,
            "/admin",
        ),
        _item(
            "problems",
            "Every question has a judge package",
            not missing and bool(qs),
            problems_detail,
            "/admin/problems",
        ),
        _item(
            "details",
            "Every package has contest details",
            not orphans,
            details_detail,
            "/admin/problems",
        ),
        _item(
            "validated",
            "Every question validated",
            not unvalidated and bool(contest_qs),
            validated_detail,
            "/admin/problems",
        ),
    ]


def _people_items(
    c: sa.Row,
    puzzles: tuple[int, int],
    hacks: tuple[int, int],
    people: int,
    evaluators: int,
) -> list[dict[str, Any]]:
    if not c.registration_open:
        registration = "closed"
    elif c.phase == "registration":
        registration = "still open, close it before Phase 1"
    else:
        registration = "still open"
    if c.p1_selection_basis:
        basis_detail = "set"
    else:
        basis_detail = "participants must know how they will be selected before Phase 1"

    return [
        _item(
            "phase1",
            "Phase 1 questions published",
            puzzles[1] > 0 and hacks[1] > 0,
            f"{puzzles[1]}/{puzzles[0]} puzzles, {hacks[1]}/{hacks[0]} hacking",
            "/admin/phase1",
        ),
        _item(
            "basis",
            "Selection basis announced",
            bool(c.p1_selection_basis.strip()),
            basis_detail,
            "/admin/contest",
        ),
        _item(
            "evaluators",
            "At least one evaluator",
            evaluators > 0,
            f"{evaluators} evaluator(s)",
            "/admin/staff",
        ),
        _item(
            "participants",
            "Participants registered",
            people > 0,
            f"{people} registered",
            "/admin/participants",
        ),
        _item(
            "registration",
            "Registration closed before Phase 1",
            not c.registration_open or c.phase != "registration",
            registration,
            "/admin",
        ),
    ]


def _item(key: str, label: str, ok: bool, detail: str, href: str) -> dict[str, Any]:
    return {"key": key, "label": label, "ok": ok, "detail": detail, "href": href}
