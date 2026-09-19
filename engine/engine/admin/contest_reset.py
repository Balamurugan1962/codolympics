"""Settings -> Danger zone: putting the contest back to the start.

A reset truncates only the run tables -- everything a run of the contest
produced -- and deletes the participant logins, so the same questions can be run
again. "Wipe everything" also truncates the authored content, removes every
package from the volume and restores the default settings.
"""

from __future__ import annotations

import sqlalchemy as sa

from engine.contest.phases import publish_phase
from engine.contest.rules import lock_contest
from engine.core import db, errors, events
from engine.core.audit import audit
from engine.packages.volume import delete_all_packages
from engine.schema import (
    announcement,
    bid,
    contest,
    draft,
    hint,
    hint_purchase,
    judgement,
    ledger,
    lot,
    notification,
    ownership,
    p1_advancement,
    p1_answer,
    p1_hack_attempt,
    p1_hack_question,
    p1_question,
    participant,
    question,
    submission,
    user,
)

# Everything a run of the contest produces. Truncating participant cascades to the powerup tables.
RUN_TABLES = (
    bid,
    lot,
    ownership,
    hint_purchase,
    ledger,
    judgement,
    submission,
    draft,
    notification,
    announcement,
    p1_answer,
    p1_hack_attempt,
    p1_advancement,
    participant,
)

# What the organisers authored. Only "wipe everything" touches these.
CONTENT_TABLES = (hint, question, p1_question, p1_hack_question)

SETTINGS_DEFAULTS = {
    "starting_balance": 1000,
    "bid_increment": 10,
    "countdown_seconds": 15,
    "opening_window_seconds": 30,
    "ownership_cap": None,
    "coding1_minutes": 90,
    "final_minutes": 60,
    "p1_puzzles_minutes": 45,
    "p1_hacking_minutes": 45,
    "p1_selection_basis": "",
    "p1_leaderboard_mode": "hidden",
    "leaderboard_mode": "live",
}


def _truncate(conn: sa.Connection, tables: tuple[sa.Table, ...]) -> None:
    names = ", ".join(f'"{t.name}"' for t in tables)
    conn.execute(sa.text(f"truncate table {names} restart identity cascade"))


def reset(actor_id: str, scope: str, reason: str, confirm: str) -> dict[str, int]:
    """Put the contest back to registration.

    Scope "run" removes every participant and everything they did; "everything"
    also removes the content, the packages and the settings.
    """
    everything = scope == "everything"
    phrase = "wipe everything" if everything else "reset the contest"
    if confirm.strip().lower() != phrase:
        raise errors.invalid(f'type "{phrase}" to confirm')
    with db.transaction() as conn:
        lock_contest(conn, exclusive=True)
        participants = conn.execute(
            sa.select(sa.func.count()).select_from(participant)
        ).scalar_one()
        _truncate(conn, RUN_TABLES)
        # Sessions and accounts cascade from the user row.
        conn.execute(sa.delete(user).where(user.c.role == "participant"))
        if everything:
            _truncate(conn, CONTENT_TABLES)
        else:
            conn.execute(
                sa.update(question).where(question.c.status == "sold").values(status="unsold")
            )
        fresh = {
            "phase": "registration",
            "phase_ends_at": None,
            "registration_open": True,
            "leaderboard_frozen_at": None,
            "auction_paused_at": None,
        }
        settings = SETTINGS_DEFAULTS if everything else {}
        conn.execute(sa.update(contest).values(**fresh, **settings))
        detail = {"participants": participants, "scope": scope}
        audit(
            conn,
            actor_id=actor_id,
            action="contest.wipe" if everything else "contest.reset",
            reason=reason,
            detail=detail,
        )
    packages = delete_all_packages() if everything else 0
    publish_phase()
    events.publish("leaderboard")
    return {"participants": participants, "packages": packages}
