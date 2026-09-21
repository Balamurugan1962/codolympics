"""A draft per language, not one per question.

Switching language in the editor brings back what was written in that
language, so the code is keyed by language too. Every existing draft keeps
its place as the draft of the language it was written in.

Revision ID: 0006_draft_per_language
"""

from alembic import op

revision = "0006_draft_per_language"
down_revision = "0005_practice_runs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute('ALTER TABLE "draft" DROP CONSTRAINT "draft_participant_id_question_id_pk"')
    op.execute("""
        ALTER TABLE "draft" ADD CONSTRAINT "draft_participant_question_language_pk"
            PRIMARY KEY ("participant_id", "question_id", "language")
    """)


def downgrade() -> None:
    # Keep the newest draft of each question; the rest cannot share a key.
    op.execute("""
        DELETE FROM "draft" d USING "draft" newer
        WHERE newer."participant_id" = d."participant_id"
          AND newer."question_id" = d."question_id"
          AND newer."updated_at" > d."updated_at"
    """)
    op.execute('ALTER TABLE "draft" DROP CONSTRAINT "draft_participant_question_language_pk"')
    op.execute("""
        ALTER TABLE "draft" ADD CONSTRAINT "draft_participant_id_question_id_pk"
            PRIMARY KEY ("participant_id", "question_id")
    """)
