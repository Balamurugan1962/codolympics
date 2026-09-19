"""The topic a question is auctioned under.

Bidding is blind: the room is told a question's topic, its difficulty, what it
costs to open and what it pays, and nothing else. The title and the statement
would give away the problem, so they stay with the setter until somebody owns
it. `topic` is what a bidder is bidding on, so it is authored with the rest of
the question's details.

Existing questions get an empty topic, which reads as "not set" on the floor
until a setter fills it in.

Revision ID: 0003_question_topic
"""

from alembic import op

revision = "0003_question_topic"
down_revision = "0002_engine"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""ALTER TABLE "question" ADD COLUMN "topic" text DEFAULT '' NOT NULL""")


def downgrade() -> None:
    op.execute("""ALTER TABLE "question" DROP COLUMN "topic" """)
