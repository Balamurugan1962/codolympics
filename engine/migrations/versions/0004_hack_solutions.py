"""A hacking question's flawed code in more than one language.

Every copy solves the same problem and every copy is wrong somewhere. A
participant reads the language they like and hacks that copy; the attempt
records which one. Each copy is proven by its own breaking input, and the
question is ready once every copy is proven.

The single given solution every existing question had becomes its first row,
carrying the proof it already earned, and every past attempt points at it.

Revision ID: 0004_hack_solutions
"""

from alembic import op

revision = "0004_hack_solutions"
down_revision = "0003_question_topic"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE "p1_hack_solution" (
            "id" bigserial PRIMARY KEY NOT NULL,
            "question_id" bigint NOT NULL REFERENCES "p1_hack_question"("id") ON DELETE CASCADE,
            "language" text NOT NULL,
            "source" text NOT NULL,
            "order_index" integer DEFAULT 0 NOT NULL,
            "proven" boolean DEFAULT false NOT NULL,
            "breaking_input" text
        )
    """)
    op.execute("""
        CREATE INDEX "hack_solution_question_idx"
            ON "p1_hack_solution" ("question_id", "order_index")
    """)
    op.execute("""
        INSERT INTO "p1_hack_solution" ("question_id", "language", "source", "proven", "breaking_input")
        SELECT "id", "given_language", "given_source", "ready", "breaking_input"
        FROM "p1_hack_question"
        ORDER BY "id"
    """)
    op.execute("""
        ALTER TABLE "p1_hack_attempt"
            ADD COLUMN "solution_id" bigint REFERENCES "p1_hack_solution"("id") ON DELETE SET NULL
    """)
    op.execute("""
        UPDATE "p1_hack_attempt" a
        SET "solution_id" = s."id"
        FROM "p1_hack_solution" s
        WHERE s."question_id" = a."question_id"
    """)
    op.execute("""
        ALTER TABLE "p1_hack_question"
            DROP COLUMN "given_source",
            DROP COLUMN "given_language",
            DROP COLUMN "breaking_input"
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE "p1_hack_question"
            ADD COLUMN "given_source" text DEFAULT '' NOT NULL,
            ADD COLUMN "given_language" text DEFAULT 'cpp' NOT NULL,
            ADD COLUMN "breaking_input" text
    """)
    op.execute("""
        UPDATE "p1_hack_question" q
        SET "given_source" = s."source",
            "given_language" = s."language",
            "breaking_input" = s."breaking_input"
        FROM (
            SELECT DISTINCT ON ("question_id") *
            FROM "p1_hack_solution"
            ORDER BY "question_id", "order_index", "id"
        ) s
        WHERE s."question_id" = q."id"
    """)
    op.execute("""ALTER TABLE "p1_hack_attempt" DROP COLUMN "solution_id" """)
    op.execute("""DROP TABLE "p1_hack_solution" """)
