"""Running Python checkers and validators inside the sandbox (US-J3-03).

A buggy checker is a normal occurrence, so it gets the same treatment as
contestant code: its own time and memory limits, inside the sandbox, where it
can hang or crash without taking the judge with it.

The runtime files are uploaded to go-judge once and reused by fileId for the
rest of the contest, so a 10,000-testcase problem does not re-upload them
10,000 times (US-J3-02).
"""
from __future__ import annotations

import threading
from dataclasses import dataclass
from pathlib import Path

from . import gojudge
from .config import settings
from .gojudge import GoJudge
from .languages import SANDBOX_ENV
from .problems import Problem
from .storage import Storage

# Exit codes shared with checker_runtime.py.
EXIT_AC = 0
EXIT_WA = 1
EXIT_IE = 3

_RUNTIME_DIR = Path(__file__).parent


@dataclass
class CheckResult:
    verdict: str        # "AC", "WA" or "IE"
    detail: str = ""


class SandboxedPython:
    """Uploads the runtime files once, then runs them against test data.

    One instance is shared by the whole service. `_uploads` is guarded because
    judging happens on several worker threads at once.
    """

    def __init__(self, sandbox: GoJudge, storage: Storage):
        self.sandbox = sandbox
        self.storage = storage
        self._uploads: dict[str, str] = {}     # cache key -> go-judge fileId
        self._lock = threading.Lock()

    def _upload_once(self, cache_key: str, content: str) -> str:
        """Upload content unless we already have a fileId for this key."""
        with self._lock:
            file_id = self._uploads.get(cache_key)
            if file_id:
                return file_id
        # Uploading outside the lock keeps a slow sandbox from blocking every
        # thread. A rare duplicate upload is cheaper than serialising them.
        file_id = self.sandbox.upload(content)
        with self._lock:
            return self._uploads.setdefault(cache_key, file_id)

    def release_all(self) -> None:
        """Drop every cached upload. Called at shutdown."""
        with self._lock:
            file_ids = list(self._uploads.values())
            self._uploads.clear()
        for file_id in file_ids:
            self.sandbox.delete(file_id)

    def _runtime_file(self, name: str) -> dict:
        content = (_RUNTIME_DIR / name).read_text(encoding="utf-8")
        return {"fileId": self._upload_once(f"runtime:{name}", content)}

    def _problem_file(self, problem: Problem, key: str, cache_key: str) -> dict:
        content = self.storage.read_text(key)
        return {"fileId": self._upload_once(cache_key, content)}

    # --- checkers ----------------------------------------------------------

    def check(self, problem: Problem, input_text: str, output_text: str, answer_text: str) -> CheckResult:
        """Decide one testcase with the problem's checker.py."""
        if not self.storage.exists(problem.checker_key):
            return CheckResult("IE", f"{problem.problem_id} uses compare: checker but has no checker.py")

        copy_in = {
            "checker_runtime.py": self._runtime_file("checker_runtime.py"),
            "checker.py": self._problem_file(
                problem, problem.checker_key,
                f"checker:{problem.problem_id}:{problem.version}",
            ),
            "input.txt": {"content": input_text},
            "output.txt": {"content": output_text},
            "answer.txt": {"content": answer_text},
        }

        result = self.sandbox.run([gojudge.command(
            args=["/usr/bin/python3", "checker_runtime.py"],
            env=SANDBOX_ENV,
            time_limit_ms=settings.checker_time_limit_ms,
            memory_mb=settings.checker_memory_mb,
            copy_in=copy_in,
            stdout_max=65_536,
        )])[0]

        return self._interpret(result)

    @staticmethod
    def _interpret(result: gojudge.Result) -> CheckResult:
        """Map a checker's exit code onto a verdict.

        Anything other than a clean accept or reject is our fault, never the
        contestant's (US-J2-02).
        """
        message = (result.stderr or "").strip()

        # A checker reports its decision *through* the exit code, so a non-zero
        # exit is the normal way it says "wrong answer". go-judge calls that
        # "Nonzero Exit Status", which is not a failure here -- only a blown
        # limit or a kill is.
        if result.status not in ("Accepted", "Nonzero Exit Status"):
            return CheckResult("IE", f"checker {result.status.lower()}")
        if result.exit_status == EXIT_AC:
            return CheckResult("AC", message)
        if result.exit_status == EXIT_WA:
            return CheckResult("WA", message or "rejected by checker")
        return CheckResult("IE", f"checker failed (exit {result.exit_status}): {message}")

    def checker_loads(self, problem: Problem) -> tuple[bool, str]:
        """Import the checker with empty data, to prove it loads (US-J4-01).

        A checker that imports cleanly but rejects empty input is fine here --
        we are only looking for import and syntax errors.
        """
        if not self.storage.exists(problem.checker_key):
            return False, "checker.py not found"
        try:
            result = self.check(problem, "", "", "")
        except Exception as exc:
            return False, str(exc)
        if result.verdict == "IE" and "failed to load" in result.detail:
            return False, result.detail
        return True, result.detail

    # --- validators --------------------------------------------------------

    def validate_input(self, problem: Problem, input_text: str) -> tuple[bool, str]:
        """Run validator.py against one input file (US-J4-04)."""
        copy_in = {
            "checker_runtime.py": self._runtime_file("checker_runtime.py"),
            "validator_runtime.py": self._runtime_file("validator_runtime.py"),
            "validator.py": self._problem_file(
                problem, problem.validator_key,
                f"validator:{problem.problem_id}:{problem.version}",
            ),
            "input.txt": {"content": input_text},
        }

        result = self.sandbox.run([gojudge.command(
            args=["/usr/bin/python3", "validator_runtime.py"],
            env=SANDBOX_ENV,
            time_limit_ms=settings.checker_time_limit_ms,
            memory_mb=settings.checker_memory_mb,
            copy_in=copy_in,
            stdout_max=65_536,
        )])[0]

        message = (result.stderr or "").strip()
        # As with checkers, exit 1 is how the validator reports an invalid file,
        # not a sandbox failure.
        if result.status not in ("Accepted", "Nonzero Exit Status"):
            return False, f"validator {result.status.lower()}"
        return result.exit_status == 0, message

    # --- answer scoring (Phase 1) ------------------------------------------

    def score_entries(self, validator_source: str, entries: list[str]) -> tuple[list[dict] | None, str]:
        """Run a supplied validator over a list of answers (US-J7-03).

        Returns (results, message). `results` is None when the validator itself
        could not run -- the caller must report that as IE, never as "all
        invalid", or an administrator's typo would zero every participant.
        """
        import json

        copy_in = {
            "checker_runtime.py": self._runtime_file("checker_runtime.py"),
            "answers_runtime.py": self._runtime_file("answers_runtime.py"),
            "validator.py": {"content": validator_source},
            "entries.json": {"content": json.dumps(entries)},
        }

        result = self.sandbox.run([gojudge.command(
            args=["/usr/bin/python3", "answers_runtime.py"],
            env=SANDBOX_ENV,
            time_limit_ms=settings.checker_time_limit_ms,
            memory_mb=settings.checker_memory_mb,
            copy_in=copy_in,
            stdout_max=settings.max_input_bytes * 4,
        )])[0]

        message = (result.stderr or "").strip()
        if result.status not in ("Accepted", "Nonzero Exit Status"):
            return None, f"validator {result.status.lower()}"
        if result.exit_status != 0:
            return None, message or f"validator exited {result.exit_status}"
        try:
            return json.loads(result.stdout), message
        except json.JSONDecodeError:
            return None, "validator produced unreadable output"
