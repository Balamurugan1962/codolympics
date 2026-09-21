"""What happens once the attack cap is reached: a break, or off limits for good.

Revision ID: 0010_after_cap
"""

from alembic import op

revision = "0010_after_cap"
down_revision = "0009_attack_breaks"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 'break': a timed break that doubles each time. 'forever': nobody can attack
    # them again this contest.
    op.execute("ALTER TABLE \"contest\" ADD COLUMN \"after_cap\" text DEFAULT 'break' NOT NULL")
    op.execute('ALTER TABLE "attack_break" ALTER COLUMN "ends_at" DROP NOT NULL')


def downgrade() -> None:
    op.execute('DELETE FROM "attack_break" WHERE "ends_at" IS NULL')
    op.execute('ALTER TABLE "attack_break" ALTER COLUMN "ends_at" SET NOT NULL')
    op.execute('ALTER TABLE "contest" DROP COLUMN "after_cap"')
