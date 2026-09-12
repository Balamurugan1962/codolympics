"""Request and response bodies, mirroring openapi.yaml exactly.

If you change a field here, change it in openapi.yaml too -- tests/test_contract.py
compares the two and will fail if they drift.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Verdict = Literal["AC", "WA", "TLE", "MLE", "OLE", "RE", "CE", "IE"]
CompareMode = Literal["tokens", "exact", "float", "yesno", "checker"]
JobStateName = Literal["queued", "running", "done"]


class SubmitRequest(BaseModel):
    problem_id: str = Field(pattern=r"^[A-Za-z0-9._-]+$")
    language: str
    source: str
    submission_id: str | None = Field(default=None, max_length=64)


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
    # Contains the expected answer for the failing test. Admin dashboard only --
    # showing this to a contestant hands them the answer they would otherwise
    # have to buy as a hint.
    jury_detail: str = ""
    problem_version: str = ""
    duration_ms: int = 0


class Progress(BaseModel):
    done: int
    total: int


class JobHandle(BaseModel):
    job_id: str
    submission_id: str | None = None
    state: Literal["queued"] = "queued"
    poll_after_ms: int = 500


class JobState(BaseModel):
    job_id: str
    submission_id: str | None = None
    state: JobStateName
    progress: Progress
    poll_after_ms: int | None = None
    result: Judgement | None = None


class Language(BaseModel):
    key: str
    name: str
    compiled: bool


class LanguageList(BaseModel):
    languages: list[Language]


class ProblemInfo(BaseModel):
    problem_id: str
    testcases: int
    time_limit_ms: int
    memory_limit_mb: int
    compare: CompareMode
    early_exit: bool = True
    version: str = ""
    bytes: int = 0
    validated: bool = False
    modified_at: str | None = None


class ProblemList(BaseModel):
    problems: list[ProblemInfo]


class Testcase(BaseModel):
    problem_id: str
    index: int
    version: str = ""
    input: str
    answer: str
    truncated: bool = False


class Health(BaseModel):
    status: Literal["ok", "degraded"]
    go_judge: Literal["ok", "unreachable"]
    problems: int
    busy: int
    capacity: int


class ValidateRequest(BaseModel):
    reference_source: str | None = None
    language: str | None = None
    wrong_source: str | None = None


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


class ErrorBody(BaseModel):
    error: str
    message: str
