"""What a run's result means, and how it is described to people.

A verdict is decided from what the sandbox reported and what the comparison
said. Two audiences read the outcome: `detail` is for the jury and may name
the expected value, `message_for` is for the contestant and names the test
but never its data.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

Verdict = Literal["AC", "WA", "TLE", "MLE", "OLE", "RE", "CE", "IE"]

# go-judge status -> verdict. Anything not listed is treated as our fault.
_STATUS_TO_VERDICT: dict[str, Verdict] = {
    "Time Limit Exceeded": "TLE",
    "Memory Limit Exceeded": "MLE",
    "Output Limit Exceeded": "OLE",
    "Nonzero Exit Status": "RE",
    "Signalled": "RE",
}

_WORDING = {
    "WA": "wrong answer",
    "TLE": "time limit exceeded",
    "MLE": "memory limit exceeded",
    "OLE": "output limit exceeded",
    "RE": "runtime error",
}

# Noise some runtimes emit on every single run. It is not the contestant's
# output and would otherwise appear in the diagnostics for every PyPy error.
_STDERR_NOISE = ("Warning: cannot find your CPU L2 & L3 cache size",)

INTERNAL_ERROR_MESSAGE = "internal error while judging; this is not your fault"


@dataclass(frozen=True)
class RunOutcome:
    """One run of a program on one input, before it is folded into a judgement."""

    verdict: Verdict
    detail: str = ""        # jury only
    time_ms: float = 0.0
    memory_kb: int = 0
    stdout: str = ""        # kept so a reference run can supply the answer
    stderr: str = ""        # cleaned; shown to the author of a practice run

    @property
    def accepted(self) -> bool:
        return self.verdict == "AC"


def verdict_for_failure(status: str, memory_kb: int, memory_limit_mb: int) -> Verdict:
    """Translate a sandbox status into a verdict.

    The memory check comes first because an out-of-memory process is often
    reported as a signal rather than as MLE, and calling that a runtime error
    would be misleading.
    """
    if memory_kb >= memory_limit_mb * 1024:
        return "MLE"
    return _STATUS_TO_VERDICT.get(status, "IE")


def clean_stderr(stderr: str) -> str:
    """Drop known runtime chatter so a real error is not buried in it."""
    lines = [
        line for line in (stderr or "").splitlines()
        if not any(noise in line for noise in _STDERR_NOISE)
    ]
    return "\n".join(lines).strip()


def failure_detail(status: str, exit_status: int, stderr: str) -> str:
    stderr = truncate(clean_stderr(stderr), 500)
    if status == "Signalled":
        return f"killed by a signal (exit {exit_status}). {stderr}".strip()
    return f"{status} (exit {exit_status}). {stderr}".strip()


def wording(verdict: Verdict) -> str:
    """The verdict in words a contestant understands."""
    if verdict == "IE":
        return INTERNAL_ERROR_MESSAGE
    return _WORDING.get(verdict, verdict.lower())


def message_for(verdict: Verdict, index: int) -> str:
    """Human summary, safe to show a contestant: names the test, never its data."""
    if verdict == "IE":
        return INTERNAL_ERROR_MESSAGE
    return f"{wording(verdict)} on test {index}"


def truncate(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    return text[:limit] + "\n... (truncated)"
