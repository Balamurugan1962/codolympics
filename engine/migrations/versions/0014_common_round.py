"""When the common round began, so its solve times count from then.

The last round is now one contest for everyone: every question nobody bought is open to all
at once, and a solve is timed from this moment rather than from a purchase.

Revision ID: 0014_common_round
"""

from alembic import op

revision = "0014_common_round"
down_revision = "0013_attack_cooldown"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute('ALTER TABLE "contest" ADD COLUMN "final_started_at" timestamp with time zone')


def downgrade() -> None:
    op.execute('ALTER TABLE "contest" DROP COLUMN "final_started_at"')
