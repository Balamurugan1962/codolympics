"""Proving a problem is usable before it is auctioned (Epic J4).

Three layers, cheapest first:

  1. structural  -- every .in has an answer, problem.json parses, the checker
                    imports (US-J4-01)
  2. inputs      -- optional validator.py runs over every input file (US-J4-04)
  3. solutions   -- a known-correct solution must pass every testcase, and a
                    known-wrong one must fail (US-J4-02, US-J4-03)

Layer 3 is the one that matters. A reference solution failing at testcase 61
means testcase 61's answer file is wrong, found on a Tuesday rather than during
the contest.

Validation results are held in memory, not written next to the problem. That
keeps the problems volume mountable read-only, and means `validated` honestly
reports "validated since this judge started" rather than trusting a stale
marker file someone copied along with the testcases.
"""
from __future__ import annotations

import posixpath
import threading
from dataclasses import dataclass

from app.core.comparison import CompareMode
from app.core.languages import Language
from app.core.problem import Problem, ProblemBroken
from app.core.results import CheckerReport, SolutionReport, ValidationReport
from app.judging.judge import Judge, Submission
from app.problems.store import ProblemStore
from app.sandbox.scripts import SandboxedPython

_MODES = set(CompareMode.__args__)


class ValidationRegistry:
    """Which problem versions have passed validation in this process."""

    def __init__(self) -> None:
        self._passed: set[tuple[str, str]] = set()
        self._lock = threading.Lock()

    def record(self, problem_id: str, version: str, ok: bool) -> None:
        with self._lock:
            key = (problem_id, version)
            if ok:
                self._passed.add(key)
            else:
                self._passed.discard(key)

    def is_validated(self, problem_id: str, version: str) -> bool:
        with self._lock:
            return (problem_id, version) in self._passed


@dataclass(frozen=True)
class Solutions:
    """What the request supplied for layer 3. A stored reference solution is
    used when none is given (US-J7-02)."""

    language: Language | None = None
    reference: str | None = None
    wrong: str | None = None


class Validator:
    def __init__(self, store: ProblemStore, judge: Judge, python: SandboxedPython, registry: ValidationRegistry):
        self.store = store
        self.judge = judge
        self.python = python
        self.registry = registry

    def validate(self, problem: Problem, solutions: Solutions = Solutions()) -> ValidationReport:
        issues: list[str] = []
        issues.extend(self._structural_issues(problem))
        checker_report = self._check_checker(problem, issues)
        issues.extend(self._input_issues(problem))
        reference, wrong = self._solution_reports(problem, solutions, issues)

        ok = not issues
        self.registry.record(problem.problem_id, problem.version, ok)
        return ValidationReport(
            problem_id=problem.problem_id,
            ok=ok,
            testcases=problem.total,
            version=problem.version,
            issues=issues,
            checker=checker_report,
            reference=reference,
            wrong_solution=wrong,
        )

    # --- layer 1: structure ------------------------------------------------

    def _structural_issues(self, problem: Problem) -> list[str]:
        issues = [f"{orphan} has no matching answer file" for orphan in self.store.unmatched_inputs(problem.root)]
        if problem.total == 0 and not problem.hack_only:
            issues.append("problem has no testcases")
        if problem.hack_only and not problem.has_reference:
            issues.append("a hack-only problem must store a reference solution")
        if problem.compare not in _MODES:
            issues.append(f"unknown compare mode: {problem.compare!r}")
        if problem.time_limit_ms <= 0:
            issues.append("time_limit_ms must be positive")
        if problem.memory_limit_mb <= 0:
            issues.append("memory_limit_mb must be positive")
        return issues

    def _check_checker(self, problem: Problem, issues: list[str]) -> CheckerReport | None:
        if problem.compare != "checker":
            return None
        checker = self.store.checker(problem)
        loaded, detail = self.python.checker_loads(checker) if checker else (False, "checker.py not found")
        if not loaded:
            issues.append(f"checker.py could not be loaded: {detail}")
        return CheckerReport(compiled=loaded, output=detail)

    # --- layer 2: input files ----------------------------------------------

    def _input_issues(self, problem: Problem) -> list[str]:
        """Run the optional validator.py over every input file."""
        validator = self.store.validator(problem)
        if validator is None:
            return []
        issues = []
        for testcase in problem.testcases:
            name = posixpath.basename(testcase.input_key)
            try:
                text, _ = self.store.read_testcase(testcase)
            except ProblemBroken as exc:
                issues.append(f"{name} could not be read: {exc}")
                continue
            valid, message = self.python.validate_input(validator, text)
            if not valid:
                issues.append(f"{name} is invalid: {message}")
        return issues

    # --- layer 3: solutions ------------------------------------------------

    def _solution_reports(
        self, problem: Problem, solutions: Solutions, issues: list[str]
    ) -> tuple[SolutionReport | None, SolutionReport | None]:
        language, reference_source = solutions.language, solutions.reference
        # Hack-only problems have no testcases to run the stored reference
        # over, so for them the check is simply that it exists and is readable.
        if reference_source is None and problem.has_reference:
            try:
                language, reference_source = self.store.reference_solution(problem)
            except ProblemBroken as exc:
                issues.append(str(exc))

        reference = None
        if reference_source and language and problem.testcases:
            reference = self._run_solution(problem, language, reference_source)
            if reference.verdict != "AC":
                issues.append(_reference_issue(reference))

        wrong = None
        if solutions.wrong and language:
            wrong = self._run_solution(problem, language, solutions.wrong)
            if wrong.verdict == "AC":
                # A test set that accepts a known-wrong answer proves nothing.
                issues.append("the known-incorrect solution was accepted; the testcases do not discriminate")
        return reference, wrong

    def _run_solution(self, problem: Problem, language: Language, source: str) -> SolutionReport:
        """Run a solution over every testcase, ignoring early_exit.

        Stopping at the first failure would hide later broken answer files,
        which is exactly what this endpoint exists to find.
        """
        judgement = self.judge.run(Submission(problem, language, source), run_all=True)
        return SolutionReport(
            verdict=judgement.verdict,
            first_fail=judgement.first_fail,
            passed=judgement.passed,
            max_time_ms=judgement.max_time_ms,
        )


def _reference_issue(reference: SolutionReport) -> str:
    if reference.verdict == "CE":
        return "the reference solution does not compile"
    if reference.first_fail is not None:
        return (
            f"the reference solution got {reference.verdict} on testcase "
            f"{reference.first_fail}; that answer file or the solution is wrong"
        )
    return f"the reference solution got {reference.verdict}"
