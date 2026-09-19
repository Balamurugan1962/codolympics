"""Moving the contest through its phases, extending deadlines, and opening registration.

Only an administrator does any of it, with a reason.

Nothing auto-advances: a passed deadline closes the round, and the organisers
decide what happens next.

Concurrency: advancing takes the contest row FOR UPDATE and checks that the
phase is still the one its checks were run against. Two organisers pressing
Advance together therefore move the contest one phase, not two; the second gets
`phase_changed`. Everything that must happen atomically with the phase change
-- creating the round's lots, queueing Section A's validator scoring -- happens
in that same transaction.
"""

from __future__ import annotations

from datetime import timedelta

import sqlalchemy as sa

from engine.auction.lots import create_lots_for_round, open_next_lot
from engine.contest.phase_checks import advance_checks
from engine.contest.rules import (
    active_round,
    get_contest,
    lock_contest,
    phase_duration_minutes,
    phase_snapshot,
)
from engine.core import clock, db, errors, events
from engine.core.audit import audit
from engine.phase1.validator_jobs import queue_validator_scoring
from engine.schema import contest


def advance(actor_id: str, reason: str, acknowledge_warnings: bool = False) -> str:
    checks = advance_checks()
    nxt = checks["next"]
    if nxt is None:
        raise errors.conflict("ended", "the contest has ended")
    if checks["blockers"]:
        raise errors.conflict("blocked", "; ".join(checks["blockers"]))
    if checks["warnings"] and not acknowledge_warnings:
        raise errors.conflict("warnings", "; ".join(checks["warnings"]))
    with db.transaction() as conn:
        c = lock_contest(conn, exclusive=True)
        if c.phase != checks["from"]:
            raise errors.conflict(
                "phase_changed",
                f"the contest moved to {c.phase} while you were confirming",
            )
        _enter_phase(conn, c, nxt)
        audit(
            conn,
            actor_id=actor_id,
            action="phase.advance",
            target=nxt,
            reason=reason,
            detail={"from": c.phase, "warnings": checks["warnings"]},
        )
    _after_advance(nxt)
    return nxt


def _enter_phase(conn: sa.Connection, c: sa.Row, nxt: str) -> None:
    minutes = phase_duration_minutes(c, nxt)
    ends_at = clock.seconds_from_now(minutes * 60) if minutes else None
    conn.execute(sa.update(contest).values(phase=nxt, phase_ends_at=ends_at))
    if c.phase == "p1_puzzles":
        # No answer can change any more: this transaction holds the gate.
        queue_validator_scoring(conn)
    if round_ := active_round(nxt):
        create_lots_for_round(conn, round_)


def _after_advance(nxt: str) -> None:
    if round_ := active_round(nxt):
        open_next_lot(round_)
    publish_phase()
    events.publish("leaderboard")


def publish_phase() -> None:
    with db.transaction() as conn:
        snapshot = phase_snapshot(get_contest(conn))
    events.publish("phase", snapshot)


def extend(actor_id: str, minutes: int, reason: str) -> None:
    """Push the current round's deadline back. Every page sees it on its next poll."""
    with db.transaction() as conn:
        c = lock_contest(conn, exclusive=True)
        if c.phase_ends_at is None:
            raise errors.conflict("no_deadline", "the current phase has no deadline to extend")
        base = max(c.phase_ends_at, clock.now())
        new_deadline = base + timedelta(minutes=minutes)
        conn.execute(sa.update(contest).values(phase_ends_at=new_deadline))
        audit(
            conn,
            actor_id=actor_id,
            action="phase.extend",
            target=c.phase,
            reason=reason,
            detail={"minutes": minutes},
        )
    publish_phase()


def set_registration(actor_id: str, open_: bool, reason: str) -> None:
    with db.transaction() as conn:
        lock_contest(conn, exclusive=True)
        conn.execute(sa.update(contest).values(registration_open=open_))
        action = "registration.open" if open_ else "registration.close"
        audit(conn, actor_id=actor_id, action=action, reason=reason)
    publish_phase()
