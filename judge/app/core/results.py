"""What judging produces, mirroring openapi.yaml exactly.

These are the bodies a finished job carries. They are pydantic models rather
than plain dataclasses because they are serialised as-is; if you change a
field here, change it in openapi.yaml too. tests/test_contract.py compares the
two and will fail if they drift.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.core.verdict import Verdict


class Judgement(BaseModel):
    submission_id: str | None = None
    verdict: Verdict
    passed: int
    total: int
    first_fail: int | None = None
    max_time_ms: float = 0.0
    max_memory_kb: int = 0
    compile_output: str = ""
    message: str = ""
    # Contains the expected answer for the failing test. Admin dashboard only:
    # showing this to a contestant hands them the answer they would otherwise
    # have to buy as a hint.
    jury_detail: str = ""
    problem_version: str = ""
    duration_ms: int = 0


class HackResult(BaseModel):
    submission_id: str | None = None
    # False means the input broke a constraint and nothing was run.
    valid_input: bool
    invalid_reason: str = ""
    # None when the input was invalid or the problem itself is broken (IE).
    hacked: bool | None = None
    # The given solution's verdict on this input. Never show a participant this;
    # it turns the judge into an oracle for probing the solution.
    verdict: Verdict | None = None
    message: str = ""
    problem_version: str = ""
    duration_ms: int = 0


class EntryResult(BaseModel):
    valid: bool
    error: str | None = None


class AnswersResult(BaseModel):
    submission_id: str | None = None
    # "ok" or "IE". On IE, `results` is empty: nothing was checked, and the
    # caller must not treat that as every entry being invalid.
    status: Literal["ok", "IE"]
    results: list[EntryResult] = Field(default_factory=list)
    message: str = ""
    duration_ms: int = 0


class CheckerReport(BaseModel):
    compiled: bool
    output: str = ""


class SolutionReport(BaseModel):
    verdict: Verdict
    first_fail: int | None = None
    passed: int = 0
    max_time_ms: float = 0.0


class ValidationReport(BaseModel):
    problem_id: str
    ok: bool
    testcases: int
    version: str = ""
    issues: list[str] = Field(default_factory=list)
    checker: CheckerReport | None = None
    reference: SolutionReport | None = None
    wrong_solution: SolutionReport | None = None
