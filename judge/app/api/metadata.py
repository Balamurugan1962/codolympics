"""What the backend asks about the judge and its problems."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends

from app.api import errors
from app.api.auth import require_token
from app.api.deps import Svc, language_or_400, load_problem
from app.api.schemas import (
    Health,
    Language,
    LanguageList,
    ProblemInfo,
    ProblemList,
    Testcase,
    ValidateRequest,
)
from app.container import Services
from app.core import languages
from app.core.problem import Problem, ProblemBroken, ProblemNotFound
from app.core.results import ValidationReport
from app.judging.validation import Solutions
from app.sandbox.client import SandboxUnavailable

log = logging.getLogger("judge")

public = APIRouter(tags=["Metadata"])
router = APIRouter(tags=["Metadata"], dependencies=[Depends(require_token)])


@public.get("/health", response_model=Health)
def health(services: Svc) -> Health:
    """Unauthenticated, so it works as a container health check (US-J6-02)."""
    reachable = services.sandbox.reachable()
    try:
        problem_count = services.store.count()
    except OSError:
        problem_count = 0
    return Health(
        status="ok" if reachable else "degraded",
        go_judge="ok" if reachable else "unreachable",
        problems=problem_count,
        busy=services.queue.busy(),
        capacity=services.queue.concurrency,
    )


@router.get("/languages", response_model=LanguageList)
def list_languages() -> LanguageList:
    return LanguageList(languages=[
        Language(key=lang.key, name=lang.name, compiled=lang.compiled)
        for lang in sorted(languages.LANGUAGES.values(), key=lambda lang: lang.key)
    ])


@router.get("/problems", response_model=ProblemList)
def list_problems(services: Svc) -> ProblemList:
    found = []
    for problem_id in sorted(services.store.ids()):
        try:
            found.append(_describe(services, services.store.load(problem_id)))
        except (ProblemNotFound, ProblemBroken, OSError) as exc:
            # One broken problem must not hide the other 24.
            log.warning("skipping problem %s: %s", problem_id, exc)
    return ProblemList(problems=found)


@router.get("/problems/{problem_id}", response_model=ProblemInfo)
def get_problem(problem_id: str, services: Svc) -> ProblemInfo:
    return _describe(services, load_problem(services, problem_id))


@router.post("/problems/{problem_id}/validate", response_model=ValidationReport)
def validate_problem(
    problem_id: str, services: Svc, body: ValidateRequest | None = None, version: str | None = None
) -> ValidationReport:
    """`version` validates an uploaded-but-unpublished version, so a problem
    can be proven before it goes live (US-B8-01)."""
    body = body or ValidateRequest()
    problem = load_problem(services, problem_id, version)

    language = None
    if body.reference_source or body.wrong_source:
        if not body.language:
            raise errors.invalid_request("language is required when a solution is supplied")
        language = language_or_400(body.language)

    solutions = Solutions(language=language, reference=body.reference_source, wrong=body.wrong_source)
    try:
        return services.validator.validate(problem, solutions)
    except SandboxUnavailable:
        raise errors.sandbox_unavailable(services.sandbox.url) from None


@router.get("/problems/{problem_id}/testcases/{index}", response_model=Testcase)
def get_testcase(problem_id: str, index: int, services: Svc, version: str | None = None) -> Testcase:
    """Administrators only. Never expose this to contestants (US-J5-03).

    Always pass `version`, taken from the submission's `problem_version`: after
    a mid-contest edit the current testcase is not the one they failed on.
    """
    if index < 0:
        raise errors.invalid_request("index must be zero or greater")
    problem = load_problem(services, problem_id, version)
    if index >= problem.total:
        raise errors.problem_not_found(f"{problem_id} testcase {index}")

    cap = services.settings.testcase_response_bytes
    try:
        input_text, answer_text = services.store.read_testcase(problem.testcases[index])
    except ProblemBroken as exc:
        raise errors.invalid_request(str(exc)) from None

    return Testcase(
        problem_id=problem_id,
        index=index,
        version=problem.version,
        input=input_text[:cap],
        answer=answer_text[:cap],
        truncated=len(input_text) > cap or len(answer_text) > cap,
    )


def _describe(services: Services, problem: Problem) -> ProblemInfo:
    validated = services.registry.is_validated(problem.problem_id, problem.version)
    return ProblemInfo(**services.store.describe(problem, validated))
