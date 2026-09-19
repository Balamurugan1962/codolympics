"""Marketplace tables: powerups, inventories, purchase and use events, and blackouts."""

from __future__ import annotations

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    ForeignKey,
    Index,
    Integer,
    PrimaryKeyConstraint,
    Table,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB

from engine.schema.base import created_at, metadata, participant_ref, timestamp

powerup = Table(
    "powerup",
    metadata,
    Column("id", BigInteger, primary_key=True, autoincrement=True),
    Column("kind", Text, nullable=False),
    Column("name", Text, nullable=False),
    Column("description", Text, nullable=False, server_default=text("''")),
    Column("price", Integer, nullable=False),
    Column("duration_seconds", Integer),
    Column("enabled", Boolean, nullable=False, server_default=text("true")),
    Column("max_held", Integer),
    Column("max_purchases", Integer),
    Column("usable_phases", JSONB, nullable=False, server_default=text("'[]'::jsonb")),
    Column("sort_order", Integer, nullable=False, server_default=text("0")),
)

powerup_inventory = Table(
    "powerup_inventory",
    metadata,
    participant_ref("participant_id", cascade=True),
    Column(
        "powerup_id",
        BigInteger,
        ForeignKey("powerup.id", ondelete="CASCADE"),
        nullable=False,
    ),
    Column("quantity", Integer, nullable=False, server_default=text("0")),
    Column("purchased", Integer, nullable=False, server_default=text("0")),
    PrimaryKeyConstraint(
        "participant_id", "powerup_id", name="powerup_inventory_participant_id_powerup_id_pk"
    ),
)

# Every purchase and use. The unique (actor, request_id) makes a replayed
# request collapse onto the first one instead of charging twice.
powerup_event = Table(
    "powerup_event",
    metadata,
    Column("id", BigInteger, primary_key=True, autoincrement=True),
    Column("kind", Text, nullable=False),  # purchase | use | blocked | expired
    Column("powerup_id", BigInteger, ForeignKey("powerup.id")),
    participant_ref("actor_id", cascade=True),
    participant_ref("target_id", cascade=True, nullable=True),
    Column("quantity", Integer, nullable=False, server_default=text("1")),
    Column("cost", Integer, nullable=False, server_default=text("0")),
    Column("request_id", Text),
    Column("detail", JSONB),
    created_at(),
    UniqueConstraint("actor_id", "request_id", name="powerup_event_idempotent"),
    Index("powerup_event_actor_idx", "actor_id"),
    Index("powerup_event_target_idx", "target_id"),
)

# A blackout that landed. Stacked blackouts sit end to end, never overlapping.
blackout = Table(
    "blackout",
    metadata,
    Column("id", BigInteger, primary_key=True, autoincrement=True),
    participant_ref("participant_id", cascade=True),
    participant_ref("by_id", cascade=True),
    Column("seconds", Integer, nullable=False),
    timestamp("starts_at", nullable=False),
    timestamp("ends_at", nullable=False),
    created_at(),
    Index("blackout_participant_idx", "participant_id", "ends_at"),
)
