"""Auction tables: questions and their hints, lots and bids, ownership, and the ledger.

Ownership's primary key is the exclusivity rule, and a partial unique index keeps
at most one lot open. The ledger records every balance change, not only auction
spending.
"""

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

from engine.schema.base import created_at, metadata, participant_ref, timestamp

question = Table(
    "question",
    metadata,
    Column("id", Text, primary_key=True),  # the judge's problem_id
    Column("title", Text, nullable=False),
    Column("difficulty", Text, nullable=False),
    Column("score", Integer, nullable=False),
    Column("base_price", Integer, nullable=False),
    Column("statement_md", Text, nullable=False, server_default=text("''")),
    Column("sample_count", Integer, nullable=False, server_default=text("0")),
    Column("auction_order", Integer, nullable=False, server_default=text("0")),
    # unsold | sold | void
    Column("status", Text, nullable=False, server_default=text("'unsold'")),
    Column("problem_version", Text),
    Column("validated", Boolean, nullable=False, server_default=text("false")),
)

hint = Table(
    "hint",
    metadata,
    Column("question_id", Text, ForeignKey("question.id", ondelete="CASCADE"), nullable=False),
    Column("idx", Integer, nullable=False),
    Column("price", Integer, nullable=False),
    Column("body_md", Text, nullable=False),
    PrimaryKeyConstraint("question_id", "idx", name="hint_question_id_idx_pk"),
)

# One question offered once in one round. The clock lives in the deadline
# columns, read by the scheduler -- never in an in-memory timer.
lot = Table(
    "lot",
    metadata,
    Column("id", BigInteger, primary_key=True, autoincrement=True),
    Column("question_id", Text, ForeignKey("question.id"), nullable=False),
    Column("round", Integer, nullable=False),
    # pending | open | closed | unsold | withdrawn
    Column("state", Text, nullable=False, server_default=text("'pending'")),
    Column("order", Integer, nullable=False),
    timestamp("opened_at"),
    timestamp("no_bid_deadline"),
    timestamp("bidding_ends_at"),
    Column("current_bid", Integer),
    participant_ref("current_bidder_id", nullable=True),
    timestamp("closed_at"),
    UniqueConstraint("question_id", "round", name="lot_question_round"),
    # At most one lot is on the block at a time, enforced by the database.
    Index(
        "lot_single_open",
        text("(true)"),
        unique=True,
        postgresql_where=text("state = 'open'"),
    ),
)

bid = Table(
    "bid",
    metadata,
    Column("id", BigInteger, primary_key=True, autoincrement=True),
    Column("lot_id", BigInteger, ForeignKey("lot.id"), nullable=False),
    participant_ref("participant_id"),
    Column("amount", Integer, nullable=False),
    created_at(),
    Index("bid_lot_idx", "lot_id"),
)

# One row per sold question: the primary key IS the exclusivity rule.
ownership = Table(
    "ownership",
    metadata,
    Column("question_id", Text, ForeignKey("question.id"), primary_key=True),
    participant_ref("participant_id"),
    Column("price_paid", Integer, nullable=False),
    created_at("awarded_at"),
    timestamp("voided_at"),
)

hint_purchase = Table(
    "hint_purchase",
    metadata,
    Column("question_id", Text, nullable=False),
    Column("hint_idx", Integer, nullable=False),
    participant_ref("participant_id"),
    Column("price_paid", Integer, nullable=False),
    created_at("purchased_at"),
    PrimaryKeyConstraint(
        "question_id",
        "hint_idx",
        "participant_id",
        name="hint_purchase_question_id_hint_idx_participant_id_pk",
    ),
)

# Every balance change, with the balance it left behind.
ledger = Table(
    "ledger",
    metadata,
    Column("id", BigInteger, primary_key=True, autoincrement=True),
    participant_ref("participant_id"),
    Column("delta", Integer, nullable=False),
    Column("balance_after", Integer, nullable=False),
    # bid_won | hint | powerup | refund | admin_adjust | starting_balance
    Column("reason", Text, nullable=False),
    Column("ref", Text),
    created_at(),
    Index("ledger_participant_idx", "participant_id"),
)
