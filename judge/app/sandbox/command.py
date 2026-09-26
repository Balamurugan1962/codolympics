"""Building one go-judge command.

Kept as a plain function returning a dict so the payload we send stays obvious
when debugging against the go-judge API docs. Every duration in that API is
nanoseconds.
"""
from __future__ import annotations

from dataclasses import dataclass

NS_PER_MS = 1_000_000
STDERR_BYTES = 65_536


@dataclass(frozen=True)
class Limits:
    """What one command may use. Wall-clock is derived: double the CPU budget,
    so a program that blocks or sleeps is still caught without failing one
    that merely gets descheduled under load. A caller that knows better, such
    as the compiler, which is CPU-bound and slows several times over when many
    compile at once, sets `clock_ms` itself."""

    time_ms: int
    memory_mb: int
    stdout_bytes: int
    processes: int = 64
    clock_ms: int | None = None


def build(
    *,
    args: list[str],
    env: list[str],
    limits: Limits,
    stdin: str = "",
    copy_in: dict[str, dict] | None = None,
    cache_outputs: list[str] | None = None,
) -> dict:
    return {
        "args": args,
        "env": env,
        "files": [
            {"content": stdin},
            {"name": "stdout", "max": limits.stdout_bytes},
            {"name": "stderr", "max": STDERR_BYTES},
        ],
        "cpuLimit": limits.time_ms * NS_PER_MS,
        "clockLimit": (limits.clock_ms or limits.time_ms * 2) * NS_PER_MS,
        "memoryLimit": limits.memory_mb * 1024 * 1024,
        "procLimit": limits.processes,
        "copyIn": copy_in or {},
        "copyOutCached": cache_outputs or [],
    }
