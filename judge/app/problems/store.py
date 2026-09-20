"""Loading problems and their testcases.

On-disk layout, versioned (recommended; required for mid-contest edits):

    problems/
      hard-03/
        current -> v3          symlink; swapping it publishes atomically
        v2/ ...
        v3/
          problem.json
          tests/00001.in
          tests/00001.ans
          checker.py           optional, only for compare: checker
          validator.py         optional, checked by POST /validate
          solution.cpp         optional reference solution, named in problem.json;
                               used by /validate and required by /hack. NEVER served.

Unversioned, for problems that will never be edited:

    problems/
      easy-01/
        problem.json
        tests/...

A judgement resolves the version once, at the start, and holds it. Re-pointing
`current` mid-contest therefore cannot disturb a job already running
(US-J5-04), and the version it used is recorded on the judgement.
"""
from __future__ import annotations

import json
import posixpath
from datetime import datetime, timezone

from app.core import languages
from app.core.languages import Language
from app.core.problem import Problem, ProblemBroken, ProblemNotFound, Reference, SetterFile, Testcase
from app.problems.storage import Storage

# A testcase is an input file plus the expected answer. Both spellings are
# accepted because both are common in problem archives.
ANSWER_SUFFIXES = (".ans", ".out")

UNVERSIONED = "v1"


class ProblemStore:
    """Reads problems through Storage. Holds no cache.

    Re-reading a directory listing per submission costs microseconds against a
    judgement measured in seconds, and it means an admin who publishes a new
    version never has to restart the judge to see it.
    """

    def __init__(self, storage: Storage):
        self.storage = storage

    # --- discovery ---------------------------------------------------------

    def ids(self) -> list[str]:
        return [posixpath.basename(key) for key in self.storage.list("")]

    def count(self) -> int:
        return len(self.ids())

    def resolve_version(self, problem_id: str, version: str | None = None) -> str:
        """Which version directory to read.

        An explicit version wins: that is how jury inspection reads the
        testcase a submission actually failed on, rather than whatever is
        current now (US-J5-03).
        """
        if version:
            if not self.storage.exists(f"{problem_id}/{version}/problem.json"):
                raise ProblemNotFound(f"{problem_id} has no version {version}")
            return version

        pointed_at = self.storage.resolve_symlink(f"{problem_id}/current")
        if pointed_at:
            return pointed_at
        if self.storage.exists(f"{problem_id}/current/problem.json"):
            return "current"
        if self.storage.exists(f"{problem_id}/problem.json"):
            return UNVERSIONED
        raise ProblemNotFound(problem_id)

    def _root_for(self, problem_id: str, version: str) -> str:
        if version == UNVERSIONED and self.storage.exists(f"{problem_id}/problem.json"):
            return problem_id
        return f"{problem_id}/{version}"

    # --- loading -----------------------------------------------------------

    def load(self, problem_id: str, version: str | None = None) -> Problem:
        version = self.resolve_version(problem_id, version)
        root = self._root_for(problem_id, version)
        config = self._config(problem_id, f"{root}/problem.json")
        reference = config.get("reference") or {}
        return Problem(
            problem_id=problem_id,
            version=version,
            root=root,
            time_limit_ms=int(config.get("time_limit_ms", 1000)),
            memory_limit_mb=int(config.get("memory_limit_mb", 256)),
            compare=str(config.get("compare", "tokens")),
            early_exit=bool(config.get("early_exit", True)),
            float_tolerance=float(config.get("float_tolerance", 1e-6)),
            reference=Reference(reference["language"], reference["file"])
            if reference.get("language") and reference.get("file") else None,
            hack_only=bool(config.get("hack_only", False)),
            testcases=self._testcases(root),
        )

    def _config(self, problem_id: str, key: str) -> dict:
        if not self.storage.exists(key):
            raise ProblemNotFound(problem_id)
        try:
            return json.loads(self.storage.read_text(key))
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            raise ProblemBroken(f"{key} is not valid JSON: {exc}") from exc

    def _testcases(self, root: str) -> list[Testcase]:
        """Input files paired with their answers, ordered by filename.

        Zero-padded names make lexical order equal numeric order, so "test 12"
        means the same testcase on every run (US-J1-06). An input with no
        answer is a broken problem, and validation reports it by name; judging
        simply skips it rather than failing a contest submission over the
        setter's mistake.
        """
        pairs = [(inp, ans) for inp, ans in self._pairs(root) if ans]
        return [Testcase(index, inp, ans) for index, (inp, ans) in enumerate(pairs)]

    def unmatched_inputs(self, root: str) -> list[str]:
        """Input files with no answer file, reported by validation (US-J4-01)."""
        return [posixpath.basename(inp) for inp, ans in self._pairs(root) if not ans]

    def _pairs(self, root: str) -> list[tuple[str, str | None]]:
        """Every input key with its answer key, or None when it has none."""
        present = set(self.storage.list(f"{root}/tests"))
        pairs = []
        for input_key in sorted(k for k in present if k.endswith(".in")):
            stem = input_key[: -len(".in")]
            answer_key = next((stem + s for s in ANSWER_SUFFIXES if stem + s in present), None)
            pairs.append((input_key, answer_key))
        return pairs

    # --- reading what a problem ships --------------------------------------

    def read_testcase(self, testcase: Testcase) -> tuple[str, str]:
        """The input and the expected answer. Unreadable test data is our
        problem, never the contestant's, so it is reported as ProblemBroken."""
        try:
            return self.storage.read_text(testcase.input_key), self.storage.read_text(testcase.answer_key)
        except (OSError, UnicodeDecodeError) as exc:
            raise ProblemBroken(f"cannot read testcase {testcase.index}: {exc}") from exc

    def checker(self, problem: Problem) -> SetterFile | None:
        return self._setter_file(problem.checker_key)

    def validator(self, problem: Problem) -> SetterFile | None:
        """None when the problem has no validator, which means every input is
        taken as legal."""
        return self._setter_file(problem.validator_key)

    def _setter_file(self, key: str) -> SetterFile | None:
        if not self.storage.exists(key):
            return None
        return SetterFile(key, lambda: self.storage.read_text(key))

    def reference_solution(self, problem: Problem) -> tuple[Language, str]:
        """The language and source of the problem's reference solution.

        Raises ProblemBroken saying what is wrong with it, so a hack can report
        the problem as broken and validation can list it as an issue.
        """
        if problem.reference is None:
            raise ProblemBroken("no reference solution is stored with the problem")
        language = languages.get(problem.reference.language)
        if language is None:
            raise ProblemBroken(f"reference language {problem.reference.language!r} is not offered")
        key = f"{problem.root}/{problem.reference.file}"
        if not self.storage.exists(key):
            raise ProblemBroken(f"reference solution {problem.reference.file} is missing")
        try:
            return language, self.storage.read_text(key)
        except (OSError, UnicodeDecodeError) as exc:
            raise ProblemBroken(f"cannot read the reference solution: {exc}") from exc

    # --- the admin dashboard view -----------------------------------------

    def describe(self, problem: Problem, validated: bool) -> dict:
        """Everything GET /problems needs for one problem (US-J5-01).

        `validated` is passed in rather than read from disk: the problems
        volume is mounted read-only, so the judge records validation results in
        memory. See judging/validation.py.
        """
        total_bytes = 0
        newest = 0.0
        for testcase in problem.testcases:
            for key in (testcase.input_key, testcase.answer_key):
                total_bytes += self.storage.size(key)
                newest = max(newest, self.storage.modified_at(key))

        return {
            "problem_id": problem.problem_id,
            "testcases": problem.total,
            "time_limit_ms": problem.time_limit_ms,
            "memory_limit_mb": problem.memory_limit_mb,
            "compare": problem.compare,
            "early_exit": problem.early_exit,
            "version": problem.version,
            "bytes": total_bytes,
            "validated": validated,
            "modified_at": _iso(newest) if newest else None,
            "has_reference": problem.has_reference,
            "hack_only": problem.hack_only,
        }


def _iso(timestamp: float) -> str:
    return datetime.fromtimestamp(timestamp, tz=timezone.utc).isoformat().replace("+00:00", "Z")
