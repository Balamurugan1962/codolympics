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

import threading

from .checker import SandboxedPython
from .judge import Judge
from .languages import Language
from .models import CheckerReport, SolutionReport, ValidationReport
from .problems import Problem, ProblemStore
from .storage import Storage


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


class Validator:
    def __init__(
        self,
        store: ProblemStore,
        storage: Storage,
        judge: Judge,
        python: SandboxedPython,
        registry: ValidationRegistry,
    ):
        self.store = store
        self.storage = storage
        self.judge = judge
        self.python = python
        self.registry = registry

    def validate(
        self,
        problem: Problem,
        reference_source: str | None = None,
        wrong_source: str | None = None,
        language: Language | None = None,
    ) -> ValidationReport:
        issues: list[str] = []

        issues.extend(self._structural_issues(problem))
        checker_report = self._check_checker(problem, issues)
        issues.extend(self._input_issues(problem))

        reference = None
        if reference_source and language:
            reference = self._run_solution(problem, language, reference_source)
            if reference.verdict != "AC":
                issues.append(_reference_issue(reference))

        wrong = None
        if wrong_source and language:
            wrong = self._run_solution(problem, language, wrong_source)
            if wrong.verdict == "AC":
                # A test set that accepts a known-wrong answer proves nothing.
                issues.append(
                    "the known-incorrect solution was accepted; the testcases "
                    "do not discriminate"
                )

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
        issues = []
        for orphan in self.store.unmatched_inputs(problem.root):
            issues.append(f"{orphan} has no matching answer file")
        if problem.total == 0:
            issues.append("problem has no testcases")
        if problem.compare not in {"tokens", "exact", "float", "yesno", "checker"}:
            issues.append(f"unknown compare mode: {problem.compare!r}")
        if problem.time_limit_ms <= 0:
            issues.append("time_limit_ms must be positive")
        if problem.memory_limit_mb <= 0:
            issues.append("memory_limit_mb must be positive")
        return issues

    def _check_checker(self, problem: Problem, issues: list[str]) -> CheckerReport | None:
        if problem.compare != "checker":
            return None
        loaded, detail = self.python.checker_loads(problem)
        if not loaded:
            issues.append(f"checker.py could not be loaded: {detail}")
        return CheckerReport(compiled=loaded, output=detail)

    # --- layer 2: input files ----------------------------------------------

    def _input_issues(self, problem: Problem) -> list[str]:
        """Run the optional validator.py over every input file."""
        if not self.storage.exists(problem.validator_key):
            return []

        issues = []
        for testcase in problem.testcases:
            name = testcase.input_key.split("/")[-1]
            try:
                text = self.storage.read_text(testcase.input_key)
            except (OSError, UnicodeDecodeError) as exc:
                issues.append(f"{name} could not be read: {exc}")
                continue
            valid, message = self.python.validate_input(problem, text)
            if not valid:
                issues.append(f"{name} is invalid: {message}")
        return issues

    # --- layer 3: solutions ------------------------------------------------

    def _run_solution(self, problem: Problem, language: Language, source: str) -> SolutionReport:
        """Run a solution over every testcase, ignoring early_exit.

        Stopping at the first failure would hide later broken answer files,
        which is exactly what this endpoint exists to find.
        """
        judgement = self.judge.run(
            problem=problem,
            language=language,
            source=source,
            run_all=True,
        )
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
