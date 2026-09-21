"""The background loop: once a second, settle the auction clock and move judge work along.

    python -m engine.scheduler        run it on its own
    (or it starts inside the API process -- see api/main.py)

Every deadline and every job state is a database row, so a restart resumes
exactly where it stopped: there is no in-memory queue or timer to lose.

Exactly one scheduler ticks at a time, however many API processes are running.
Each tick first takes `pg_try_advisory_xact_lock` on a connection of its own;
whoever gets it does the tick, everyone else skips this second. The lock is a
transaction lock, released when the tick finishes -- or when its process dies
and the connection closes -- so there is nothing to clean up and no stale owner.

The tick is not what makes the contest correct, though. Every step re-checks
under row locks (see auction.lots.settle_if_due, coding.judging._write_result),
so even two ticks overlapping could not settle a lot twice or record a verdict
twice. The lock just avoids the wasted work.
"""

from __future__ import annotations

import logging
import threading
import time
from collections.abc import Callable

from engine.auction import lots
from engine.coding import judging, runs
from engine.core import db, events
from engine.marketplace import shields
from engine.phase1 import hack_jobs, validator_jobs

log = logging.getLogger("engine.scheduler")


STEPS: tuple[tuple[str, Callable[[], None]], ...] = (
    ("auction", lots.tick),
    ("submissions", judging.tick),
    ("runs", runs.tick),
    ("hacking", hack_jobs.tick),
    ("puzzles", validator_jobs.tick),
    ("shields", shields.tick),
)


PRUNE_EVERY_TICKS = 60


def tick() -> bool:
    """Run one tick if no other process is running one. Returns whether this process ran it."""
    with db.pool.connect() as lock_conn, lock_conn.begin():
        if not db.try_advisory_xact_lock(lock_conn, db.LOCK_SCHEDULER):
            return False
        for name, step in STEPS:
            # One failing step (the judge is down, say) must not stop the auction clock.
            try:
                step()
            except Exception:
                log.exception("scheduler step %s failed", name)
    return True


def run(stop: threading.Event, interval_s: float) -> None:
    ticks = 0
    while not stop.is_set():
        started = time.monotonic()
        try:
            if tick():
                ticks += 1
                if ticks % PRUNE_EVERY_TICKS == 0:
                    events.prune()
        except Exception:
            # The database was unreachable; try again next second.
            log.exception("scheduler tick failed")
        stop.wait(max(0.0, interval_s - (time.monotonic() - started)))


def start_in_background(interval_s: float) -> threading.Event:
    stop = threading.Event()
    thread = threading.Thread(target=run, args=(stop, interval_s), name="scheduler", daemon=True)
    thread.start()
    log.info("scheduler running every %.1f s", interval_s)
    return stop


if __name__ == "__main__":
    from engine.bootstrap import prepare
    from engine.core.config import settings

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    prepare()
    run(threading.Event(), settings.scheduler_interval_s)
