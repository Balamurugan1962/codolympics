"""The audit log. Every staff action that changes anything writes a row here,
with a reason, inside the same transaction as the change -- so there is no state
in which the contest moved and the log does not say who moved it.
"""

from __future__ import annotations

from typing import Any

import sqlalchemy as sa

from engine.schema import audit_log


def audit(
    conn: sa.Connection,
    *,
    actor_id: str | None,
    action: str,
    reason: str,
    target: str | None = None,
    detail: Any = None,
) -> None:
    conn.execute(
        sa.insert(audit_log).values(
            actor_id=actor_id, action=action, target=target, reason=reason, detail=detail
        )
    )
