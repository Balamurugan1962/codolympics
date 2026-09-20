"""Judging one submission: compile it once, then run it against every testcase.

This is the part Judge0 structurally cannot do, and the reason we drive
go-judge directly. Testcases run one at a time within a judgement. Several
judgements run at once, capped at the core count, which is what keeps measured
times stable enough for a time-based tiebreak (US-J2-05).
"""
from __future__ import annotations

from dataclasses import dataclass

from app.core import comparison
from app.core.comparison import Comparator, Comparison
from app.core.languages import Language
from app.core.problem import Problem, ProblemBroken, SetterFile, Testcase
from app.core.results import Judgement
from app.core.timing import Stopwatch
from app.core.verdict import (
    INTERNAL_ERROR_MESSAGE,
    RunOutcome,
    Verdict,
    failure_detail,
    message_for,
    verdict_for_failure,
)
from app.jobs.control import UNWATCHED, Cancelled, JobControl
from app.judging.program import Compiler, Program
from app.problems.store import ProblemStore
from app.sandbox import command
from app.sandbox.client import Result, Sandbox
from app.sandbox.command import Limits
from app.sandbox.scripts import SandboxedPython


@dataclass(frozen=True)
class Submission:
    """One piece of source against one problem."""

    problem: Problem
    language: Language
    source: str
    submission_id: str | None = None

    def judgement(self, verdict: Verdict, message: str, **fields) -> Judgement:
        """A judgement of this submission; the caller fills in what it knows."""
        return Judgement(
            submission_id=self.submission_id,
            verdict=verdict,
            message=message,
            total=self.problem.total,
            problem_version=self.problem.version,
            **fields,
        )

    def internal_error(self, jury_detail: str) -> Judgement:
        """An IE judgement: never scored against anyone (US-J2-02)."""
        return self.judgement("IE", INTERNAL_ERROR_MESSAGE, passed=0, jury_detail=jury_detail)


class CheckerComparator:
    """The fifth compare mode: the problem's own checker.py, run in the sandbox."""

    def __init__(self, python: SandboxedPython, checker: SetterFile | None, problem_id: str):
        self.python = python
        self.checker = checker
        self.problem_id = problem_id

    def compare(self, input_text: str, output: str, answer: str) -> Comparison:
        if self.checker is None:
            return Comparison("IE", f"{self.problem_id} uses compare: checker but has no checker.py")
        return self.python.check(self.checker, input_text, output, answer)


class Judge:
    def __init__(
        self,
        sandbox: Sandbox,
        store: ProblemStore,
        compiler: Compiler,
        python: SandboxedPython,
        output_limit_bytes: int,
    ):
        self.sandbox = sandbox
        self.store = store
        self.compiler = compiler
        self.python = python
        self.output_limit_bytes = output_limit_bytes

    def run(self, submission: Submission, control: JobControl = UNWATCHED, *, run_all: bool = False) -> Judgement:
        """Judge a submission against its problem's stored testcases.

        `run_all` ignores the problem's early_exit, which validation uses to
        run a reference solution over every testcase (US-J4-02).
        """
        watch = Stopwatch()
        with self.compiler.prepare(submission.language, submission.source) as program:
            if not program.ok:
                tally = Tally.compile_error()
            else:
                tally = self._run_testcases(submission, program, control, run_all)
        return submission.judgement(
            tally.verdict,
            tally.message,
            passed=tally.passed,
            first_fail=tally.first_fail,
            max_time_ms=round(tally.max_time_ms, 1),
            max_memory_kb=tally.max_memory_kb,
            compile_output=program.compile_output,
            jury_detail=tally.jury_detail,
            duration_ms=watch.elapsed_ms(),
        )

    def run_once(self, submission: Submission, input_text: str, answer_text: str | None = None) -> RunOutcome:
        """Run the source against one input supplied by the caller.

        With `answer_text`, the output is compared and a verdict produced.
        Without it, an accepted run reports AC and carries its stdout, which
        is how a reference solution's answer is obtained. Used by /hack.
        """
        with self.compiler.prepare(submission.language, submission.source) as program:
            if not program.ok:
                return RunOutcome("CE", program.compile_output)
            return self._execute(submission, program, self._comparator(submission.problem), input_text, answer_text)

    # --- the testcase loop -------------------------------------------------

    def _run_testcases(self, submission: Submission, program: Program, control: JobControl, run_all: bool) -> Tally:
        problem = submission.problem
        comparator = self._comparator(problem)
        tally = Tally()
        stop_early = problem.early_exit and not run_all
        for testcase in problem.testcases:
            if control.cancelled:
                raise Cancelled()
            outcome = self._run_stored(submission, program, comparator, testcase)
            first_failure = tally.add(testcase.index, outcome)
            control.report(testcase.index + 1)
            if first_failure and stop_early:
                break
        if problem.total == 0:
            tally.verdict, tally.message = "IE", "problem has no testcases"
        return tally

    def _run_stored(
        self, submission: Submission, program: Program, comparator: Comparator, testcase: Testcase
    ) -> RunOutcome:
        try:
            input_text, answer_text = self.store.read_testcase(testcase)
        except ProblemBroken as exc:
            return RunOutcome("IE", str(exc))
        return self._execute(submission, program, comparator, input_text, answer_text)

    def _execute(
        self,
        submission: Submission,
        program: Program,
        comparator: Comparator,
        input_text: str,
        answer_text: str | None,
    ) -> RunOutcome:
        """Run the prepared program on one input and decide the verdict.

        `answer_text` of None means "just run it": an accepted run is AC and
        the outcome carries its stdout.
        """
        problem = submission.problem
        result = self.sandbox.run([command.build(
            args=submission.language.run_args,
            env=submission.language.env,
            stdin=input_text,
            limits=Limits(problem.time_limit_ms, problem.memory_limit_mb, self.output_limit_bytes),
            copy_in=program.copy_in,
        )])[0]
        if not result.accepted:
            return _failed(result, problem.memory_limit_mb)
        if answer_text is None:
            return _ran(result, comparison.accepted())
        return _ran(result, comparator.compare(input_text, result.stdout, answer_text))

    def _comparator(self, problem: Problem) -> Comparator:
        if problem.compare == "checker":
            return CheckerComparator(self.python, self.store.checker(problem), problem.problem_id)
        return comparison.for_mode(problem.compare, problem.float_tolerance)


@dataclass
class Tally:
    """A judgement being built up, one testcase at a time."""

    verdict: Verdict = "AC"
    message: str = "all testcases passed"
    passed: int = 0
    first_fail: int | None = None
    jury_detail: str = ""
    max_time_ms: float = 0.0
    max_memory_kb: int = 0

    @classmethod
    def compile_error(cls) -> Tally:
        return cls(verdict="CE", message="compilation failed")

    def add(self, index: int, outcome: RunOutcome) -> bool:
        """Fold one testcase in. True when this is the first failure."""
        self.max_time_ms = max(self.max_time_ms, outcome.time_ms)
        self.max_memory_kb = max(self.max_memory_kb, outcome.memory_kb)
        if outcome.accepted:
            self.passed += 1
            return False
        if self.first_fail is not None:
            return False
        self.first_fail = index
        self.verdict = outcome.verdict
        self.message = message_for(outcome.verdict, index)
        self.jury_detail = outcome.detail
        return True


def _failed(result: Result, memory_limit_mb: int) -> RunOutcome:
    return RunOutcome(
        verdict_for_failure(result.status, result.memory_kb, memory_limit_mb),
        failure_detail(result.status, result.exit_status, result.stderr),
        result.time_ms,
        result.memory_kb,
    )


def _ran(result: Result, decided: Comparison) -> RunOutcome:
    return RunOutcome(decided.verdict, decided.detail, result.time_ms, result.memory_kb, result.stdout)
