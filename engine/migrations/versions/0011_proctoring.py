"""Keeping competitors on the page: full screen, focused, or locked out.

While a round runs, a participant's browser stays in full screen with the
contest focused. Leaving (exiting full screen, switching window or tab) is an
alert; after `proctor_warnings` alerts the next one locks the account, and
only an administrator unlocks it. Each alert is kept, for the organisers.

Revision ID: 0011_proctoring
"""

from alembic import op

revision = "0011_proctoring"
down_revision = "0010_after_cap"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute('ALTER TABLE "contest" ADD COLUMN "proctoring" boolean DEFAULT true NOT NULL')
    op.execute('ALTER TABLE "contest" ADD COLUMN "proctor_warnings" integer DEFAULT 3 NOT NULL')
    op.execute(
        'ALTER TABLE "participant" ADD COLUMN "proctor_alerts" integer DEFAULT 0 NOT NULL'
    )
    op.execute('ALTER TABLE "participant" ADD COLUMN "proctor_locked_at" timestamp with time zone')
    op.execute("""
        CREATE TABLE "proctor_event" (
            "id" bigserial PRIMARY KEY NOT NULL,
            "participant_id" text NOT NULL REFERENCES "participant"("user_id") ON DELETE CASCADE,
            "kind" text NOT NULL,
            "created_at" timestamp with time zone DEFAULT now() NOT NULL
        )
    """)
    op.execute(
        'CREATE INDEX "proctor_event_participant_idx" ON "proctor_event" ("participant_id", "id")'
    )


def downgrade() -> None:
    op.execute('DROP TABLE "proctor_event"')
    op.execute('ALTER TABLE "participant" DROP COLUMN "proctor_locked_at"')
    op.execute('ALTER TABLE "participant" DROP COLUMN "proctor_alerts"')
    op.execute('ALTER TABLE "contest" DROP COLUMN "proctor_warnings"')
    op.execute('ALTER TABLE "contest" DROP COLUMN "proctoring"')
