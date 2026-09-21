"""A cap on how often one person can be attacked, and the break that follows.

Left alone, everybody attacks whoever is in front. So after `attack_cap`
attacks on one person, nobody can attack them for a while, and the while
doubles each time it happens to the same person: the more they are hunted,
the longer their breaks. Or, if the organisers prefer, the cap is the end of
it: after that nobody can attack them for the rest of the contest. An attack
that arrives during a break is refused before anything is spent.

Counting starts afresh after each break. What counts is every blackout aimed
at the person, landed or absorbed by a shield, unless the organisers say only
landed ones do.

All of it runs inside the attack's transaction, which holds the target's
participant row lock: n+1 attacks arriving together are served one at a
time, the n-th starts the break, and the one behind it finds the break there
and is refused.
"""

from __future__ import annotations

import math
from datetime import timedelta
from typing import Any

import sqlalchemy as sa

from engine.core import clock, errors
from engine.schema import attack_break, powerup_event

FOREVER = "forever"


def _still_on() -> sa.ColumnElement[bool]:
    return sa.or_(attack_break.c.ends_at.is_(None), attack_break.c.ends_at > clock.now())


def current(conn: sa.Connection, participant_id: str) -> sa.Row | None:
    """The break this person is in right now, if any."""
    return conn.execute(
        sa.select(attack_break)
        .where(attack_break.c.participant_id == participant_id, _still_on())
        .order_by(attack_break.c.number.desc())
        .limit(1)
    ).one_or_none()


def assert_attackable(conn: sa.Connection, target_id: str, target_name: str | None) -> None:
    """Refuse an attack on someone in a break. Nothing has been spent yet."""
    on_break = current(conn, target_id)
    if on_break is None:
        return
    who = target_name or "they"
    if on_break.ends_at is None:
        raise errors.conflict(
            "target_on_break", f"{who} cannot be attacked again for the rest of the contest"
        )
    left = math.ceil((on_break.ends_at - clock.now()).total_seconds())
    raise errors.conflict(
        "target_on_break",
        f"{who} cannot be attacked for another {left} second{'s' if left != 1 else ''}",
    )


def note_attack(conn: sa.Connection, c: sa.Row, target_id: str, absorbed: bool) -> sa.Row | None:
    """Count this attack; start the target's next break if it reaches the cap.

    Called before the attack's own event row is written, so `earlier` is the
    attacks before this one. Returns the break that started, if one did.
    """
    cap = c.attack_cap or 0
    if cap <= 0:
        return None
    if absorbed and not c.count_absorbed_attacks:
        return None
    last = conn.execute(
        sa.select(attack_break)
        .where(attack_break.c.participant_id == target_id)
        .order_by(attack_break.c.number.desc())
        .limit(1)
    ).one_or_none()
    kinds = ("use", "blocked") if c.count_absorbed_attacks else ("use",)
    since = [powerup_event.c.target_id == target_id, powerup_event.c.kind.in_(kinds)]
    if last is not None:
        since.append(powerup_event.c.created_at >= last.ends_at)
    earlier = conn.execute(sa.select(sa.func.count()).where(*since)).scalar_one()
    if earlier + 1 < cap:
        return None
    number = (last.number if last else 0) + 1
    forever = c.after_cap == FOREVER
    seconds = 0 if forever else (c.attack_break_seconds or 0) * 2 ** (number - 1)
    now = clock.now()
    return conn.execute(
        sa.insert(attack_break)
        .values(
            participant_id=target_id,
            number=number,
            seconds=seconds,
            starts_at=now,
            ends_at=None if forever else now + timedelta(seconds=seconds),
        )
        .returning(attack_break)
    ).one()


def break_state(conn: sa.Connection, participant_id: str) -> dict[str, Any]:
    """What the person sees next to the clock: whether they are in a break, and until when.

    `ends_at` is null for a break that lasts the rest of the contest.
    """
    on_break = current(conn, participant_id)
    return {
        "active": on_break is not None,
        "ends_at": clock.iso(on_break.ends_at) if on_break and on_break.ends_at else None,
        "number": on_break.number if on_break else 0,
        "server_now": clock.now_ms(),
    }


def on_break_now(conn: sa.Connection) -> dict[str, str | None]:
    """Everyone in a break, with when it ends (None: never), for the attacker's list of targets."""
    found = conn.execute(
        sa.select(attack_break.c.participant_id, attack_break.c.ends_at).where(_still_on())
    ).all()
    out: dict[str, str | None] = {}
    for pid, ends in found:
        # A break with no end outranks any timed one.
        if pid in out and out[pid] is None:
            continue
        out[pid] = None if ends is None else clock.iso(ends)
    return out
