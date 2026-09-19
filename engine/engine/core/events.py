"""The event feed the web app polls once a second.

When something changes -- a bid lands, a verdict arrives, a phase advances --
the engine appends a row here after the change has committed. Each open page
asks `/api/poll?after=<last id it saw>` and gets the rows since, filtered to
what that viewer may see. The payloads are exactly what the old in-process SSE
stream carried, so the frontend handles them the same way.

Why a table rather than memory: the engine may run as several processes, and a
restart must not strand a browser. Everything a poll needs is in Postgres.

Why the advisory lock: a poller advances its cursor to the highest id it has
seen. If two publishers inserted concurrently, id 11 could commit before id 10
and a poll in between would skip 10 forever. Taking one lock around the tiny
insert makes ids commit in order. It is held for a single-row insert, never
across contest work, so it costs nothing measurable.

An event is a nudge, not the source of truth. If the insert fails the change
has still happened, so the failure is logged rather than raised, and the page
catches up on its next full state read.
"""

from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any

import sqlalchemy as sa

from engine.core import clock, db
from engine.schema import event

log = logging.getLogger("engine.events")


RETENTION = timedelta(minutes=30)


def publish(name: str, data: dict[str, Any] | None = None, to: str | None = None) -> None:
    """Record that `name` happened, for everyone or for one participant. Call after commit."""
    payload = {**(data or {}), "server_now": clock.now_ms()}
    try:
        with db.transaction() as conn:
            db.advisory_xact_lock(conn, db.LOCK_EVENT_ORDER)
            conn.execute(sa.insert(event).values(name=name, participant_id=to, data=payload))
    except Exception:
        log.exception("could not publish %s", name)


def cursor(conn: sa.Connection) -> int:
    """The id of the newest event -- where a freshly loaded page starts polling from."""
    newest_id = sa.select(sa.func.coalesce(sa.func.max(event.c.id), 0))
    return int(conn.execute(newest_id).scalar())


def since(viewer_id: str, after: int) -> dict[str, Any]:
    """Events after `after` that this viewer may see, and whether some were already pruned."""
    with db.transaction() as conn:
        # Read the newest id first. Because ids commit in order, every event up
        # to it is already visible, so nothing below it can appear later.
        oldest, newest = conn.execute(
            sa.select(sa.func.min(event.c.id), sa.func.max(event.c.id))
        ).one()
        # A cursor older than everything retained means events were pruned in
        # between; the page must re-read the whole state rather than trust itself.
        pruned = oldest is not None and after < oldest - 1
        latest = newest or 0
        if latest <= after:
            return _feed([], after, reset=pruned)
        visible_to_viewer = sa.or_(
            event.c.participant_id.is_(None),
            event.c.participant_id == viewer_id,
        )
        rows = conn.execute(
            sa.select(event.c.id, event.c.name, event.c.data)
            .where(event.c.id > after, event.c.id <= latest, visible_to_viewer)
            .order_by(event.c.id)
        ).all()
    return _feed(rows, latest, reset=pruned)


def _feed(rows: list[sa.Row], cursor_: int, *, reset: bool) -> dict[str, Any]:
    return {
        "events": [{"id": r.id, "name": r.name, "data": r.data} for r in rows],
        "cursor": cursor_,
        "reset": reset,
        "server_now": clock.now_ms(),
    }


def prune() -> None:
    with db.transaction() as conn:
        conn.execute(sa.delete(event).where(event.c.created_at < clock.now() - RETENTION))
