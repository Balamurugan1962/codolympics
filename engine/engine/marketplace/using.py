"""Using powerups on other people: a Blackout lands, or the target's Shield eats it.

The server is the only authority. Inventory, phase and whether a blackout is still
running are re-read inside the transaction that acts on them.

An attack locks the attacker's and the target's participant rows together, in id
order, so two attacks on one person serialise -- the Shield that is up is spent by
exactly one of them, and the next in the target's queue is up before the other
lands -- and two people attacking each other at once cannot deadlock.

Stacking is adjacency, not overlap. A new blackout starts where the target's last
one ends, so simultaneous attacks queue back to back and the total is the sum.
Remaining time is `max(ends_at) - now`: nothing to keep in step. Replays are
answered from the event row, as described in `engine.marketplace.inventory`.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

import sqlalchemy as sa

from engine.accounts import wallet
from engine.contest.messages import notify
from engine.contest.rules import lock_contest
from engine.core import clock, db, errors, events
from engine.marketplace import breaks, cooldowns, shields
from engine.marketplace.blackouts import blackout_for, blackout_state
from engine.marketplace.inventory import event_for, holdings, take_one
from engine.schema import blackout, powerup, powerup_event, user


def use(actor_id: str, powerup_id: int, target_id: str | None, request_id: str) -> dict[str, Any]:
    """Use a powerup. Blackout needs a target and may be eaten by their Shield."""
    # A retried request answers with what the first copy did. Checked before anything else,
    # because the first copy's own blackout would otherwise refuse the retry as a new attack.
    with db.transaction() as conn:
        seen = event_for(conn, actor_id, request_id) is not None
    if seen:
        return _replay_use(actor_id, request_id)
    try:
        with db.transaction() as conn:
            result = _use(conn, actor_id, powerup_id, target_id, request_id)
    except Exception as err:
        if not db.is_unique_violation(err):
            raise
        return _replay_use(actor_id, request_id)
    if target_id:
        events.publish("powerup", blackout_for(target_id), target_id)
        events.publish("notify", {}, target_id)
        events.publish("powerup", {"you": "acted"}, actor_id)
        # Everyone else's list of targets may have changed: a shield went, a break began.
        events.publish("targets", {"target": target_id})
    return result


def _usable_item(conn: sa.Connection, powerup_id: int) -> sa.Row:
    """The powerup, if it exists, is switched on, and may be used in the current phase."""
    item = conn.execute(sa.select(powerup).where(powerup.c.id == powerup_id)).one_or_none()
    if item is None:
        raise errors.not_found("powerup")
    if not item.enabled:
        raise errors.conflict("powerup_disabled", f"{item.name} is switched off")
    if lock_contest(conn).phase not in item.usable_phases:
        raise errors.conflict(
            "wrong_phase", f"{item.name} cannot be used during this part of the contest"
        )
    return item


def _use(
    conn: sa.Connection, actor_id: str, powerup_id: int, target_id: str | None, request_id: str
) -> dict[str, Any]:
    item = _usable_item(conn, powerup_id)
    if item.kind == "shield":
        _require_owned(conn, actor_id, item)
        raise errors.conflict(
            "passive",
            f"a {item.name} starts on its own when the one before it ends. "
            "There is nothing to activate",
        )
    if not target_id:
        raise errors.invalid("choose who to use it on")
    if target_id == actor_id:
        raise errors.invalid("you cannot use that on yourself")

    # Both rows at once, in id order: see the module docstring.
    locked = wallet.lock_participants(conn, [actor_id, target_id])
    _require_active_actor(locked.get(actor_id))
    held = _require_owned(conn, actor_id, item)
    outcome = _land_blackout(conn, item, actor_id, locked.get(target_id))
    shielded = outcome["shielded"]
    take_one(conn, actor_id, item.id)
    # Last, so a replayed request collides here and rolls everything above back.
    conn.execute(
        sa.insert(powerup_event).values(
            kind="blocked" if shielded else "use",
            powerup_id=item.id,
            actor_id=actor_id,
            target_id=target_id,
            request_id=request_id,
            detail={
                "name": item.name,
                "seconds": item.duration_seconds,
                "shielded": shielded,
            },
        )
    )
    return {
        "ok": True,
        "outcome": "shielded" if shielded else "blackout",
        "ends_at": clock.iso(outcome["ends_at"]),
        "target_name": outcome["target_name"],
        "owned": held - 1,
        "replayed": False,
    }


def _require_active_actor(me: sa.Row | None) -> None:
    if me is None:
        raise errors.forbidden("not a participant")
    if me.disqualified_at:
        raise errors.forbidden("your account is disqualified")


def _require_owned(conn: sa.Connection, actor_id: str, item: sa.Row) -> int:
    quantity, _ = holdings(conn, actor_id, item.id)
    if quantity <= 0:
        raise errors.conflict("not_owned", f"you do not own a {item.name}")
    return quantity


def _land_blackout(
    conn: sa.Connection, item: sa.Row, actor_id: str, target: sa.Row | None
) -> dict[str, Any]:
    """Land one blackout on the (already locked) target, or be eaten by their Shield."""
    if target is None:
        raise errors.not_found("participant")
    if target.disqualified_at:
        raise errors.conflict("target_inactive", "that participant is out of the contest")
    both = [actor_id, target.user_id]
    names = dict(conn.execute(sa.select(user.c.id, user.c.name).where(user.c.id.in_(both))).all())
    c = lock_contest(conn)
    # Whether the target learns who did this is the organisers' call.
    attacker = (names.get(actor_id) or "Someone") if c.reveal_attacker else "Someone"
    target_name = names.get(target.user_id)
    # Someone in a break cannot be attacked, and nothing has been spent yet.
    breaks.assert_attackable(conn, target.user_id, target_name)
    # Or one whose last blackout has only just ended: the attack is cancelled, also unspent.
    cooldowns.assert_attackable(conn, c, target.user_id, target_name)

    if _spend_shield(conn, target.user_id, actor_id, attacker):
        _count_attack(conn, c, target.user_id, absorbed=True)
        return {"shielded": True, "ends_at": None, "target_name": target_name}

    seconds = item.duration_seconds or 0
    if seconds <= 0:
        raise errors.conflict(
            "no_duration", f"{item.name} has no duration set. An organiser must configure it"
        )
    ends_at = _append_blackout(conn, target.user_id, actor_id, seconds)
    notify(conn, target.user_id, f"**{attacker}** blacked you out for {seconds} seconds.")
    _count_attack(conn, c, target.user_id, absorbed=False)
    return {"shielded": False, "ends_at": ends_at, "target_name": target_name}


def _count_attack(conn: sa.Connection, c: sa.Row, target_id: str, absorbed: bool) -> None:
    """This attack may be the one that reaches the cap and starts the target's break."""
    started = breaks.note_attack(conn, c, target_id, absorbed)
    if started is None:
        return
    peace = (
        "for the rest of the contest"
        if started.ends_at is None
        else f"for the next {started.seconds} seconds"
    )
    notify(
        conn,
        target_id,
        f"You have been attacked {c.attack_cap} times. Nobody can attack you {peace}.",
    )


def _spend_shield(conn: sa.Connection, target_id: str, actor_id: str, attacker: str) -> bool:
    """The shield that is up eats the attack, and the next in the queue is up at once."""
    spent = shields.absorb(conn, target_id, actor_id)
    if spent is None:
        return False
    after = shields.shield_state(conn, target_id)
    if after["active"]:
        left = f"The next one is up now, with {after['queued']} more waiting."
    elif after["queued"]:
        left = f"{after['queued']} more waiting."
    else:
        left = "That was your last one."
    notify(
        conn, target_id, f"**{attacker}** tried to black you out. Your shield absorbed it. {left}"
    )
    return True


def _append_blackout(conn: sa.Connection, target_id: str, actor_id: str, seconds: int) -> datetime:
    """Start where the target's current stack ends, so simultaneous attacks add up."""
    now = clock.now()
    until = conn.execute(
        sa.select(sa.func.max(blackout.c.ends_at)).where(
            blackout.c.participant_id == target_id, blackout.c.ends_at > now
        )
    ).scalar()
    if until and until > now:
        starts_at = until
    else:
        starts_at = now
    ends_at = starts_at + timedelta(seconds=seconds)
    conn.execute(
        sa.insert(blackout).values(
            participant_id=target_id,
            by_id=actor_id,
            seconds=seconds,
            starts_at=starts_at,
            ends_at=ends_at,
        )
    )
    return ends_at


def _replay_use(actor_id: str, request_id: str) -> dict[str, Any]:
    """What the first copy of a replayed use did, read back from its event row."""
    with db.transaction() as conn:
        first = event_for(conn, actor_id, request_id)
        if first is None:
            return {
                "ok": True,
                "outcome": "blackout",
                "ends_at": None,
                "target_name": None,
                "owned": 0,
                "replayed": True,
            }
        owned, _ = holdings(conn, actor_id, first.powerup_id)
        target = blackout_state(conn, first.target_id)
        name = conn.execute(sa.select(user.c.name).where(user.c.id == first.target_id)).scalar()
    return {
        "ok": True,
        "outcome": "shielded" if first.kind == "blocked" else "blackout",
        "ends_at": target["ends_at"],
        "target_name": name,
        "owned": owned,
        "replayed": True,
    }
