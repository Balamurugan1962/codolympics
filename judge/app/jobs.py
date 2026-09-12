"""The job queue: accept a submission, judge it on a worker thread, hold the
result until the backend polls for it.

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
from dataclasses import dataclass, field

from .config import settings
from .gojudge import SandboxUnavailable
from .judge import Cancelled, Judge
from .languages import Language
from .models import Judgement
from .problems import Problem

log = logging.getLogger(__name__)

POLL_QUEUED_MS = 500
POLL_RUNNING_MS = 1000


@dataclass
class Job:
    job_id: str
    submission_id: str | None
    total: int
    state: str = "queued"           # queued | running | done
    done: int = 0
    result: Judgement | None = None
    cancelled: bool = False
    finished_at: float | None = None
    _lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

    def poll_after_ms(self) -> int | None:
        if self.state == "queued":
            return POLL_QUEUED_MS
        if self.state == "running":
            return POLL_RUNNING_MS
        return None


class JobQueue:
    """Bounded work queue over a fixed thread pool.

    The pool size is the concurrency cap (US-J6-03): judging never uses more
    CPUs than it was given, which is what keeps timings comparable between
    submissions.
    """

    def __init__(self, judge: Judge):
        self.judge = judge
        self.concurrency = settings.resolved_concurrency()
        self.queue_limit = settings.resolved_queue_limit()
        self._jobs: dict[str, Job] = {}
        self._lock = threading.Lock()
        self._pool = ThreadPoolExecutor(
            max_workers=self.concurrency, thread_name_prefix="judge"
        )

    # --- capacity ----------------------------------------------------------

    def counts(self) -> tuple[int, int]:
        """(running, queued)"""
        with self._lock:
            running = sum(1 for job in self._jobs.values() if job.state == "running")
            queued = sum(1 for job in self._jobs.values() if job.state == "queued")
        return running, queued

    def busy(self) -> int:
        return self.counts()[0]

    def has_room(self) -> bool:
        return self.counts()[1] < self.queue_limit

    # --- lifecycle ---------------------------------------------------------

    def submit(
        self,
        problem: Problem,
        language: Language,
        source: str,
        submission_id: str | None,
    ) -> Job:
        self._sweep_expired()
        job = Job(
            job_id="job_" + uuid.uuid4().hex[:12],
            submission_id=submission_id,
            total=problem.total,
        )
        with self._lock:
            self._jobs[job.job_id] = job
        self._pool.submit(self._execute, job, problem, language, source)
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
        self._pool.shutdown(wait=False, cancel_futures=True)

    # --- the worker --------------------------------------------------------

    def _execute(self, job: Job, problem: Problem, language: Language, source: str) -> None:
        if job.cancelled:
            self._finish(job, _cancelled_judgement(job, problem))
            return

        job.state = "running"

        def on_progress(done: int) -> None:
            job.done = done

        try:
            judgement = self.judge.run(
                problem=problem,
                language=language,
                source=source,
                submission_id=job.submission_id,
                on_progress=on_progress,
                is_cancelled=lambda: job.cancelled,
            )
        except Cancelled:
            judgement = _cancelled_judgement(job, problem)
        except SandboxUnavailable as exc:
            # The sandbox died mid-judgement. IE, never scored against the
            # contestant (US-J2-02).
            log.error("sandbox unavailable while judging %s: %s", job.job_id, exc)
            judgement = _internal_error(job, problem, "sandbox became unavailable")
        except Exception as exc:  # noqa: BLE001 - a judge bug must not kill the worker
            log.exception("judging %s failed", job.job_id)
            judgement = _internal_error(job, problem, f"judge error: {type(exc).__name__}")

        self._finish(job, judgement)

    def _finish(self, job: Job, judgement: Judgement) -> None:
        job.result = judgement
        job.done = min(job.done, job.total) if job.total else 0
        job.state = "done"
        job.finished_at = time.monotonic()

    # --- expiry ------------------------------------------------------------

    def _sweep_expired(self) -> None:
        """Drop jobs finished longer ago than the TTL.

        Done inline rather than on a timer: it is a dictionary scan over a few
        hundred entries, and it removes a background thread from the design.
        """
        cutoff = time.monotonic() - settings.job_ttl_s
        with self._lock:
            expired = [
                job_id for job_id, job in self._jobs.items()
                if job.finished_at is not None and job.finished_at < cutoff
            ]
            for job_id in expired:
                del self._jobs[job_id]


def _cancelled_judgement(job: Job, problem: Problem) -> Judgement:
    """A cancelled job still completes -- the backend simply ignores the result."""
    return Judgement(
        submission_id=job.submission_id,
        verdict="IE",
        passed=job.done,
        total=problem.total,
        message="cancelled",
        problem_version=problem.version,
    )


def _internal_error(job: Job, problem: Problem, message: str) -> Judgement:
    return Judgement(
        submission_id=job.submission_id,
        verdict="IE",
        passed=job.done,
        total=problem.total,
        message="internal error while judging; this is not your fault",
        jury_detail=message,
        problem_version=problem.version,
    )
