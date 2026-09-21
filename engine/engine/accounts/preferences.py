"""What a participant has said about how they like to work."""

from __future__ import annotations

import sqlalchemy as sa

from engine.core import db, errors
from engine.judge import languages
from engine.schema import participant


def set_preferred_language(participant_id: str, language: str) -> None:
    """The language every dropdown opens on. Asked at registration; a change
    made from any dropdown sticks from then on."""
    offered = {lang["key"] for lang in languages.offered()}
    if offered and language not in offered:
        raise errors.invalid(f"{language!r} is not a language the judge offers")
    with db.transaction() as conn:
        conn.execute(
            sa.update(participant)
            .where(participant.c.user_id == participant_id)
            .values(preferred_language=language)
        )
