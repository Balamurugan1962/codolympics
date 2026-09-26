"""Five difficulty tiers: beginner, easy, easy-medium, medium, hard.

`very_easy` was the lowest of four tiers and is now `beginner`, the lowest of five.
The new `easy_medium` tier sits between `easy` and `medium`; no existing row is moved
into it here, because which questions belong there is a decision for the setter
(re-import the question, or edit its tier).

Revision ID: 0015_five_difficulty_tiers
"""

from alembic import op

revision = "0015_five_difficulty_tiers"
down_revision = "0014_common_round"
branch_labels = None
depends_on = None


def _rename(old: str, new: str) -> None:
    op.execute(f"""UPDATE "question" SET "difficulty" = '{new}' WHERE "difficulty" = '{old}'""")


def upgrade() -> None:
    _rename("very_easy", "beginner")


def downgrade() -> None:
    _rename("easy_medium", "easy")
    _rename("beginner", "very_easy")
