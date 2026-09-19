"""Time, in one place.

Every deadline in the contest is compared against the server's clock, never a
browser's. Timestamps leave the engine as ISO strings with millisecond
precision, exactly the shape JavaScript's `Date.toISOString()` produces, so the
web app parses them the same way it always has.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta


def now() -> datetime:
    return datetime.now(UTC)


def now_ms() -> int:
    return int(now().timestamp() * 1000)


def ms(dt: datetime) -> int:
    return int(as_utc(dt).timestamp() * 1000)


def as_utc(dt: datetime) -> datetime:
    # Better Auth's tables use `timestamp without time zone`, holding UTC.
    return dt.replace(tzinfo=UTC) if dt.tzinfo is None else dt.astimezone(UTC)


def iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    return as_utc(dt).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def seconds_from_now(seconds: float) -> datetime:
    return now() + timedelta(seconds=seconds)
