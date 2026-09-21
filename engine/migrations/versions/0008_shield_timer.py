"""Shields with a timer, and two switches about what an attack reveals.

A shield used to protect its holder for as long as they held it. Now one is
up at a time, for a set number of seconds (or until it absorbs a blackout,
when the duration is -1), and the rest wait in the inventory as a queue: when
the one that is up ends, by running out or by absorbing a blackout, the next
starts. The contest row gains two switches: whether a
blackout's target is told who sent it, and whether attackers can see who has
a shield up.

Revision ID: 0008_shield_timer
"""

from alembic import op

revision = "0008_shield_timer"
down_revision = "0007_run_details_hack_message"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE "shield" (
            "id" bigserial PRIMARY KEY NOT NULL,
            "participant_id" text NOT NULL REFERENCES "participant"("user_id") ON DELETE CASCADE,
            "powerup_id" bigint REFERENCES "powerup"("id") ON DELETE CASCADE,
            "seconds" integer NOT NULL,
            "starts_at" timestamp with time zone NOT NULL,
            "ends_at" timestamp with time zone,
            "absorbed_at" timestamp with time zone,
            "absorbed_by" text REFERENCES "participant"("user_id") ON DELETE CASCADE,
            "created_at" timestamp with time zone DEFAULT now() NOT NULL
        )
    """)
    op.execute('CREATE INDEX "shield_participant_idx" ON "shield" ("participant_id", "ends_at")')
    op.execute('ALTER TABLE "contest" ADD COLUMN "reveal_attacker" boolean DEFAULT true NOT NULL')
    op.execute('ALTER TABLE "contest" ADD COLUMN "reveal_shields" boolean DEFAULT true NOT NULL')
    # A shield now needs a duration. Five minutes until an organiser sets one.
    op.execute("""
        UPDATE "powerup" SET "duration_seconds" = 300
        WHERE "kind" = 'shield' AND "duration_seconds" IS NULL
    """)


def downgrade() -> None:
    op.execute('ALTER TABLE "contest" DROP COLUMN "reveal_shields"')
    op.execute('ALTER TABLE "contest" DROP COLUMN "reveal_attacker"')
    op.execute('DROP TABLE "shield"')
