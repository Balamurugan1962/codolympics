"""Reading the contest row, and the settings on it an administrator may change."""

from __future__ import annotations

from typing import Any

import sqlalchemy as sa

from engine.contest.phases import publish_phase
from engine.contest.rules import is_auction, lock_contest
from engine.core import clock, db, errors, events
from engine.core.audit import audit
from engine.core.serialize import camel_row
from engine.schema import contest

SETTINGS = (
    "auction_mode",
    "marketplace_open",
    "reveal_attacker",
    "reveal_shields",
    "attack_cap",
    "attack_break_seconds",
    "count_absorbed_attacks",
    "after_cap",
    "starting_balance",
    "bid_increment",
    "countdown_seconds",
    "opening_window_seconds",
    "ownership_cap",
    "coding1_minutes",
    "final_minutes",
    "p1_puzzles_minutes",
    "p1_hacking_minutes",
    "p1_selection_basis",
    "p1_leaderboard_mode",
    "leaderboard_mode",
)


def contest_row() -> dict[str, Any]:
    with db.transaction() as conn:
        return camel_row(conn.execute(sa.select(contest)).mappings().one())


def update_contest(actor_id: str, patch: dict[str, Any], reason: str) -> dict[str, Any]:
    """Apply the known settings in `patch`; anything else in it is ignored."""
    changes = {k: v for k, v in patch.items() if k in SETTINGS}
    with db.transaction() as conn:
        c = lock_contest(conn, exclusive=True)
        # Online and offline settle lots differently; a round must be all one or the other.
        changing_mode = "auction_mode" in changes and changes["auction_mode"] != c.auction_mode
        if changing_mode and is_auction(c.phase):
            raise errors.conflict(
                "auction_running",
                "finish or leave the auction round before changing how it is run",
            )
        if "leaderboard_mode" in changes and changes["leaderboard_mode"] != c.leaderboard_mode:
            frozen = changes["leaderboard_mode"] == "frozen"
            changes["leaderboard_frozen_at"] = clock.now() if frozen else None
        if changes:
            conn.execute(sa.update(contest).values(**changes))
        # Recomputed from the patch: `changes` may now carry leaderboard_frozen_at too.
        audited = {k: v for k, v in patch.items() if k in SETTINGS}
        audit(
            conn,
            actor_id=actor_id,
            action="contest.update",
            reason=reason,
            detail=audited,
        )
    publish_phase()
    if "leaderboard_mode" in patch:
        events.publish("leaderboard")
    return contest_row()
