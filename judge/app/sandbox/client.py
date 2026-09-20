"""Thin client for the go-judge REST API.

go-judge is the sandbox. It runs one command under limits and reports what
happened. It knows nothing about problems, testcases or verdicts; that is the
judging package's job.

The feature the whole design rests on is the file cache: a command can write a
file, go-judge keeps it server-side and returns a fileId, and later commands
mount it by that id. That is how we compile once and run many (US-J1-04).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

import httpx

from app.sandbox.command import NS_PER_MS


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

        This says nothing about whether the output was *correct*; that is a
        comparator's decision.
        """
        return self.status == "Accepted"

    @property
    def exited(self) -> bool:
        """The command ran and returned an exit code of its own choosing, as
        opposed to being stopped by a limit or a signal. Scripts that report
        through their exit code are read this way."""
        return self.status in ("Accepted", "Nonzero Exit Status")

    def stopped_by(self, what: str) -> str:
        """How to say that `what` (a checker, a compiler) hit a limit."""
        return f"{what} {self.status.lower()}"

    @classmethod
    def from_json(cls, d: dict) -> Result:
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


class Sandbox(Protocol):
    """What the rest of the service needs from a sandbox. The test suite's fake
    implements exactly this."""

    url: str

    def reachable(self) -> bool: ...
    def run(self, commands: list[dict]) -> list[Result]: ...
    def upload(self, content: str | bytes) -> str: ...
    def delete(self, file_id: str) -> None: ...
    def close(self) -> None: ...


class GoJudge:
    """Synchronous client. Judging runs in worker threads, so sync is simpler."""

    def __init__(self, url: str, timeout_s: float):
        self.url = url.rstrip("/")
        self._client = httpx.Client(base_url=self.url, timeout=timeout_s)

    def close(self) -> None:
        self._client.close()

    def reachable(self) -> bool:
        """For the health endpoint. Never raises."""
        try:
            return self._client.get("/version", timeout=2.0).status_code == 200
        except httpx.HTTPError:
            return False

    def run(self, commands: list[dict]) -> list[Result]:
        response = self._post("/run", json={"cmd": commands})
        return [Result.from_json(item) for item in response.json()]

    def upload(self, content: str | bytes) -> str:
        """Store a file server-side and return its fileId."""
        if isinstance(content, str):
            content = content.encode()
        return self._post("/file", files={"file": ("f", content)}).json()

    def delete(self, file_id: str) -> None:
        """Release a cached artefact.

        Skipping this leaks memory inside go-judge, so callers do it in a
        finally block. A failure here is never worth failing a judgement over.
        """
        try:
            self._client.delete(f"/file/{file_id}")
        except httpx.HTTPError:
            pass

    def _post(self, path: str, **payload) -> httpx.Response:
        try:
            response = self._client.post(path, **payload)
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise SandboxUnavailable(f"cannot reach go-judge at {self.url}: {exc}") from exc
        return response
