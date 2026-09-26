"""GET /api/state: everything a page needs on load, and again whenever it must resync.

Staff get the viewer, the phase, recent announcements and the auction snapshot;
participants also get their own balance, questions, rank, submit status,
blackout and unread notifications.

It carries `event_cursor`: the newest event id at the moment the state was read.
A page starts polling from there, so nothing that happens after the read can be
missed, and anything just before it is already reflected in the state.
"""

from __future__ import annotations

import threading
import time
from typing import Any

import sqlalchemy as sa

from engine.accounts.viewer import Viewer
from engine.auction.board import snapshot as auction_snapshot
from engine.coding.questions import working_questions
from engine.coding.scoring import frozen_at, phase2_standings
from engine.coding.submission_views import submit_status
from engine.contest import proctor
from engine.contest.messages import recent_announcements, unread
from engine.contest.rules import auction_round, get_contest, is_auction, is_phase2, phase_snapshot
from engine.core import db, events
from engine.marketplace.blackouts import blackout_state
from engine.marketplace.breaks import break_state
from engine.marketplace.cooldowns import cooldown_state
from engine.marketplace.shields import shield_state
from engine.phase1.selection import has_advanced
from engine.schema import participant


def state_for(viewer: Viewer) -> dict[str, Any]:
    with db.transaction() as conn:
        # Cursor first: an event committed after this line will be delivered by the next poll.
        cursor = events.cursor(conn)
        c = get_contest(conn)
        contest_phase = phase_snapshot(c)
        announcements = recent_announcements(conn, 20)
        # Organisers watch the same room, so they get the same participant-safe
        # auction snapshot.
        auction = auction_snapshot(conn, auction_round(c.phase)) if is_auction(c.phase) else None
        base = {
            "viewer": viewer.as_dict(),
            "contest": contest_phase,
            "announcements": announcements,
            "auction": auction,
            "event_cursor": cursor,
        }
        if viewer.role != "participant":
            return base
        return base | _participant_state(conn, c, viewer.id, cursor)


def _participant_state(
    conn: sa.Connection, c: sa.Row, participant_id: str, cursor: int
) -> dict[str, Any]:
    p = conn.execute(
        sa.select(participant).where(participant.c.user_id == participant_id)
    ).one_or_none()
    return {
        "me": _me(conn, c, p) if p else None,
        "questions": working_questions(conn, participant_id),
        "rank": _my_rank(conn, c, participant_id, cursor),
        "submit": submit_status(conn, participant_id),
        "blackout": blackout_state(conn, participant_id),
        "shield": shield_state(conn, participant_id),
        "attack_break": break_state(conn, participant_id),
        "attack_cooldown": cooldown_state(conn, participant_id),
        "notifications": unread(conn, participant_id),
    }


def _me(conn: sa.Connection, c: sa.Row, p: sa.Row) -> dict[str, Any]:
    return {
        "balance": p.balance,
        "disqualified": p.disqualified_at is not None,
        "advanced": has_advanced(conn, p.user_id),
        "p1_puzzles_finished": p.p1_puzzles_finished_at is not None,
        "p1_hacking_finished": p.p1_hacking_finished_at is not None,
        # The language the editor opens in. A preference, never a restriction.
        "preferred_language": p.preferred_language,
        "proctor": proctor.state_of(c, p),
    }


def _my_rank(
    conn: sa.Connection, c: sa.Row, participant_id: str, cursor: int
) -> dict[str, Any] | None:
    if not is_phase2(c.phase) or c.leaderboard_mode == "hidden":
        return None
    standings = _shared_standings(conn, c, cursor)
    return next((s for s in standings if s["participant_id"] == participant_id), None)


# Everyone reads the same standings, and each read costs a pass over every
# solve, so when the whole room refreshes at once (an announcement, a phase
# change) it is worked out once for that second, not once per person. The key is
# the event cursor as well as the time: anything that publishes an event (a
# verdict, a correction, a phase change) moves the cursor and so ends the
# reuse at once, and the freeze point is part of the key. The one-second limit
# is only the backstop for a change that publishes nothing. Only the shared
# standings are held; each person's own balance, blackout and questions are
# always read fresh.
_STANDINGS_TTL_S = 1.0
_standings_held: tuple[float, tuple[int, object], list[dict[str, Any]]] | None = None
_standings_lock = threading.Lock()


def _shared_standings(conn: sa.Connection, c: sa.Row, cursor: int) -> list[dict[str, Any]]:
    global _standings_held
    key = (cursor, frozen_at(c))
    with _standings_lock:
        held = _standings_held
    if held is not None and held[1] == key and time.monotonic() - held[0] < _STANDINGS_TTL_S:
        return held[2]
    rows = phase2_standings(conn, frozen_at(c))
    with _standings_lock:
        _standings_held = (time.monotonic(), key, rows)
    return rows
