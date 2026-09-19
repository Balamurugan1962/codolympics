"""The database connection, and the one way to use it.

    with transaction() as conn:
        ...every read and write in here commits together, or not at all

Postgres runs at READ COMMITTED. Where two requests could interleave badly, the
function doing the work takes a row lock (`with_for_update()`) on the row that
represents the thing being contended -- the lot being bid on, the participant
whose money is moving -- and that is documented where it happens. See README.md
for the full list.

For the few things that are not a row, this module also provides transaction-scoped
advisory locks, and keeps every advisory lock key in one place.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

import sqlalchemy as sa
from sqlalchemy.exc import IntegrityError

from engine.core.config import settings
from engine.core.serialize import dumps

pool = sa.create_engine(
    settings.database_url,
    pool_size=10,
    max_overflow=10,
    pool_pre_ping=True,
    json_serializer=dumps,
)


@contextmanager
def transaction() -> Iterator[sa.Connection]:
    with pool.begin() as conn:
        yield conn


def is_unique_violation(err: Exception) -> bool:
    """A duplicate key, as opposed to any other integrity failure."""
    return isinstance(err, IntegrityError) and getattr(err.orig, "sqlstate", None) == "23505"


# --- Advisory locks ---------------------------------------------------------------------------


def advisory_xact_lock(conn: sa.Connection, key: int) -> None:
    """Serialise on `key` until this transaction ends."""
    conn.execute(sa.select(sa.func.pg_advisory_xact_lock(key)))


def advisory_xact_lock_on(conn: sa.Connection, key: int, name: str) -> None:
    """Serialise on one named thing within a family of locks, e.g. one problem id."""
    conn.execute(sa.select(sa.func.pg_advisory_xact_lock(key, sa.func.hashtext(name))))


def try_advisory_xact_lock(conn: sa.Connection, key: int) -> bool:
    acquired = conn.execute(sa.select(sa.func.pg_try_advisory_xact_lock(key))).scalar()
    return bool(acquired)


# Advisory lock keys, in one place so two never collide.
LOCK_SCHEDULER = 7201
LOCK_EVENT_ORDER = 7202
LOCK_POWERUP_SEED = 7203
LOCK_PUBLISH_PACKAGE = 7204
