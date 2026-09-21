"""A cap on how often one person can be attacked, with a growing break after it.

Without one, everybody attacks whoever is in front. After `attack_cap`
attacks on one person, nobody can attack them for `attack_break_seconds`;
each time that happens to the same person the break is twice as long as
their last. Whether an attack a shield absorbed counts is a switch.

Revision ID: 0009_attack_breaks
"""

from alembic import op

revision = "0009_attack_breaks"
down_revision = "0008_shield_timer"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute('ALTER TABLE "contest" ADD COLUMN "attack_cap" integer DEFAULT 0 NOT NULL')
    op.execute(
        'ALTER TABLE "contest" ADD COLUMN "attack_break_seconds" integer DEFAULT 300 NOT NULL'
    )
    op.execute(
        'ALTER TABLE "contest" ADD COLUMN "count_absorbed_attacks" boolean DEFAULT true NOT NULL'
    )
    op.execute("""
        CREATE TABLE "attack_break" (
            "id" bigserial PRIMARY KEY NOT NULL,
            "participant_id" text NOT NULL REFERENCES "participant"("user_id") ON DELETE CASCADE,
            "number" integer NOT NULL,
            "seconds" integer NOT NULL,
            "starts_at" timestamp with time zone NOT NULL,
            "ends_at" timestamp with time zone NOT NULL,
            "created_at" timestamp with time zone DEFAULT now() NOT NULL
        )
    """)
    op.execute(
        'CREATE INDEX "attack_break_participant_idx" ON "attack_break" ("participant_id", "ends_at")'
    )


def downgrade() -> None:
    op.execute('DROP TABLE "attack_break"')
    op.execute('ALTER TABLE "contest" DROP COLUMN "count_absorbed_attacks"')
    op.execute('ALTER TABLE "contest" DROP COLUMN "attack_break_seconds"')
    op.execute('ALTER TABLE "contest" DROP COLUMN "attack_cap"')
