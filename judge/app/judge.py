"""Judging one submission: compile it once, then run it against every testcase.

This is the part Judge0 structurally cannot do, and the reason we drive
go-judge directly. The compiled artefact is cached inside the sandbox and
mounted into each run by id, so a 10,000-testcase problem costs one compile,
not ten thousand (US-J1-04).

Testcases run one at a time within a judgement. Several judgements run at once,
capped at the core count, which is what keeps measured times stable enough for
a time-based tiebreak (US-J2-05).
"""
from __future__ import annotations

import time
from typing import Callable

from . import compare, gojudge
from .checker import SandboxedPython
from .config import settings
from .gojudge import GoJudge
from .languages import Language
from .models import Judgement
from .problems import Problem, Testcase
from .storage import Storage

# go-judge status -> verdict. Anything not listed is treated as our fault.
_STATUS_TO_VERDICT = {
    "Time Limit Exceeded": "TLE",
    "Memory Limit Exceeded": "MLE",
    "Output Limit Exceeded": "OLE",
    "Nonzero Exit Status": "RE",
    "Signalled": "RE",
}


class Cancelled(Exception):
    """The job was cancelled; stop without producing a verdict."""


class Judge:
    def __init__(self, sandbox: GoJudge, storage: Storage, python: SandboxedPython):
        self.sandbox = sandbox
        self.storage = storage
        self.python = python

    def run(
        self,
        problem: Problem,
        language: Language,
        source: str,
        submission_id: str | None = None,
        on_progress: Callable[[int], None] | None = None,
        is_cancelled: Callable[[], bool] | None = None,
        run_all: bool = False,
    ) -> Judgement:
        """Judge a submission and return its verdict.

        `run_all` ignores the problem's early_exit, which validation uses to
        run a reference solution over every testcase (US-J4-02).
        """
        started = time.monotonic()
        cached_file_ids: list[str] = []

        def elapsed_ms() -> int:
            return int((time.monotonic() - started) * 1000)

        try:
            prepared, compile_output = self._prepare(language, source)
            if prepared is None:
                return Judgement(
                    submission_id=submission_id,
                    verdict="CE",
                    passed=0,
                    total=problem.total,
                    compile_output=compile_output,
                    message="compilation failed",
                    problem_version=problem.version,
                    duration_ms=elapsed_ms(),
                )
            cached_file_ids = [entry["fileId"] for entry in prepared.values()]

            return self._run_testcases(
                problem=problem,
                language=language,
                prepared=prepared,
                compile_output=compile_output,
                submission_id=submission_id,
                on_progress=on_progress,
                is_cancelled=is_cancelled,
                run_all=run_all,
                elapsed_ms=elapsed_ms,
            )
        finally:
            # Whatever happened -- verdict, exception or cancellation -- the
            # sandbox must not keep the artefact (US-J1-04).
            for file_id in cached_file_ids:
                self.sandbox.delete(file_id)

    def run_single(
        self,
        problem: Problem,
        language: Language,
        source: str,
        input_text: str,
        answer_text: str | None,
    ) -> "SingleRun":
        """Run one source against one input supplied by the caller.

        With `answer_text`, the output is compared and a verdict produced. Without
        it, an accepted run reports AC and carries its stdout -- which is how a
        reference solution's answer is obtained. Used by /hack (US-J7-01).
        """
        cached_file_ids: list[str] = []
        try:
            prepared, compile_output = self._prepare(language, source)
            if prepared is None:
                return SingleRun("CE", compile_output, "")
            cached_file_ids = [entry["fileId"] for entry in prepared.values()]
            outcome = self._execute(problem, language, prepared, input_text, answer_text)
            return SingleRun(outcome.verdict, outcome.detail, outcome.stdout, outcome.time_ms, outcome.memory_kb)
        finally:
            for file_id in cached_file_ids:
                self.sandbox.delete(file_id)

    # --- step one: get something runnable ---------------------------------

    def _prepare(self, language: Language, source: str) -> tuple[dict[str, dict] | None, str]:
        """Compile, or upload the source for an interpreted language.

        Returns the copyIn mapping for every run, plus compiler output. A None
        mapping means compilation failed.
        """
        if not language.compiled:
            file_id = self.sandbox.upload(source)
            return {language.source_name: {"fileId": file_id}}, ""

        result = self.sandbox.run([gojudge.command(
            args=language.compile_args,
            env=language.env,
            time_limit_ms=language.compile_time_limit_ms,
            memory_mb=language.compile_memory_mb,
            copy_in={language.source_name: {"content": source}},
            cache_outputs=language.artefacts,
            stdout_max=settings.compile_output_bytes,
        )])[0]

        output = _truncate(
            (result.stdout + result.stderr).strip(), settings.compile_output_bytes
        )

        missing = [name for name in language.artefacts if name not in result.file_ids]
        if not result.accepted or result.exit_status != 0 or missing:
            # Release anything that was produced before the failure.
            for file_id in result.file_ids.values():
                self.sandbox.delete(file_id)
            return None, output or f"compiler {result.status.lower()}"

        return {name: {"fileId": result.file_ids[name]} for name in language.artefacts}, output

    # --- step two: run it against the testcases ---------------------------

    def _run_testcases(
        self,
        *,
        problem: Problem,
        language: Language,
        prepared: dict[str, dict],
        compile_output: str,
        submission_id: str | None,
        on_progress: Callable[[int], None] | None,
        is_cancelled: Callable[[], bool] | None,
        run_all: bool,
        elapsed_ms: Callable[[], int],
    ) -> Judgement:
        passed = 0
        first_fail: int | None = None
        verdict = "AC"
        message = "all testcases passed"
        jury_detail = ""
        max_time_ms = 0.0
        max_memory_kb = 0
        stop_early = problem.early_exit and not run_all

        for testcase in problem.testcases:
            if is_cancelled and is_cancelled():
                raise Cancelled()

            outcome = self._run_one(problem, language, prepared, testcase)
            max_time_ms = max(max_time_ms, outcome.time_ms)
            max_memory_kb = max(max_memory_kb, outcome.memory_kb)

            if outcome.verdict == "AC":
                passed += 1
            elif first_fail is None:
                first_fail = testcase.index
                verdict = outcome.verdict
                message = _message_for(outcome.verdict, testcase.index)
                jury_detail = outcome.detail
                if stop_early:
                    if on_progress:
                        on_progress(testcase.index + 1)
                    break

            if on_progress:
                on_progress(testcase.index + 1)

        if problem.total == 0:
            verdict, message = "IE", "problem has no testcases"

        return Judgement(
            submission_id=submission_id,
            verdict=verdict,
            passed=passed,
            total=problem.total,
            first_fail=first_fail,
            max_time_ms=round(max_time_ms, 1),
            max_memory_kb=max_memory_kb,
            compile_output=compile_output,
            message=message,
            jury_detail=jury_detail,
            problem_version=problem.version,
            duration_ms=elapsed_ms(),
        )

    def _run_one(
        self, problem: Problem, language: Language, prepared: dict[str, dict], testcase: Testcase
    ) -> "_Outcome":
        """Execute one stored testcase and decide its verdict."""
        try:
            input_text = self.storage.read_text(testcase.input_key)
            answer_text = self.storage.read_text(testcase.answer_key)
        except (OSError, UnicodeDecodeError) as exc:
            # Unreadable test data is our problem, never the contestant's.
            return _Outcome("IE", f"cannot read testcase {testcase.index}: {exc}")
        return self._execute(problem, language, prepared, input_text, answer_text)

    def _execute(
        self,
        problem: Problem,
        language: Language,
        prepared: dict[str, dict],
        input_text: str,
        answer_text: str | None,
    ) -> "_Outcome":
        """Run the prepared artefact on one input and decide the verdict.

        `answer_text` of None means "just run it": an accepted run is AC and the
        outcome carries its stdout.
        """
        result = self.sandbox.run([gojudge.command(
            args=language.run_args,
            env=language.env,
            stdin=input_text,
            time_limit_ms=problem.time_limit_ms,
            memory_mb=problem.memory_limit_mb,
            copy_in=prepared,
        )])[0]

        if not result.accepted:
            return _Outcome(
                _verdict_for(result, problem.memory_limit_mb),
                _runtime_detail(result),
                result.time_ms,
                result.memory_kb,
            )

        if answer_text is None:
            return _Outcome("AC", "", result.time_ms, result.memory_kb, result.stdout)

        if problem.compare == "checker":
            checked = self.python.check(problem, input_text, result.stdout, answer_text)
            return _Outcome(checked.verdict, checked.detail, result.time_ms, result.memory_kb, result.stdout)

        comparison = compare.compare(
            problem.compare, result.stdout, answer_text, problem.float_tolerance
        )
        return _Outcome(
            "AC" if comparison.ok else "WA",
            comparison.detail,
            result.time_ms,
            result.memory_kb,
            result.stdout,
        )


class _Outcome:
    """One run's result, before it is folded into a judgement."""

    __slots__ = ("verdict", "detail", "time_ms", "memory_kb", "stdout")

    def __init__(self, verdict: str, detail: str = "", time_ms: float = 0.0,
                 memory_kb: int = 0, stdout: str = ""):
        self.verdict = verdict
        self.detail = detail
        self.time_ms = time_ms
        self.memory_kb = memory_kb
        self.stdout = stdout


class SingleRun:
    """Result of run_single: a verdict, plus stdout when the run was accepted."""

    __slots__ = ("verdict", "detail", "stdout", "time_ms", "memory_kb")

    def __init__(self, verdict: str, detail: str = "", stdout: str = "",
                 time_ms: float = 0.0, memory_kb: int = 0):
        self.verdict = verdict
        self.detail = detail
        self.stdout = stdout
        self.time_ms = time_ms
        self.memory_kb = memory_kb


def _verdict_for(result: gojudge.Result, memory_limit_mb: int) -> str:
    """Translate a sandbox status into a verdict.

    The memory check comes first because an out-of-memory process is often
    reported as a signal rather than as MLE, and calling that a runtime error
    would be misleading.
    """
    if result.memory_kb >= memory_limit_mb * 1024:
        return "MLE"
    return _STATUS_TO_VERDICT.get(result.status, "IE")


# Noise some runtimes emit on every single run. It is not the contestant's
# output and would otherwise appear in the diagnostics for every PyPy error.
_STDERR_NOISE = (
    "Warning: cannot find your CPU L2 & L3 cache size",
)


def _clean_stderr(stderr: str) -> str:
    """Drop known runtime chatter so a real error is not buried in it."""
    lines = [
        line for line in (stderr or "").splitlines()
        if not any(noise in line for noise in _STDERR_NOISE)
    ]
    return "\n".join(lines).strip()


def _runtime_detail(result: gojudge.Result) -> str:
    stderr = _truncate(_clean_stderr(result.stderr), 500)
    if result.status == "Signalled":
        return f"killed by a signal (exit {result.exit_status}). {stderr}".strip()
    return f"{result.status} (exit {result.exit_status}). {stderr}".strip()


def _message_for(verdict: str, index: int) -> str:
    """Human summary, safe to show a contestant -- names the test, never its data."""
    wording = {
        "WA": "wrong answer",
        "TLE": "time limit exceeded",
        "MLE": "memory limit exceeded",
        "OLE": "output limit exceeded",
        "RE": "runtime error",
        "IE": "internal error",
    }.get(verdict, verdict.lower())
    if verdict == "IE":
        return "internal error while judging; this is not your fault"
    return f"{wording} on test {index}"


def _truncate(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    return text[:limit] + "\n... (truncated)"
