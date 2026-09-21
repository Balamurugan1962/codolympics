"""Practice runs: a participant's code on the samples or their own input.

Nothing is scored and nothing is stored beyond what the Judge page lists:
who, which question, which language, how it went and how long it took.

Revision ID: 0005_practice_runs
"""

from alembic import op

revision = "0005_practice_runs"
down_revision = "0004_hack_solutions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE "practice_run" (
            "id" bigserial PRIMARY KEY NOT NULL,
            "participant_id" text NOT NULL REFERENCES "participant"("user_id"),
            "question_id" text NOT NULL REFERENCES "question"("id"),
            "language" text NOT NULL,
            "state" text DEFAULT 'pending' NOT NULL,
            "job_id" text,
            "verdict" text,
            "message" text,
            "created_at" timestamp with time zone DEFAULT now() NOT NULL,
            "ended_at" timestamp with time zone
        )
    """)
    op.execute("""
        CREATE INDEX "practice_run_participant_idx"
            ON "practice_run" ("participant_id", "state")
    """)


def downgrade() -> None:
    op.execute('DROP TABLE "practice_run"')
