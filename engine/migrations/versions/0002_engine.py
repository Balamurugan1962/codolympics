"""What the Python engine adds: the event feed and two invariants the database now enforces.

  event                  the rows the web app polls once a second (engine/events.py)
  lot_single_open        at most one lot on the block at a time
  judgement_one_current  at most one current judgement per submission

Both indexes turn a rule the old code merely assumed into one Postgres refuses
to break, however requests interleave. Data from before them is repaired first,
so the indexes can be created on a database that already ran a contest.

Revision ID: 0002_engine
"""
from alembic import op

revision = "0002_engine"
down_revision = "0001_baseline"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE "event" (
            "id" bigserial PRIMARY KEY NOT NULL,
            "name" text NOT NULL,
            "participant_id" text,
            "data" jsonb NOT NULL,
            "created_at" timestamp with time zone DEFAULT now() NOT NULL
        )
    """)
    # Keep the earliest-offered open lot open; any others go back to pending.
    op.execute("""
        UPDATE "lot" SET "state" = 'pending', "opened_at" = NULL, "no_bid_deadline" = NULL, "bidding_ends_at" = NULL
        WHERE "state" = 'open' AND "id" <> (SELECT "id" FROM "lot" WHERE "state" = 'open' ORDER BY "order", "id" LIMIT 1)
    """)
    op.execute("""CREATE UNIQUE INDEX "lot_single_open" ON "lot" ((true)) WHERE "state" = 'open'""")
    # Keep the highest attempt as the current judgement; stamp any other "current" one as superseded.
    op.execute("""
        UPDATE "judgement" j SET "superseded_at" = now()
        WHERE j."superseded_at" IS NULL AND EXISTS (
            SELECT 1 FROM "judgement" newer
            WHERE newer."submission_id" = j."submission_id" AND newer."superseded_at" IS NULL
              AND (newer."attempt", newer."id") > (j."attempt", j."id")
        )
    """)
    op.execute("""CREATE UNIQUE INDEX "judgement_one_current" ON "judgement" ("submission_id") WHERE "superseded_at" IS NULL""")


def downgrade() -> None:
    op.execute('DROP INDEX IF EXISTS "judgement_one_current"')
    op.execute('DROP INDEX IF EXISTS "lot_single_open"')
    op.execute('DROP TABLE IF EXISTS "event"')
