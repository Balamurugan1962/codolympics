"""What must exist before the engine serves anything. Safe to run on every start."""

from __future__ import annotations

from engine.accounts import registration
from engine.contest import rules
from engine.marketplace import catalogue


def prepare() -> None:
    rules.ensure_contest_row()  # the single contest row
    registration.ensure_admin()  # the first administrator, if ADMIN_PASSWORD is set
    catalogue.ensure_powerups()  # the default marketplace, into an empty table only
