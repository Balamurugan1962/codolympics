"""A setup zip carries the day's rules and comes back exactly: what was exported is what imports."""

from __future__ import annotations

import sqlalchemy as sa
from conftest import add_user, rows, set_contest

from engine.marketplace import catalogue
from engine.packages import setup_zip
from engine.schema import contest, powerup

RULES = {
    "auction_mode": "offline",
    "marketplace_open": False,
    "reveal_attacker": False,
    "reveal_shields": False,
    "attack_cap": 4,
    "attack_break_seconds": 90,
    "attack_cooldown_seconds": 45,
    "count_absorbed_attacks": False,
    "after_cap": "forever",
    "proctoring": False,
    "proctor_warnings": 5,
    "starting_balance": 1234,
    "p1_puzzles_minutes": 75,
}


def _contest_row() -> sa.Row:
    return rows(sa.select(contest))[0]


def test_every_rule_and_the_powerups_survive_an_export_and_import() -> None:
    admin = add_user("boss", role="admin")
    set_contest(**RULES)
    blackout = next(p for p in catalogue.catalogue() if p.kind == "blackout")
    catalogue.save(
        admin, blackout.id, {"price": 77, "duration_seconds": 33, "enabled": False}, "set"
    )

    _, data = setup_zip.export_setup(include_staff=False)

    defaults = {k: v for k, v in RULES.items() if isinstance(v, bool | str)}
    set_contest(**{k: (not v if isinstance(v, bool) else "online") for k, v in defaults.items()})
    set_contest(
        attack_cap=0, attack_break_seconds=300, attack_cooldown_seconds=0, proctor_warnings=3
    )
    catalogue.save(
        admin, blackout.id, {"price": 1, "duration_seconds": 10, "enabled": True}, "reset"
    )

    summary = setup_zip.import_setup(admin, data, "restore")

    row = _contest_row()
    assert {k: getattr(row, k) for k in RULES} == RULES
    item = rows(sa.select(powerup).where(powerup.c.id == blackout.id))[0]
    assert (item.price, item.duration_seconds, item.enabled) == (77, 33, False)
    assert summary["settings"] is True and summary["powerups"] >= 1
