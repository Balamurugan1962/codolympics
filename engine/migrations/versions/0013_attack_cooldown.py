"""A short shield after every blackout that lands.

When a blackout ends, its target cannot be attacked again for `attack_cooldown_seconds`
(0 turns it off), so nobody can be chained from one attack straight into the next.

Revision ID: 0013_attack_cooldown
"""

from alembic import op

revision = "0013_attack_cooldown"
down_revision = "0012_contact_details"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        'ALTER TABLE "contest" ADD COLUMN "attack_cooldown_seconds" integer DEFAULT 60 NOT NULL'
    )


def downgrade() -> None:
    op.execute('ALTER TABLE "contest" DROP COLUMN "attack_cooldown_seconds"')
