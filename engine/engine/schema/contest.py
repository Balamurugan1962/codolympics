"""Contest-wide tables: the contest row, participants, messages, audit log and events."""

from __future__ import annotations

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Column,
    ForeignKey,
    Index,
    Integer,
    Table,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB

from engine.schema.base import created_at, metadata, participant_ref, timestamp

# Exactly one row, id = 1. Every tunable an administrator can change.
contest = Table(
    "contest",
    metadata,
    Column("id", Integer, primary_key=True, server_default=text("1")),
    Column("phase", Text, nullable=False, server_default=text("'registration'")),
    timestamp("phase_ends_at"),
    Column("registration_open", Boolean, nullable=False, server_default=text("true")),
    Column("starting_balance", Integer, nullable=False, server_default=text("1000")),
    Column("bid_increment", Integer, nullable=False, server_default=text("10")),
    Column("countdown_seconds", Integer, nullable=False, server_default=text("15")),
    Column("opening_window_seconds", Integer, nullable=False, server_default=text("30")),
    Column("ownership_cap", Integer),
    Column("coding1_minutes", Integer, nullable=False, server_default=text("90")),
    Column("final_minutes", Integer, nullable=False, server_default=text("60")),
    Column("p1_puzzles_minutes", Integer, nullable=False, server_default=text("45")),
    Column("p1_hacking_minutes", Integer, nullable=False, server_default=text("45")),
    Column("p1_selection_basis", Text, nullable=False, server_default=text("''")),
    Column("p1_leaderboard_mode", Text, nullable=False, server_default=text("'hidden'")),
    Column("leaderboard_mode", Text, nullable=False, server_default=text("'live'")),
    timestamp("leaderboard_frozen_at"),
    timestamp("auction_paused_at"),
    Column("auction_mode", Text, nullable=False, server_default=text("'online'")),
    Column("marketplace_open", Boolean, nullable=False, server_default=text("false")),
    # Whether a blackout's target is told who sent it, and whether an attacker
    # can see that a target has a shield up before spending an attack.
    Column("reveal_attacker", Boolean, nullable=False, server_default=text("true")),
    Column("reveal_shields", Boolean, nullable=False, server_default=text("true")),
    # After this many attacks on one person, nobody can attack them for a
    # while (0: no cap). The break doubles each time it happens to the same
    # person. Whether an attack a shield absorbed counts is a switch.
    Column("attack_cap", Integer, nullable=False, server_default=text("0")),
    Column("attack_break_seconds", Integer, nullable=False, server_default=text("300")),
    Column("count_absorbed_attacks", Boolean, nullable=False, server_default=text("true")),
    # After a blackout ends, its target cannot be attacked for this long (0: no cooldown).
    # When the common round began: every solve in it is timed from here.
    timestamp("final_started_at"),
    Column("attack_cooldown_seconds", Integer, nullable=False, server_default=text("60")),
    # 'break': a timed break that doubles. 'forever': off limits for the rest of the contest.
    Column("after_cap", Text, nullable=False, server_default=text("'break'")),
    # While a round runs, a participant's browser stays in full screen and
    # focused. After `proctor_warnings` alerts the next one locks the account.
    Column("proctoring", Boolean, nullable=False, server_default=text("true")),
    Column("proctor_warnings", Integer, nullable=False, server_default=text("3")),
    CheckConstraint("id = 1", name="contest_single_row"),
)

# One row per competing account. Evaluators and administrators have none.
participant = Table(
    "participant",
    metadata,
    Column("user_id", Text, ForeignKey("user.id", ondelete="CASCADE"), primary_key=True),
    Column("balance", Integer, nullable=False, server_default=text("0")),
    Column("preferred_language", Text),
    # Contact details for the organisers only: never in a participant-facing view.
    Column("mobile", Text),
    Column("contact_email", Text),
    created_at("registered_at"),
    timestamp("last_judgement_ended_at"),
    timestamp("p1_puzzles_finished_at"),
    timestamp("p1_hacking_finished_at"),
    timestamp("disqualified_at"),
    Column("disqualified_reason", Text),
    # Times they left the page since the last unlock, and whether that locked them.
    Column("proctor_alerts", Integer, nullable=False, server_default=text("0")),
    timestamp("proctor_locked_at"),
    CheckConstraint("balance >= 0", name="balance_nonnegative"),
)

# One row each time a participant left the page: which way, and when.
proctor_event = Table(
    "proctor_event",
    metadata,
    Column("id", BigInteger, primary_key=True, autoincrement=True),
    participant_ref("participant_id", cascade=True),
    Column("kind", Text, nullable=False),
    created_at(),
    Index("proctor_event_participant_idx", "participant_id", "id"),
)

announcement = Table(
    "announcement",
    metadata,
    Column("id", BigInteger, primary_key=True, autoincrement=True),
    Column("body_md", Text, nullable=False),
    created_at(),
)

notification = Table(
    "notification",
    metadata,
    Column("id", BigInteger, primary_key=True, autoincrement=True),
    participant_ref("participant_id"),
    Column("body_md", Text, nullable=False),
    created_at(),
    timestamp("read_at"),
    Index("notification_participant_idx", "participant_id"),
)

audit_log = Table(
    "audit_log",
    metadata,
    Column("id", BigInteger, primary_key=True, autoincrement=True),
    Column("actor_id", Text),
    Column("action", Text, nullable=False),
    Column("target", Text),
    Column("reason", Text, nullable=False),
    Column("detail", JSONB),
    created_at(),
)

# What changed, for the web app's once-a-second poll. See engine/core/events.py.
event = Table(
    "event",
    metadata,
    Column("id", BigInteger, primary_key=True, autoincrement=True),
    Column("name", Text, nullable=False),
    Column("participant_id", Text),  # null = everyone
    Column("data", JSONB, nullable=False),
    created_at(),
)
