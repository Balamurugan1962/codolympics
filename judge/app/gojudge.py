"""Thin client for the go-judge REST API.

go-judge is the sandbox. It runs one command under limits and reports what
happened. It knows nothing about problems, testcases or verdicts -- that is
judge.py's job.

The feature the whole design rests on is the file cache: a command can write a
file, go-judge keeps it server-side and returns a fileId, and later commands
mount it by that id. That is how we compile once and run many (US-J1-04).

Every duration in the go-judge API is nanoseconds.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import httpx

from .config import settings

NS_PER_MS = 1_000_000


class SandboxUnavailable(RuntimeError):
    """go-judge could not be reached. Never the contestant's fault."""


@dataclass
class Result:
    status: str          # "Accepted", "Time Limit Exceeded", "Signalled", ...
    exit_status: int
    time_ms: float       # CPU time
    run_time_ms: float   # wall clock
    memory_kb: int
    stdout: str
    stderr: str
    file_ids: dict[str, str] = field(default_factory=dict)

    @property
    def accepted(self) -> bool:
        """The command ran to completion within its limits.

        This says nothing about whether the output was *correct* -- that is
        compare.py's decision.
        """
        return self.status == "Accepted"

    @classmethod
    def from_json(cls, d: dict) -> "Result":
        files = d.get("files") or {}
        return cls(
            status=d.get("status", "Internal Error"),
            exit_status=d.get("exitStatus", -1),
            time_ms=d.get("time", 0) / NS_PER_MS,
            run_time_ms=d.get("runTime", 0) / NS_PER_MS,
            memory_kb=d.get("memory", 0) // 1024,
            stdout=files.get("stdout", ""),
            stderr=files.get("stderr", ""),
            file_ids=d.get("fileIds") or {},
        )


def command(
    *,
    args: list[str],
    env: list[str],
    stdin: str = "",
    time_limit_ms: int,
    memory_mb: int,
    copy_in: dict[str, dict] | None = None,
    cache_outputs: list[str] | None = None,
    proc_limit: int = 64,
    stdout_max: int | None = None,
) -> dict:
    """Build one go-judge command.

    Kept as a plain function returning a dict so the payload we send stays
    obvious when debugging against the go-judge API docs.
    """
    limit = stdout_max if stdout_max is not None else settings.output_limit_mb * 1024 * 1024
    return {
        "args": args,
        "env": env,
        "files": [
            {"content": stdin},
            {"name": "stdout", "max": limit},
            {"name": "stderr", "max": 65_536},
        ],
        "cpuLimit": time_limit_ms * NS_PER_MS,
        # Wall-clock gets double the CPU budget so a program that blocks or
        # sleeps is still caught, without failing one that merely gets
        # descheduled under load.
        "clockLimit": time_limit_ms * 2 * NS_PER_MS,
        "memoryLimit": memory_mb * 1024 * 1024,
        "procLimit": proc_limit,
        "copyIn": copy_in or {},
        "copyOutCached": cache_outputs or [],
    }


class GoJudge:
    """Synchronous client. Judging runs in worker threads, so sync is simpler."""

    def __init__(self, url: str | None = None, timeout_s: float | None = None):
        self.url = (url or settings.go_judge_url).rstrip("/")
        self._client = httpx.Client(
            base_url=self.url,
            timeout=timeout_s or settings.go_judge_timeout_s,
        )

    def close(self) -> None:
        self._client.close()

    def reachable(self) -> bool:
        """For the health endpoint. Never raises."""
        try:
            return self._client.get("/version", timeout=2.0).status_code == 200
        except httpx.HTTPError:
            return False

    def run(self, commands: list[dict]) -> list[Result]:
        try:
            response = self._client.post("/run", json={"cmd": commands})
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise SandboxUnavailable(f"cannot reach go-judge at {self.url}: {exc}") from exc
        return [Result.from_json(item) for item in response.json()]

    def upload(self, content: str | bytes) -> str:
        """Store a file server-side and return its fileId."""
        if isinstance(content, str):
            content = content.encode()
        try:
            response = self._client.post("/file", files={"file": ("f", content)})
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise SandboxUnavailable(f"cannot reach go-judge at {self.url}: {exc}") from exc
        return response.json()

    def delete(self, file_id: str) -> None:
        """Release a cached artefact.

        Skipping this leaks memory inside go-judge, so callers do it in a
        finally block. A failure here is never worth failing a judgement over.
        """
        try:
            self._client.delete(f"/file/{file_id}")
        except httpx.HTTPError:
            pass
