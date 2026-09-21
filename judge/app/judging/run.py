"""A practice run: the participant's code on inputs they can already see.

The samples in a statement, or an input they typed. Compiled once and run
on each input under the problem's real limits, exactly as a submission would
be, so "it passed the samples" means what they think it means. Nothing is
scored and no hidden testcase is touched.

What comes back is the program's own output, its stderr and a verdict per
input. For a sample the verdict compares against the published answer; for a
custom input there is nothing to compare with, so AC only means it ran.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.core.problem import Problem, ProblemBroken
from app.core.results import RunOutput, RunResult
from app.core.timing import Stopwatch
from app.core.verdict import INTERNAL_ERROR_MESSAGE, RunOutcome, Verdict, truncate
from app.jobs.control import Cancelled, JobControl
from app.judging.judge import Judge, Submission
from app.problems.store import ProblemStore

# Enough to read a wrong answer, small enough to ship in a poll response.
OUTPUT_KEEP = 16 * 1024


@dataclass(frozen=True)
class RunInput:
    input: str
    answer: str | None = None       # None: nothing to compare against


def internal_error(submission: Submission, message: str) -> RunResult:
    return _result(submission, "IE", f"{INTERNAL_ERROR_MESSAGE}: {message}")


class Runner:
    def __init__(self, judge: Judge, store: ProblemStore):
        self.judge = judge
        self.store = store

    def samples(self, problem: Problem, count: int) -> list[RunInput]:
        """The first `count` stored testcases: the ones the statement shows."""
        try:
            return [RunInput(*self.store.read_testcase(t)) for t in problem.testcases[:count]]
        except ProblemBroken as exc:
            raise ProblemBroken(f"a sample of {problem.problem_id} cannot be read: {exc}") from exc

    def run(self, submission: Submission, inputs: list[RunInput], control: JobControl) -> RunResult:
        watch = Stopwatch()
        with self.judge.compiler.prepare(submission.language, submission.source) as program:
            if not program.ok:
                return _result(submission, "CE", "compilation failed", watch, compile_output=program.compile_output)
            comparator = self.judge.comparator(submission.problem)
            outputs = []
            for n, case in enumerate(inputs, start=1):
                if control.cancelled:
                    raise Cancelled()
                outputs.append(_output(self.judge.execute(submission, program, comparator, case.input, case.answer)))
                control.report(n)
        return _result(submission, _overall(outputs), _summary(outputs), watch, outputs=outputs)


def _result(submission: Submission, verdict: Verdict, message: str, watch: Stopwatch | None = None, **fields) -> RunResult:
    return RunResult(
        submission_id=submission.submission_id,
        verdict=verdict,
        message=message,
        problem_version=submission.problem.version,
        duration_ms=watch.elapsed_ms() if watch else 0,
        **fields,
    )


def _output(outcome: RunOutcome) -> RunOutput:
    return RunOutput(
        verdict=outcome.verdict,
        stdout=truncate(outcome.stdout, OUTPUT_KEEP),
        stderr=truncate(outcome.stderr, OUTPUT_KEEP),
        time_ms=round(outcome.time_ms, 1),
        memory_kb=outcome.memory_kb,
    )


def _overall(outputs: list[RunOutput]) -> Verdict:
    """The first thing that went wrong, or AC when nothing did."""
    return next((o.verdict for o in outputs if o.verdict != "AC"), "AC")


def _summary(outputs: list[RunOutput]) -> str:
    failed = sum(1 for o in outputs if o.verdict != "AC")
    if failed == 0:
        return f"{len(outputs)} of {len(outputs)} ran"
    return f"{failed} of {len(outputs)} failed"
