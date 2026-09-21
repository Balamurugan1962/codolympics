"""Client for the judge service (judge/openapi.yaml).

The judge is the only thing that runs code, and this module is the only thing
that talks to it. The judge trusts us through a shared bearer token.

A call either returns the judge's JSON or raises JudgeError. JudgeError is an
EngineError, so a route that lets it escape tells the caller the judge's own
reason ("no such problem: two-sum") instead of an anonymous 500.
"""

from __future__ import annotations

import contextlib
import time
from typing import Any
from urllib.parse import quote

import httpx

from engine.core import errors
from engine.core.config import settings

# Submit, hack and poll return at once; validation runs the reference over
# every testcase before answering, which can take minutes.
_TIMEOUT = httpx.Timeout(30.0, connect=3.0)
_VALIDATE_TIMEOUT = httpx.Timeout(600.0, connect=3.0)


_client = httpx.Client(
    base_url=settings.judge_url,
    headers={"Authorization": f"Bearer {settings.judge_token}"},
    timeout=_TIMEOUT,
)


class JudgeError(errors.EngineError):
    """A failure that came from the judge. `judge_status` is 0 when it was unreachable."""

    def __init__(self, judge_status: int, code: str, message: str):
        if judge_status == 0:
            status, api_code = 503, "judge_unavailable"
        elif judge_status == 404:
            status, api_code = 409, f"judge_{code}"
        elif 400 <= judge_status < 500:
            status, api_code = 400, f"judge_{code}"
        else:
            status, api_code = 502, f"judge_{code}"
        super().__init__(status, api_code, message)
        self.judge_status = judge_status


def _call(
    method: str,
    path: str,
    payload: Any = None,
    *,
    timeout: httpx.Timeout = _TIMEOUT,
) -> Any:
    try:
        res = _client.request(method, path, json=payload, timeout=timeout)
    except httpx.HTTPError:
        message = f"cannot reach the judge at {settings.judge_url}"
        raise JudgeError(0, "unreachable", message) from None
    if res.status_code == 204:
        return None
    try:
        data = res.json()
    except ValueError:
        data = {}
    if res.is_error:
        code = data.get("error", "error")
        message = data.get("message", res.reason_phrase)
        raise JudgeError(res.status_code, code, message)
    return data


def _version_query(version: str | None) -> str:
    return f"?version={quote(version)}" if version else ""


def health() -> dict:
    return _call("GET", "/health")


def languages() -> list[dict]:
    return _call("GET", "/languages")["languages"]


def problems() -> list[dict]:
    return _call("GET", "/problems")["problems"]


def problem(problem_id: str) -> dict:
    return _call("GET", f"/problems/{quote(problem_id)}")


def validate(problem_id: str, body: dict, version: str | None = None) -> dict:
    path = f"/problems/{quote(problem_id)}/validate{_version_query(version)}"
    return _call("POST", path, body, timeout=_VALIDATE_TIMEOUT)


def testcase(problem_id: str, index: int, version: str | None = None) -> dict:
    path = f"/problems/{quote(problem_id)}/testcases/{index}{_version_query(version)}"
    return _call("GET", path)


def submit(*, problem_id: str, language: str, source: str, submission_id: str) -> str:
    body = {
        "problem_id": problem_id,
        "language": language,
        "source": source,
        "submission_id": submission_id,
    }
    return _call("POST", "/submit", body)["job_id"]


def hack(
    *,
    problem_id: str,
    language: str,
    source: str,
    input: str,
    submission_id: str,
    version: str | None = None,
) -> str:
    body = {
        "problem_id": problem_id,
        "language": language,
        "source": source,
        "input": input,
        "submission_id": submission_id,
    }
    if version:
        body["version"] = version
    return _call("POST", "/hack", body)["job_id"]


def run(
    *,
    problem_id: str,
    language: str,
    source: str,
    samples: int,
    inputs: list[dict[str, str | None]],
    submission_id: str,
) -> str:
    """A practice run: the problem's first `samples` testcases, then `inputs`
    (`{"input", "answer"}` pairs, answer None when there is nothing to compare)."""
    body = {
        "problem_id": problem_id,
        "language": language,
        "source": source,
        "samples": samples,
        "inputs": inputs,
        "submission_id": submission_id,
    }
    return _call("POST", "/run", body)["job_id"]


def validate_answers(*, validator: str, entries: list[str], submission_id: str) -> str:
    body = {
        "validator": validator,
        "entries": entries,
        "submission_id": submission_id,
    }
    return _call("POST", "/validate-answers", body)["job_id"]


def job(job_id: str) -> dict:
    return _call("GET", f"/jobs/{quote(job_id)}")


def cancel(job_id: str) -> None:
    """Best effort: a job that already finished or expired needs no cancelling."""
    with contextlib.suppress(JudgeError):
        _call("DELETE", f"/jobs/{quote(job_id)}")


def wait_for_job(job_id: str, timeout_s: float = 60.0) -> dict:
    """Block until a job finishes. For authoring-time checks only, never a participant request."""
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        state = job(job_id)
        if state["state"] == "done" and state.get("result"):
            return state["result"]
        time.sleep((state.get("poll_after_ms") or 500) / 1000)
    raise errors.conflict("judge_timeout", "the judge did not finish in time")
