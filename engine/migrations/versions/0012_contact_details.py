"""Who to phone: a participant's mobile number and, optionally, an email address.

Contact details only. Nobody signs in with them, and only staff ever see them.

Revision ID: 0012_contact_details
"""

from alembic import op

revision = "0012_contact_details"
down_revision = "0011_proctoring"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute('ALTER TABLE "participant" ADD COLUMN "mobile" text')
    op.execute('ALTER TABLE "participant" ADD COLUMN "contact_email" text')


def downgrade() -> None:
    op.execute('ALTER TABLE "participant" DROP COLUMN "contact_email"')
    op.execute('ALTER TABLE "participant" DROP COLUMN "mobile"')
