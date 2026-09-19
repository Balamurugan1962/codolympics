"""Bring the database schema up to date. Run on every start; it is idempotent.

    python -m engine.migrate

A database the web app's Drizzle migrations already built has every baseline
table but no Alembic history. That database is stamped at the baseline -- which
records "already applied" without running it -- and then upgraded like any other.
"""

from __future__ import annotations

from pathlib import Path

import sqlalchemy as sa
from alembic import command
from alembic.config import Config

from engine.core.db import pool

ALEMBIC_INI = Path(__file__).resolve().parent.parent / "alembic.ini"


def main() -> None:
    config = Config(str(ALEMBIC_INI))
    config.set_main_option("script_location", str(ALEMBIC_INI.parent / "migrations"))
    with pool.connect() as conn:
        tables = set(sa.inspect(conn).get_table_names())
    if "contest" in tables and "alembic_version" not in tables:
        command.stamp(config, "0001_baseline")
    command.upgrade(config, "head")


if __name__ == "__main__":
    main()
