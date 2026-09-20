"""Scoring a list of entries with a supplied validator (US-J7-03)."""
from __future__ import annotations

from app.core.results import AnswersResult, EntryResult
from app.core.timing import Stopwatch
from app.sandbox.scripts import SandboxedPython


def internal_error(submission_id: str | None, message: str, duration_ms: int = 0) -> AnswersResult:
    """The validator itself failed and nothing was checked. The caller must
    never read this as every entry being invalid."""
    return AnswersResult(submission_id=submission_id, status="IE", message=message, duration_ms=duration_ms)


class AnswerScorer:
    def __init__(self, python: SandboxedPython):
        self.python = python

    def score(self, validator: str, entries: list[str], submission_id: str | None = None) -> AnswersResult:
        watch = Stopwatch()
        results, message = self.python.score_entries(validator, entries)
        if results is None:
            return internal_error(submission_id, message, watch.elapsed_ms())
        return AnswersResult(
            submission_id=submission_id,
            status="ok",
            results=[EntryResult(valid=bool(r.get("valid")), error=r.get("error")) for r in results],
            message=message,
            duration_ms=watch.elapsed_ms(),
        )
