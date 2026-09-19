"""Moving virtual money. Every balance change after the starting balance goes through here.

`move` locks the participant's row, applies the change and writes the ledger
line in the caller's transaction. Holding the row lock until commit is what
makes two purchases racing the same balance run one after the other: the second
reads the balance the first left behind, never the one they both started from.
The CHECK (balance >= 0) on the table is the backstop if a caller forgets to
check first.

Lock order, everywhere in the engine: lot or question first, then participant
rows. When two participants are involved, their rows are locked together in id
order (`lock_participants`), so two people attacking each other at the same
moment cannot deadlock.
"""

from __future__ import annotations

import sqlalchemy as sa

from engine.core import errors
from engine.schema import ledger, participant


def lock_participant(conn: sa.Connection, participant_id: str) -> sa.Row | None:
    return conn.execute(
        sa.select(participant).where(participant.c.user_id == participant_id).with_for_update()
    ).one_or_none()


def lock_participants(conn: sa.Connection, ids: list[str]) -> dict[str, sa.Row]:
    """Lock several participant rows in a fixed order.

    The fixed order means no two transactions can wait on each other in a cycle.
    """
    found = conn.execute(
        sa.select(participant)
        .where(participant.c.user_id.in_(ids))
        .order_by(participant.c.user_id)
        .with_for_update()
    ).all()
    return {row.user_id: row for row in found}


STARTING_GRANT = "starting_balance"
STARTING_CLAWBACK = "starting_balance_removed"


def holds_starting_balance(conn: sa.Connection, participant_id: str) -> bool:
    """Whether this participant has been given their starting coins and still has the grant.

    Read from the ledger rather than the balance, because a balance can have
    been spent or adjusted since, and the question here is only whether the
    grant was ever made and not since taken back.
    """
    net = conn.execute(
        sa.select(sa.func.coalesce(sa.func.sum(ledger.c.delta), 0)).where(
            ledger.c.participant_id == participant_id,
            ledger.c.reason.in_((STARTING_GRANT, STARTING_CLAWBACK)),
        )
    ).scalar()
    return bool(net) and net > 0


def settle_starting_balance(
    conn: sa.Connection,
    participant_id: str,
    entitled: bool,
    amount: int,
    *,
    held: bool | None = None,
) -> None:
    """Give the starting coins to whoever should have them, take them back from whoever should not.

    Idempotent: running it twice pays nobody twice, and it is the one place that
    decides what "has their starting coins" means. `held` skips the lookup for a
    caller that has already read it for everybody at once.
    """
    if not amount:
        return
    if held is None:
        held = holds_starting_balance(conn, participant_id)
    if entitled and not held:
        move(conn, participant_id, amount, STARTING_GRANT, None)
    elif not entitled and held:
        move(conn, participant_id, -amount, STARTING_CLAWBACK, None)


def move(conn: sa.Connection, participant_id: str, delta: int, reason: str, ref: str | None) -> int:
    """Add `delta` (negative to charge) and record it. Returns the balance after."""
    p = lock_participant(conn, participant_id)
    if p is None:
        raise errors.not_found("participant")
    after = p.balance + delta
    if after < 0:
        raise errors.conflict("negative_balance", f"that would leave {after}")
    conn.execute(
        sa.update(participant).where(participant.c.user_id == participant_id).values(balance=after)
    )
    conn.execute(
        sa.insert(ledger).values(
            participant_id=participant_id,
            delta=delta,
            balance_after=after,
            reason=reason,
            ref=ref,
        )
    )
    return after
