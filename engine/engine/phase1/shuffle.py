"""Each participant's own order of the Phase 1 questions.

Neighbours in the hall who see the same question at the same moment can copy each
other, so every participant gets the questions in an order of their own. The order
comes from hashing the participant with each question, so it is the same on every
reload and every machine, differs from person to person, and a question published
later slots in without moving the others. The organisers' order is still what the
admin pages show; participants never see it.
"""

from __future__ import annotations

import hashlib
from collections.abc import Sequence


def for_participant[T](rows: Sequence[T], participant_id: str, section: str) -> list[T]:
    """`rows` (anything with an `id`) in this participant's order for this section."""

    def key(row: T) -> bytes:
        seed = f"{section}:{participant_id}:{row.id}"  # type: ignore[attr-defined]
        return hashlib.sha256(seed.encode()).digest()

    return sorted(rows, key=key)
