"""Better Auth's identity tables: user, session, account and verification.

Their shape is Better Auth's, not the engine's, which is why their timestamps
are `timestamp without time zone` (holding UTC) unlike every other table.
"""

from __future__ import annotations

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Table,
    Text,
    text,
)

from engine.schema.base import metadata

user = Table(
    "user",
    metadata,
    Column("id", Text, primary_key=True),
    Column("name", Text, nullable=False),
    Column("email", Text, nullable=False, unique=True),
    Column("email_verified", Boolean, nullable=False, server_default=text("false")),
    Column("image", Text),
    Column("created_at", DateTime, nullable=False, server_default=text("now()")),
    Column("updated_at", DateTime, nullable=False, server_default=text("now()")),
    Column("username", Text, unique=True),
    Column("display_username", Text),
    Column("role", Text),
    Column("banned", Boolean, server_default=text("false")),
    Column("ban_reason", Text),
    Column("ban_expires", DateTime),
    Column("preferred_language", Text),
)

session = Table(
    "session",
    metadata,
    Column("id", Text, primary_key=True),
    Column("expires_at", DateTime, nullable=False),
    Column("token", Text, nullable=False, unique=True),
    Column("created_at", DateTime, nullable=False, server_default=text("now()")),
    Column("updated_at", DateTime, nullable=False),
    Column("ip_address", Text),
    Column("user_agent", Text),
    Column("user_id", Text, ForeignKey("user.id", ondelete="CASCADE"), nullable=False),
    Column("impersonated_by", Text),
    Index("session_userId_idx", "user_id"),
)

account = Table(
    "account",
    metadata,
    Column("id", Text, primary_key=True),
    Column("account_id", Text, nullable=False),
    Column("provider_id", Text, nullable=False),
    Column("user_id", Text, ForeignKey("user.id", ondelete="CASCADE"), nullable=False),
    Column("access_token", Text),
    Column("refresh_token", Text),
    Column("id_token", Text),
    Column("access_token_expires_at", DateTime),
    Column("refresh_token_expires_at", DateTime),
    Column("scope", Text),
    Column("password", Text),
    Column("created_at", DateTime, nullable=False, server_default=text("now()")),
    Column("updated_at", DateTime, nullable=False),
    Index("account_userId_idx", "user_id"),
)

verification = Table(
    "verification",
    metadata,
    Column("id", Text, primary_key=True),
    Column("identifier", Text, nullable=False),
    Column("value", Text, nullable=False),
    Column("expires_at", DateTime, nullable=False),
    Column("created_at", DateTime, nullable=False, server_default=text("now()")),
    Column("updated_at", DateTime, nullable=False, server_default=text("now()")),
    Index("verification_identifier_idx", "identifier"),
)
