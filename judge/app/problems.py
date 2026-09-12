"""Loading problems and their testcases.

On-disk layout, versioned (recommended -- required for mid-contest edits):

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
from dataclasses import dataclass, field
from datetime import datetime, timezone

from .config import settings
from .storage import LocalStorage, Storage

# A testcase is an input file plus the expected answer. Both spellings are
# accepted because both are common in problem archives.
ANSWER_SUFFIXES = (".ans", ".out")

UNVERSIONED = "v1"


@dataclass(frozen=True)
class Testcase:
    index: int          # zero-based, matching first_fail in a judgement
    input_key: str
    answer_key: str


@dataclass(frozen=True)
class Problem:
    problem_id: str
    version: str
    root: str                       # storage prefix of the resolved version
    time_limit_ms: int
    memory_limit_mb: int
    compare: str
    early_exit: bool
    float_tolerance: float
    testcases: list[Testcase] = field(default_factory=list)

    @property
    def total(self) -> int:
        return len(self.testcases)

    @property
    def checker_key(self) -> str:
        return f"{self.root}/checker.py"

    @property
    def validator_key(self) -> str:
        return f"{self.root}/validator.py"


class ProblemNotFound(Exception):
    pass


class ProblemBroken(Exception):
    """The problem exists but cannot be loaded -- bad JSON, missing tests."""


class ProblemStore:
    """Reads problems through Storage. Holds no cache.

    Re-reading a directory listing per submission costs microseconds against a
    judgement measured in seconds, and it means an admin who publishes a new
    version never has to restart the judge to see it.
    """

    def __init__(self, storage: Storage | None = None):
        self.storage = storage or LocalStorage(settings.problems_dir)

    # --- discovery ---------------------------------------------------------

    def ids(self) -> list[str]:
        return [key.split("/")[-1] for key in self.storage.list("")]

    def count(self) -> int:
        return len(self.ids())

    def resolve_version(self, problem_id: str, version: str | None = None) -> str:
        """Which version directory to read.

        An explicit version wins -- that is how jury inspection reads the
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

        config_key = f"{root}/problem.json"
        if not self.storage.exists(config_key):
            raise ProblemNotFound(problem_id)

        try:
            config = json.loads(self.storage.read_text(config_key))
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            raise ProblemBroken(f"{config_key} is not valid JSON: {exc}") from exc

        return Problem(
            problem_id=problem_id,
            version=version,
            root=root,
            time_limit_ms=int(config.get("time_limit_ms", 1000)),
            memory_limit_mb=int(config.get("memory_limit_mb", 256)),
            compare=str(config.get("compare", "tokens")),
            early_exit=bool(config.get("early_exit", True)),
            float_tolerance=float(config.get("float_tolerance", 1e-6)),
            testcases=self._testcases(root),
        )

    def _testcases(self, root: str) -> list[Testcase]:
        """Input files paired with their answers, ordered by filename.

        Zero-padded names make lexical order equal numeric order, so "test 12"
        means the same testcase on every run (US-J1-06).
        """
        present = set(self.storage.list(f"{root}/tests"))
        found = []
        for input_key in sorted(k for k in present if k.endswith(".in")):
            stem = input_key[: -len(".in")]
            answer_key = next(
                (stem + suffix for suffix in ANSWER_SUFFIXES if stem + suffix in present),
                None,
            )
            # An input with no answer is a broken problem, and validate()
            # reports it by name. Judging simply skips it rather than failing a
            # contest submission over the setter's mistake.
            if answer_key:
                found.append((input_key, answer_key))

        return [
            Testcase(index=i, input_key=inp, answer_key=ans)
            for i, (inp, ans) in enumerate(found)
        ]

    def unmatched_inputs(self, root: str) -> list[str]:
        """Input files with no answer file -- reported by validation (US-J4-01)."""
        present = set(self.storage.list(f"{root}/tests"))
        orphans = []
        for input_key in sorted(k for k in present if k.endswith(".in")):
            stem = input_key[: -len(".in")]
            if not any(stem + suffix in present for suffix in ANSWER_SUFFIXES):
                orphans.append(input_key.split("/")[-1])
        return orphans

    # --- the admin dashboard view -----------------------------------------

    def describe(self, problem_id: str, validated: bool = False) -> dict:
        """Everything GET /problems needs for one problem (US-J5-01).

        `validated` is passed in rather than read from disk: the problems
        volume is mounted read-only, so the judge records validation results in
        memory. See validate.py.
        """
        problem = self.load(problem_id)
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
        }


def _iso(timestamp: float) -> str:
    return datetime.fromtimestamp(timestamp, tz=timezone.utc).isoformat().replace("+00:00", "Z")
