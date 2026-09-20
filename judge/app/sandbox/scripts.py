"""Running problem setters' Python inside the sandbox (US-J3-03).

Checkers, input validators and answer validators are all the same shape: a
runtime script of ours, the setter's file beside it, some data files, one run
under the checker limits, and a decision read back from the exit code. A buggy
checker is a normal occurrence, so it gets the same treatment as contestant
code: its own limits, inside the sandbox, where it can hang or crash without
taking the judge with it.

Files are uploaded to go-judge once and reused by fileId for the rest of the
contest, so a 10,000-testcase problem does not re-upload its checker 10,000
times (US-J3-02). This class knows nothing about where a setter's file comes
from: it is handed a `SetterFile` and reads it only on a cache miss.
"""
from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Callable

from app.core.comparison import Comparison, accepted, rejected
from app.core.languages import SANDBOX_ENV
from app.core.problem import SetterFile
from app.sandbox import command
from app.sandbox.client import Result, Sandbox
from app.sandbox.command import Limits
from app.sandbox.runtime.checker_runtime import EXIT_AC, EXIT_WA

RUNTIME_DIR = Path(__file__).parent / "runtime"
READER = "checker_runtime.py"       # every script imports its Reader from here
PYTHON = "/usr/bin/python3"


class SandboxedPython:
    """Uploads the runtime files once, then runs them against test data.

    One instance is shared by the whole service. `_uploads` is guarded because
    judging happens on several worker threads at once.
    """

    def __init__(self, sandbox: Sandbox, limits: Limits, answers_limits: Limits):
        self.sandbox = sandbox
        self.limits = limits
        self.answers_limits = answers_limits
        self._uploads: dict[str, str] = {}     # cache key -> go-judge fileId
        self._lock = threading.Lock()

    # --- checkers ----------------------------------------------------------

    def check(self, checker: SetterFile, input_text: str, output_text: str, answer_text: str) -> Comparison:
        """Decide one testcase with the problem's checker.py."""
        result = self._run_script(READER, {
            "checker.py": self._cached(checker.name, checker.read),
            "input.txt": {"content": input_text},
            "output.txt": {"content": output_text},
            "answer.txt": {"content": answer_text},
        })
        return self.interpret_checker(result)

    @staticmethod
    def interpret_checker(result: Result) -> Comparison:
        """Map a checker's exit code onto a verdict.

        A checker reports its decision *through* the exit code, so a non-zero
        exit is the normal way it says "wrong answer". Only a blown limit or a
        kill is a failure, and anything other than a clean accept or reject is
        our fault, never the contestant's (US-J2-02).
        """
        message = result.stderr.strip()
        if not result.exited:
            return Comparison("IE", result.stopped_by("checker"))
        if result.exit_status == EXIT_AC:
            return accepted(message)
        if result.exit_status == EXIT_WA:
            return rejected(message or "rejected by checker")
        return Comparison("IE", f"checker failed (exit {result.exit_status}): {message}")

    def checker_loads(self, checker: SetterFile) -> tuple[bool, str]:
        """Import the checker with empty data, to prove it loads (US-J4-01).

        A checker that imports cleanly but rejects empty input is fine here;
        we are only looking for import and syntax errors.
        """
        try:
            result = self.check(checker, "", "", "")
        except Exception as exc:
            return False, str(exc)
        if result.verdict == "IE" and "failed to load" in result.detail:
            return False, result.detail
        return True, result.detail

    # --- validators --------------------------------------------------------

    def validate_input(self, validator: SetterFile, input_text: str) -> tuple[bool, str]:
        """Run validator.py against one input file (US-J4-04)."""
        result = self._run_script("validator_runtime.py", {
            "validator.py": self._cached(validator.name, validator.read),
            "input.txt": {"content": input_text},
        })
        # As with checkers, exit 1 is how the validator reports an invalid
        # file, not a sandbox failure.
        if not result.exited:
            return False, result.stopped_by("validator")
        return result.exit_status == 0, result.stderr.strip()

    # --- answer scoring (Phase 1) ------------------------------------------

    def score_entries(self, validator_source: str, entries: list[str]) -> tuple[list[dict] | None, str]:
        """Run a supplied validator over a list of answers (US-J7-03).

        Returns (results, message). `results` is None when the validator
        itself could not run; the caller must report that as IE, never as
        "all invalid", or an administrator's typo would zero every participant.
        """
        result = self._run_script("answers_runtime.py", {
            "validator.py": {"content": validator_source},
            "entries.json": {"content": json.dumps(entries)},
        }, self.answers_limits)
        message = result.stderr.strip()
        if not result.exited:
            return None, result.stopped_by("validator")
        if result.exit_status != 0:
            return None, message or f"validator exited {result.exit_status}"
        try:
            return json.loads(result.stdout), message
        except json.JSONDecodeError:
            return None, "validator produced unreadable output"

    # --- one way to run any of them ----------------------------------------

    def _run_script(self, script: str, files: dict[str, dict], limits: Limits | None = None) -> Result:
        """Run one of our runtime scripts with the given files beside it."""
        copy_in = {name: self._runtime_file(name) for name in {READER, script}}
        copy_in.update(files)
        return self.sandbox.run([command.build(
            args=[PYTHON, script], env=SANDBOX_ENV, limits=limits or self.limits, copy_in=copy_in,
        )])[0]

    # --- the upload cache --------------------------------------------------

    def _runtime_file(self, name: str) -> dict:
        return self._cached(f"runtime:{name}", lambda: (RUNTIME_DIR / name).read_text(encoding="utf-8"))

    def _cached(self, cache_key: str, read: Callable[[], str]) -> dict:
        """A copyIn entry for content that is read and uploaded at most once."""
        with self._lock:
            file_id = self._uploads.get(cache_key)
        if file_id is None:
            # Reading and uploading outside the lock keeps a slow sandbox from
            # blocking every thread. A rare duplicate upload is cheaper than
            # serialising them.
            file_id = self.sandbox.upload(read())
            with self._lock:
                file_id = self._uploads.setdefault(cache_key, file_id)
        return {"fileId": file_id}

    def release_all(self) -> None:
        """Drop every cached upload. Called at shutdown."""
        with self._lock:
            file_ids = list(self._uploads.values())
            self._uploads.clear()
        for file_id in file_ids:
            self.sandbox.delete(file_id)
