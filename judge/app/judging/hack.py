"""Hacking: does this supplied input break the given solution? (US-J7-01)

Three runs in order, each able to stop the process:

  1. the problem's validator on the input   -> invalid input is not a hack
  2. the stored reference solution           -> the correct answer for this input
  3. the given solution, compared to (2)     -> hacked if it fails in any way

Anything wrong with the *problem* (no reference, reference fails, given
solution does not compile) is IE. A participant is never credited or
penalised for a broken question.
"""
from __future__ import annotations

from app.core.problem import ProblemBroken
from app.core.results import HackResult
from app.core.timing import Stopwatch
from app.judging.judge import Judge, Submission
from app.problems.store import ProblemStore
from app.sandbox.scripts import SandboxedPython


def internal_error(given: Submission, message: str) -> HackResult:
    """Neither credited nor penalised: the participant did nothing wrong."""
    return HackResult(
        submission_id=given.submission_id, problem_version=given.problem.version,
        valid_input=True, hacked=None, verdict="IE", message=message,
    )


class Hacker:
    def __init__(self, judge: Judge, python: SandboxedPython, store: ProblemStore):
        self.judge = judge
        self.python = python
        self.store = store

    def run(self, given: Submission, input_text: str) -> HackResult:
        watch = Stopwatch()
        try:
            result = self._decide(given, input_text)
        except ProblemBroken as exc:
            result = internal_error(given, f"problem is broken, not the participant: {exc}")
        result.submission_id = given.submission_id
        result.problem_version = given.problem.version
        result.duration_ms = watch.elapsed_ms()
        return result

    def _decide(self, given: Submission, input_text: str) -> HackResult:
        problem = given.problem

        # 1. Constraints. Without a validator every input is taken as legal.
        validator = self.store.validator(problem)
        if validator is not None:
            valid, reason = self.python.validate_input(validator, input_text)
            if not valid:
                return HackResult(valid_input=False, invalid_reason=reason,
                                  message="input violates the problem's constraints")

        # 2. The correct answer, from the stored reference solution.
        language, source = self.store.reference_solution(problem)
        reference = self.judge.run_once(Submission(problem, language, source), input_text, keep=True)
        if not reference.accepted:
            raise ProblemBroken(f"reference solution got {reference.verdict} on this input")

        # 3. The given solution, judged against the reference's output.
        return self._judge_given(given, input_text, reference.stdout)

    def _judge_given(self, given: Submission, input_text: str, answer: str) -> HackResult:
        outcome = self.judge.run_once(given, input_text, answer, keep=True)
        if outcome.verdict == "CE":
            raise ProblemBroken("the given solution does not compile")
        if outcome.verdict == "IE":
            raise ProblemBroken(outcome.detail or "sandbox fault while running the given solution")
        hacked = not outcome.accepted
        return HackResult(
            valid_input=True,
            hacked=hacked,
            verdict=outcome.verdict,
            message="the solution failed on this input" if hacked
                    else "the solution handled this input correctly",
        )
