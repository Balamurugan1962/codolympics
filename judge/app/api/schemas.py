"""Request and response bodies, mirroring openapi.yaml exactly.

The results a job carries live in app.core.results; this file holds what only
the HTTP layer sees. If you change a field here, change it in openapi.yaml
too. tests/test_contract.py compares the two and will fail if they drift.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.core.comparison import CompareMode
from app.core.problem import ID_PATTERN
from app.core.results import AnswersResult, HackResult, Judgement
from app.jobs.control import POLL_QUEUED_MS

JobStateName = Literal["queued", "running", "done"]


class SubmitRequest(BaseModel):
    problem_id: str = Field(pattern=ID_PATTERN)
    language: str
    source: str
    submission_id: str | None = Field(default=None, max_length=64)


class HackRequest(BaseModel):
    """A test input against a given solution (US-J7-01).

    `version` exists for the same reason it does on /validate: an author has to
    be able to prove a breaking input against a package that is not published
    yet. Without it, proving a hack would require publishing first, which is the
    wrong way round -- publishing is what you do *after* the proof.
    """
    problem_id: str = Field(pattern=ID_PATTERN)
    language: str
    source: str
    input: str
    version: str | None = Field(default=None, pattern=r"^v\d+$")
    submission_id: str | None = Field(default=None, max_length=64)


class AnswersRequest(BaseModel):
    """Score a list of entries with a supplied validator (US-J7-03)."""
    validator: str
    entries: list[str]
    submission_id: str | None = Field(default=None, max_length=64)


class Progress(BaseModel):
    done: int
    total: int


class JobHandle(BaseModel):
    job_id: str
    submission_id: str | None = None
    state: Literal["queued"] = "queued"
    poll_after_ms: int = POLL_QUEUED_MS


class JobState(BaseModel):
    job_id: str
    submission_id: str | None = None
    state: JobStateName
    progress: Progress
    poll_after_ms: int | None = None
    result: Judgement | HackResult | AnswersResult | None = None


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
    has_reference: bool = False
    hack_only: bool = False


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


class ErrorBody(BaseModel):
    error: str
    message: str
