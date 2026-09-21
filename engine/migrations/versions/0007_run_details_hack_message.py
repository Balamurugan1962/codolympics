"""What a practice run was, and what the judge said about a hack attempt.

A run now keeps its source, the custom input and the outputs it produced, so
an organiser can open it from the Judge monitor the way they open a
submission. A hack attempt keeps the judge's message, which is the only
account of a judge error.

Revision ID: 0007_run_details_hack_message
"""

from alembic import op

revision = "0007_run_details_hack_message"
down_revision = "0006_draft_per_language"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute('ALTER TABLE "practice_run" ADD COLUMN "source" text')
    op.execute('ALTER TABLE "practice_run" ADD COLUMN "custom_input" text')
    op.execute('ALTER TABLE "practice_run" ADD COLUMN "sample_count" integer DEFAULT 0 NOT NULL')
    op.execute('ALTER TABLE "practice_run" ADD COLUMN "result" jsonb')
    op.execute('ALTER TABLE "p1_hack_attempt" ADD COLUMN "message" text')


def downgrade() -> None:
    op.execute('ALTER TABLE "p1_hack_attempt" DROP COLUMN "message"')
    op.execute('ALTER TABLE "practice_run" DROP COLUMN "result"')
    op.execute('ALTER TABLE "practice_run" DROP COLUMN "sample_count"')
    op.execute('ALTER TABLE "practice_run" DROP COLUMN "custom_input"')
    op.execute('ALTER TABLE "practice_run" DROP COLUMN "source"')
