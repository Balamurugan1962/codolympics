"""Hack attempts have their own pool: it can be bigger without touching the timed one."""
from __future__ import annotations

import threading
import time

from pydantic import BaseModel

from app.jobs.queue import JobQueue


class _Result(BaseModel):
    ok: bool = True


class _Hold:
    """A task that runs until released, and records how many ran at once."""

    submission_id = None
    steps = 1

    def __init__(self, gate: threading.Event, live: list[int], peak: list[int]):
        self.gate, self.live, self.peak = gate, live, peak

    def run(self, control) -> _Result:
        self.live[0] += 1
        self.peak[0] = max(self.peak[0], self.live[0])
        self.gate.wait(5)
        self.live[0] -= 1
        return _Result()

    def failed(self, message: str) -> _Result:
        return _Result(ok=False)

    def cancelled(self) -> _Result:
        return _Result(ok=False)


def _fill(queue: JobQueue, pool: str, n: int):
    gate, live, peak = threading.Event(), [0], [0]
    for _ in range(n):
        queue.submit(_Hold(gate, live, peak), pool)
    time.sleep(0.3)
    return gate, peak


def test_the_hack_pool_runs_more_at_once_than_the_timed_pool() -> None:
    queue = JobQueue(concurrency=2, queue_limit=4, ttl_s=60, hack_concurrency=5, hack_queue_limit=10)
    hack_gate, hack_peak = _fill(queue, "hack", 5)
    main_gate, main_peak = _fill(queue, "main", 5)
    assert hack_peak[0] == 5  # every hack in the bigger pool ran together
    assert main_peak[0] == 2  # the timed pool did not grow
    assert queue.counts("hack") == (5, 0)
    assert queue.counts("main") == (2, 3)
    hack_gate.set()
    main_gate.set()
    queue.shutdown()


def test_each_pool_has_its_own_room() -> None:
    queue = JobQueue(concurrency=1, queue_limit=1, ttl_s=60, hack_concurrency=1, hack_queue_limit=3)
    gate, _ = _fill(queue, "main", 2)  # one running, one queued: full
    assert not queue.has_room("main")
    assert queue.has_room("hack")  # a full timed queue does not turn hacks away
    gate.set()
    queue.shutdown()


def test_the_hack_pool_defaults_to_the_timed_size() -> None:
    queue = JobQueue(concurrency=3, queue_limit=6, ttl_s=60)
    assert (queue.hack_concurrency, queue.hack_queue_limit) == (3, 6)
    queue.shutdown()
