"""Phase 1 tables: puzzles, answers, hacking questions and attempts, and advancement.

Section A is the puzzles, Section B the hacking questions and their flawed
solutions, one per language; `p1_advancement`
records who was selected to go on to the auction. Answer keys and breaking
inputs live here too, and are never sent to a participant.
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
    text,
)
from sqlalchemy.dialects.postgresql import JSONB

from engine.schema.base import created_at, metadata, participant_ref, timestamp

p1_question = Table(
    "p1_question",
    metadata,
    Column("id", BigInteger, primary_key=True, autoincrement=True),
    Column("title", Text, nullable=False),
    Column("body_md", Text, nullable=False),
    Column("category", Text, nullable=False),
    Column("kind", Text, nullable=False),
    Column("grading", Text, nullable=False),
    Column("points", Integer, nullable=False),
    Column("explain_points", Integer, nullable=False, server_default=text("0")),
    Column("order_index", Integer, nullable=False, server_default=text("0")),
    Column("published", Boolean, nullable=False, server_default=text("false")),
    Column("voided", Boolean, nullable=False, server_default=text("false")),
    Column("config", JSONB, nullable=False, server_default=text("'{}'::jsonb")),
    Column("answer_key", JSONB),  # never sent to a participant
    Column("model_answer", Text),
    Column("validator_py", Text),
    Column("points_per_entry", Integer),
    Column("max_entries", Integer, nullable=False, server_default=text("100")),
    Column("format_regex", Text),
    Column("format_hint", Text),
    Column("ready", Boolean, nullable=False, server_default=text("false")),
    Column("verified_elsewhere", Boolean, nullable=False, server_default=text("false")),
)

p1_answer = Table(
    "p1_answer",
    metadata,
    participant_ref("participant_id"),
    Column("question_id", BigInteger, ForeignKey("p1_question.id"), nullable=False),
    Column("answer", JSONB),
    Column("explanation", Text),
    Column("auto_score", Integer),
    Column("manual_score", Integer),
    Column("explain_score", Integer),
    Column("graded_by", Text),
    timestamp("graded_at"),
    Column("grade_comment", Text),
    Column("flagged", Boolean, nullable=False, server_default=text("false")),
    Column("score_job_id", Text),
    Column("score_state", Text),  # pending | queued | done | error
    Column("score_error", Text),
    created_at("updated_at"),
    PrimaryKeyConstraint(
        "participant_id", "question_id", name="p1_answer_participant_id_question_id_pk"
    ),
)

p1_hack_question = Table(
    "p1_hack_question",
    metadata,
    Column("id", BigInteger, primary_key=True, autoincrement=True),
    Column("title", Text, nullable=False),
    Column("statement_md", Text, nullable=False),
    Column("constraints_md", Text, nullable=False, server_default=text("''")),
    Column("problem_id", Text, nullable=False),
    Column("hack_points", Integer, nullable=False),
    Column("fail_penalty", Integer, nullable=False, server_default=text("0")),
    Column("order_index", Integer, nullable=False, server_default=text("0")),
    Column("published", Boolean, nullable=False, server_default=text("false")),
    Column("voided", Boolean, nullable=False, server_default=text("false")),
    Column("ready", Boolean, nullable=False, server_default=text("false")),
    Column("verified_elsewhere", Boolean, nullable=False, server_default=text("false")),
)

# The flawed code, one row per language. Every one solves the same problem and
# every one is wrong somewhere; a participant reads whichever language they
# like and hacks that copy. The question is ready when every copy is proven.
p1_hack_solution = Table(
    "p1_hack_solution",
    metadata,
    Column("id", BigInteger, primary_key=True, autoincrement=True),
    Column(
        "question_id",
        BigInteger,
        ForeignKey("p1_hack_question.id", ondelete="CASCADE"),
        nullable=False,
    ),
    Column("language", Text, nullable=False),
    Column("source", Text, nullable=False),
    Column("order_index", Integer, nullable=False, server_default=text("0")),
    Column("proven", Boolean, nullable=False, server_default=text("false")),
    Column("breaking_input", Text),  # an answer key; never sent to a participant
    Index("hack_solution_question_idx", "question_id", "order_index"),
)

p1_hack_attempt = Table(
    "p1_hack_attempt",
    metadata,
    Column("id", BigInteger, primary_key=True, autoincrement=True),
    participant_ref("participant_id"),
    Column("question_id", BigInteger, ForeignKey("p1_hack_question.id"), nullable=False),
    # Which copy of the code was attacked. Null once that copy has been removed:
    # the attempt is history and keeps its score.
    Column("solution_id", BigInteger, ForeignKey("p1_hack_solution.id", ondelete="SET NULL")),
    Column("input", Text, nullable=False),
    Column("state", Text, nullable=False, server_default=text("'pending'")),
    Column("job_id", Text),
    Column("valid_input", Boolean),
    Column("invalid_reason", Text),
    Column("hacked", Boolean),
    Column("verdict", Text),  # staff only
    Column("points_awarded", Integer, nullable=False, server_default=text("0")),
    Column("retries", Integer, nullable=False, server_default=text("0")),
    created_at(),
    timestamp("ended_at"),
    Index("hack_attempt_participant_idx", "participant_id", "question_id"),
)

p1_advancement = Table(
    "p1_advancement",
    metadata,
    Column("participant_id", Text, ForeignKey("participant.user_id"), primary_key=True),
    Column("advanced", Boolean, nullable=False),
    Column("decided_by", Text, nullable=False),
    created_at("decided_at"),
    Column("reason", Text, nullable=False),
)
