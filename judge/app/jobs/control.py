"""The contract between the queue and the work it runs.

The queue defines it and the judging package implements it, so the queue can
schedule a task without knowing what a verdict is.
"""
from __future__ import annotations

from typing import Protocol

from pydantic import BaseModel

# How soon the backend should poll again, by job state.
POLL_QUEUED_MS = 500
POLL_RUNNING_MS = 1000


class Cancelled(Exception):
    """The job was cancelled; stop without producing a verdict."""


class JobControl(Protocol):
    """Progress out, cancellation in. A queued job implements this; a
    synchronous caller such as validation uses `UNWATCHED`."""

    @property
    def cancelled(self) -> bool: ...

    def report(self, done: int) -> None: ...


class _Unwatched:
    cancelled = False

    def report(self, done: int) -> None:
        pass


UNWATCHED: JobControl = _Unwatched()


class Task(Protocol):
    """A unit of work that knows how to run itself and how to describe its
    own failure in the result type its caller expects."""

    submission_id: str | None

    @property
    def steps(self) -> int:
        """How many progress steps `run` reports, for the poll response."""

    def run(self, control: JobControl) -> BaseModel: ...

    def failed(self, message: str) -> BaseModel:
        """The result when the worker could not finish: an internal error,
        never a verdict against anyone (US-J2-02)."""

    def cancelled(self) -> BaseModel:
        """The result of a cancelled job. It still completes, and the backend
        simply ignores what it says."""
