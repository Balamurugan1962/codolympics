"""When Coding 1 began, so the leaderboard can show each solve as time since the start.

Revision ID: 0016_coding_started
"""

from alembic import op

revision = "0016_coding_started"
down_revision = "0015_five_difficulty_tiers"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute('ALTER TABLE "contest" ADD COLUMN "coding1_started_at" timestamp with time zone')


def downgrade() -> None:
    op.execute('ALTER TABLE "contest" DROP COLUMN "coding1_started_at"')
