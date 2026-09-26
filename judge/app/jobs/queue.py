"""The job queue: accept a task, run it on a worker thread, hold the result
until the backend polls for it.

Everything here is in memory and nothing is persisted. A restart loses
in-flight jobs and polling them returns 404, which the backend handles by
resubmitting from its own database (US-J6-04). That is a deliberate trade:
the judge stays simple and has no state to corrupt.
"""
from __future__ import annotations

import logging
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass

from pydantic import BaseModel

from app.jobs.control import POLL_QUEUED_MS, POLL_RUNNING_MS, Cancelled, Task
from app.sandbox.client import CompilerOverloaded, SandboxUnavailable

log = logging.getLogger(__name__)


@dataclass
class Job:
    """One task's place in the queue. It is also the task's JobControl: the
    worker reports progress into it and reads cancellation out of it."""

    job_id: str
    submission_id: str | None
    total: int
    state: str = "queued"           # queued | running | done
    done: int = 0
    result: BaseModel | None = None
    cancelled: bool = False
    finished_at: float | None = None
    pool: str = "main"

    def report(self, done: int) -> None:
        self.done = done

    def poll_after_ms(self) -> int | None:
        if self.state == "queued":
            return POLL_QUEUED_MS
        if self.state == "running":
            return POLL_RUNNING_MS
        return None


class JobQueue:
    """Bounded work queues over fixed thread pools.

    The pool size is the concurrency cap (US-J6-03): judging never uses more
    CPUs than it was given, which is what keeps timings comparable between
    submissions. Hack attempts have a pool of their own ("hack"): they only
    happen in Phase 1, so a larger pool there cannot disturb the timed jobs of
    Phase 2, which stay on the "main" pool.
    """

    def __init__(self, concurrency: int, queue_limit: int, ttl_s: int,
                 hack_concurrency: int | None = None, hack_queue_limit: int | None = None):
        self.concurrency = concurrency
        self.queue_limit = queue_limit
        self.hack_concurrency = hack_concurrency or concurrency
        self.hack_queue_limit = hack_queue_limit or queue_limit
        self.ttl_s = ttl_s
        self._jobs: dict[str, Job] = {}
        self._lock = threading.Lock()
        self._pools = {
            "main": ThreadPoolExecutor(max_workers=concurrency, thread_name_prefix="judge"),
            "hack": ThreadPoolExecutor(max_workers=self.hack_concurrency, thread_name_prefix="judge-hack"),
        }

    # --- capacity ----------------------------------------------------------

    def limit(self, pool: str = "main") -> int:
        return self.hack_queue_limit if pool == "hack" else self.queue_limit

    def counts(self, pool: str | None = None) -> tuple[int, int]:
        """(running, queued), across every pool unless one is named."""
        with self._lock:
            jobs = [job for job in self._jobs.values() if pool is None or job.pool == pool]
        return sum(job.state == "running" for job in jobs), sum(job.state == "queued" for job in jobs)

    def busy(self) -> int:
        return self.counts()[0]

    def has_room(self, pool: str = "main") -> bool:
        return self.counts(pool)[1] < self.limit(pool)

    # --- lifecycle ---------------------------------------------------------

    def submit(self, task: Task, pool: str = "main") -> Job:
        self._sweep_expired()
        job = Job(job_id="job_" + uuid.uuid4().hex[:12], submission_id=task.submission_id, total=task.steps, pool=pool)
        with self._lock:
            self._jobs[job.job_id] = job
        self._pools[pool].submit(self._execute, job, task)
        return job

    def get(self, job_id: str) -> Job | None:
        self._sweep_expired()
        with self._lock:
            return self._jobs.get(job_id)

    def cancel(self, job_id: str) -> bool:
        """Flag a job as cancelled. Returns False if there is no such job.

        Cancelling a finished job is a no-op, not an error (US-J1-03).
        """
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return False
            job.cancelled = True
            return True

    def shutdown(self) -> None:
        for pool in self._pools.values():
            pool.shutdown(wait=False, cancel_futures=True)

    # --- the worker --------------------------------------------------------

    def _execute(self, job: Job, task: Task) -> None:
        if job.cancelled:
            self._finish(job, task.cancelled())
            return
        job.state = "running"
        try:
            result = task.run(job)
        except Cancelled:
            result = task.cancelled()
        except CompilerOverloaded as exc:
            # A busy machine, not their code. Never a compile error, never scored.
            log.warning("compile starved during %s: %s", job.job_id, exc)
            result = task.failed("the judge was too busy to compile this in time. This is not your fault: submit it again")
        except SandboxUnavailable as exc:
            # The sandbox died mid-job. IE, never scored against anyone (US-J2-02).
            log.error("sandbox unavailable during %s: %s", job.job_id, exc)
            result = task.failed("sandbox became unavailable")
        except Exception as exc:  # noqa: BLE001 - a judge bug must not kill the worker
            log.exception("job %s failed", job.job_id)
            result = task.failed(f"judge error: {type(exc).__name__}")
        self._finish(job, result)

    def _finish(self, job: Job, result: BaseModel) -> None:
        job.result = result
        job.done = min(job.done, job.total) if job.total else 0
        job.state = "done"
        job.finished_at = time.monotonic()

    # --- expiry ------------------------------------------------------------

    def _sweep_expired(self) -> None:
        """Drop jobs finished longer ago than the TTL.

        Done inline rather than on a timer: it is a dictionary scan over a few
        hundred entries, and it removes a background thread from the design.
        """
        cutoff = time.monotonic() - self.ttl_s
        with self._lock:
            expired = [
                job_id for job_id, job in self._jobs.items()
                if job.finished_at is not None and job.finished_at < cutoff
            ]
            for job_id in expired:
                del self._jobs[job_id]
