"""The checks run before the contest advances to its next phase.

A blocker stops the advance outright; a warning must be acknowledged. Which
checks apply depends on the phase being left and the phase being entered. For
the first auction, every question is checked against what the judge serves.
"""

from __future__ import annotations

from typing import Any

import sqlalchemy as sa

from engine.contest.rules import get_contest, next_phase
from engine.core import db
from engine.judge import client as judge_client
from engine.judge.client import JudgeError
from engine.packages.volume import current_version
from engine.schema import p1_advancement, p1_hack_question, p1_question, participant, question


def advance_checks() -> dict[str, Any]:
    """What would stop or warn about advancing, shown before an organiser confirms."""
    with db.transaction() as conn:
        phase = get_contest(conn).phase
    nxt = next_phase(phase)
    if nxt is None:
        return {
            "next": None,
            "blockers": ["the contest has ended"],
            "warnings": [],
            "from": phase,
        }
    # Ask the judge before opening a transaction: no connection waits on it.
    packages = _judge_packages() if nxt == "auction1" else None
    with db.transaction() as conn:
        blockers, warnings = _checks_for(conn, get_contest(conn), nxt, packages)
    return {"next": nxt, "blockers": blockers, "warnings": warnings, "from": phase}


def _judge_packages() -> dict[str, dict] | None:
    """What the judge serves, by problem id, or None if it is unreachable."""
    try:
        return {p["problem_id"]: p for p in judge_client.problems()}
    except JudgeError:
        return None


def _checks_for(
    conn: sa.Connection, c: sa.Row, nxt: str, packages: dict[str, dict] | None
) -> tuple[list[str], list[str]]:
    blockers: list[str] = []
    warnings: list[str] = []
    if c.phase == "registration":
        if c.registration_open:
            blockers.append(
                "close registration first. The roster must be final because balances are equal"
            )
        if _count(conn, participant) == 0:
            blockers.append("nobody has registered")
    if nxt == "p1_puzzles":
        live_puzzles = _count(
            conn,
            p1_question,
            p1_question.c.published.is_(True),
            p1_question.c.voided.is_(False),
        )
        if live_puzzles == 0:
            blockers.append("no puzzle is published, Phase 1 would open with no puzzles")
        _hacking_checks(conn, blockers, warnings)
    if nxt == "auction1":
        _auction_checks(conn, packages or {}, blockers, warnings)
    if nxt == "final":
        left = _count(conn, question, question.c.status == "unsold")
        if left == 0:
            blockers.append("no question is left unsold, the common round would be empty")
        else:
            warnings.append(
                f"{left} unsold question{'s' if left != 1 else ''} will open to everyone at once."
                " Everything bought in round 1 closes"
            )
    return blockers, warnings


def _count(conn: sa.Connection, table: sa.Table, *where: Any) -> int:
    return conn.execute(sa.select(sa.func.count()).select_from(table).where(*where)).scalar_one()


def _hacking_checks(conn: sa.Connection, blockers: list[str], warnings: list[str]) -> None:
    hacks = conn.execute(
        sa.select(p1_hack_question).where(
            p1_hack_question.c.published.is_(True),
            p1_hack_question.c.voided.is_(False),
        )
    ).all()
    if not hacks:
        blockers.append("no hacking question is published, Phase 1 would open with no hacking")
    for h in hacks:
        # An attempt is judged against the live package; with none published,
        # every attempt fails silently.
        if not current_version(h.problem_id):
            blockers.append(
                f'"{h.title}" needs its judge package {h.problem_id} published — '
                "until it is, the judge cannot serve it and every attempt fails"
            )
        if not h.ready:
            warnings.append(f'"{h.title}" has no proven breaking input')


def _auction_checks(
    conn: sa.Connection, packages: dict[str, dict], blockers: list[str], warnings: list[str]
) -> None:
    if _count(conn, p1_advancement, p1_advancement.c.advanced.is_(True)) == 0:
        blockers.append("no participant has been selected to advance")
    qs = conn.execute(sa.select(question.c.id, question.c.validated)).all()
    if not qs:
        blockers.append("there are no questions to auction")
    # Confirm every question exists on the judge before anyone can pay for it.
    for q in qs:
        info = packages.get(q.id)
        if info is None:
            blockers.append(f"{q.id} is missing from the judge")
            continue
        if info["testcases"] == 0:
            warnings.append(f"{q.id} has no testcases")
        if not info["validated"] and not q.validated:
            warnings.append(f"{q.id} has not been validated")
