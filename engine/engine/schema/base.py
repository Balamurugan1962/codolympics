"""Shared pieces of the schema: the metadata, enumerations, and column helpers."""

from __future__ import annotations

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    MetaData,
    Text,
    text,
)

metadata = MetaData()

PHASES = (
    "registration",
    "p1_puzzles",
    "p1_hacking",
    "review",
    "auction1",
    "coding1",
    "auction2",
    "final",
    "ended",
)
LEADERBOARD_MODES = ("live", "frozen", "hidden")
AUCTION_MODES = ("online", "offline")
DIFFICULTIES = ("easy", "medium", "hard")
P1_CATEGORIES = ("pattern", "detective", "constraint")
P1_KINDS = ("mcq_single", "mcq_multi", "fill_blank", "numeric", "sequence", "set", "long_text")
P1_GRADING = ("auto", "validator", "manual")


def timestamp(name: str, **kw) -> Column:
    return Column(name, DateTime(timezone=True), **kw)


def created_at(name: str = "created_at") -> Column:
    return Column(name, DateTime(timezone=True), nullable=False, server_default=text("now()"))


def participant_ref(name: str, *, cascade: bool = False, nullable: bool = False) -> Column:
    ondelete = "CASCADE" if cascade else None
    fk = ForeignKey("participant.user_id", ondelete=ondelete)
    return Column(name, Text, fk, nullable=nullable)
