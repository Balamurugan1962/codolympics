"""What a problem is, once loaded: its limits, its testcases and its extras."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

# The pattern a problem id must match, in the API and on disk.
ID_PATTERN = r"^[A-Za-z0-9._-]+$"


class ProblemNotFound(Exception):
    pass


class ProblemBroken(Exception):
    """The problem exists but cannot be used: bad JSON, missing files, a
    reference solution in a language we do not offer."""


@dataclass(frozen=True)
class Testcase:
    index: int          # zero-based, matching first_fail in a judgement
    input_key: str
    answer_key: str


@dataclass(frozen=True)
class Reference:
    """A stored correct solution, named in problem.json as
    `"reference": {"language": "cpp", "file": "solution.cpp"}`.

    Nothing ever serves its source (US-J7-02)."""
    language: str
    file: str


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
    reference: Reference | None = None
    # A problem that exists only to be hacked has no testcases of its own.
    hack_only: bool = False
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

    @property
    def has_reference(self) -> bool:
        return self.reference is not None


@dataclass(frozen=True)
class SetterFile:
    """A file the problem setter wrote, such as checker.py: named uniquely per
    problem version, read only when needed, cached by that name."""

    name: str
    read: Callable[[], str]
