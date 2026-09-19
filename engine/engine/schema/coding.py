"""Coding tables: submissions, their judgements, and editor drafts.

Judging a submission, and every rejudge of it, adds a judgement row; a partial
unique index keeps exactly one of them current.
"""

from __future__ import annotations

from sqlalchemy import (
    REAL,
    BigInteger,
    Boolean,
    Column,
    ForeignKey,
    Index,
    Integer,
    PrimaryKeyConstraint,
    Table,
    Text,
    text,
)

from engine.schema.base import created_at, metadata, participant_ref, timestamp

submission = Table(
    "submission",
    metadata,
    Column("id", BigInteger, primary_key=True, autoincrement=True),
    participant_ref("participant_id"),
    Column("question_id", Text, ForeignKey("question.id"), nullable=False),
    Column("language", Text, nullable=False),
    Column("source", Text, nullable=False),
    created_at(),  # server clock; the tiebreak is measured from here
    Index("submission_participant_question_idx", "participant_id", "question_id"),
)

# Many per submission: a rejudge supersedes the current row and adds another.
judgement = Table(
    "judgement",
    metadata,
    Column("id", BigInteger, primary_key=True, autoincrement=True),
    Column("submission_id", BigInteger, ForeignKey("submission.id"), nullable=False),
    # pending | queued | running | done
    Column("state", Text, nullable=False, server_default=text("'pending'")),
    Column("job_id", Text),
    Column("verdict", Text),
    Column("passed", Integer),
    Column("total", Integer),
    Column("first_fail", Integer),
    Column("max_time_ms", REAL),
    Column("max_memory_kb", Integer),
    Column("compile_output", Text),
    Column("message", Text),
    Column("jury_detail", Text),  # never sent to a participant
    Column("problem_version", Text),
    Column("progress_done", Integer, nullable=False, server_default=text("0")),
    Column("progress_total", Integer, nullable=False, server_default=text("0")),
    Column("attempt", Integer, nullable=False, server_default=text("1")),
    Column("retries", Integer, nullable=False, server_default=text("0")),
    Column("cancelled", Boolean, nullable=False, server_default=text("false")),
    timestamp("superseded_at"),
    created_at(),
    timestamp("ended_at"),
    Index("judgement_submission_idx", "submission_id"),
    Index("judgement_state_idx", "state"),
    # Exactly one current judgement per submission, even under concurrent rejudges.
    Index(
        "judgement_one_current",
        "submission_id",
        unique=True,
        postgresql_where=text("superseded_at IS NULL"),
    ),
)

draft = Table(
    "draft",
    metadata,
    participant_ref("participant_id"),
    Column("question_id", Text, nullable=False),
    Column("source", Text, nullable=False),
    Column("language", Text, nullable=False),
    created_at("updated_at"),
    PrimaryKeyConstraint(
        "participant_id", "question_id", name="draft_participant_id_question_id_pk"
    ),
)
