"""The schema, as SQLAlchemy Core tables, grouped by the part of the contest they belong to.

Queries are written against these directly -- no ORM, no sessions, no lazy
loading. What a function reads and writes is visible in the function.

Identity (user, session, account, verification) belongs to Better Auth, which
the web app uses to sign people in. The engine reads those tables to know who
is calling, and writes them only to create accounts and set passwords.

All money is a plain integer. Every timestamp is UTC.
"""

from engine.schema.auction import bid, hint, hint_purchase, ledger, lot, ownership, question
from engine.schema.base import (
    AUCTION_MODES,
    DIFFICULTIES,
    LEADERBOARD_MODES,
    P1_CATEGORIES,
    P1_GRADING,
    P1_KINDS,
    PHASES,
    metadata,
)
from engine.schema.coding import draft, judgement, practice_run, submission
from engine.schema.contest import announcement, audit_log, contest, event, notification, participant
from engine.schema.identity import account, session, user, verification
from engine.schema.marketplace import (
    attack_break,
    blackout,
    powerup,
    powerup_event,
    powerup_inventory,
    shield,
)
from engine.schema.phase1 import (
    p1_advancement,
    p1_answer,
    p1_hack_attempt,
    p1_hack_question,
    p1_hack_solution,
    p1_question,
)

__all__ = [
    "AUCTION_MODES",
    "DIFFICULTIES",
    "LEADERBOARD_MODES",
    "P1_CATEGORIES",
    "P1_GRADING",
    "P1_KINDS",
    "PHASES",
    "account",
    "announcement",
    "audit_log",
    "bid",
    "attack_break",
    "blackout",
    "shield",
    "contest",
    "draft",
    "event",
    "hint",
    "hint_purchase",
    "judgement",
    "ledger",
    "lot",
    "metadata",
    "notification",
    "ownership",
    "p1_advancement",
    "p1_answer",
    "p1_hack_attempt",
    "p1_hack_question",
    "p1_hack_solution",
    "p1_question",
    "participant",
    "powerup",
    "powerup_event",
    "powerup_inventory",
    "practice_run",
    "question",
    "session",
    "submission",
    "user",
    "verification",
]
