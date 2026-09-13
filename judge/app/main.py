"""HTTP API. Implements openapi.yaml exactly.

Routes do three things and nothing else: check the request, call into the
service objects, shape the response. All the judging logic lives elsewhere.
"""
from __future__ import annotations

import logging
import secrets
import time
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request, Response
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from . import errors, languages
from .checker import SandboxedPython
from .config import settings
from .errors import ApiError
from .gojudge import GoJudge, SandboxUnavailable
from .hack import run_hack
from .jobs import JobQueue
from .judge import Judge
from .models import (
    AnswersRequest,
    AnswersResult,
    EntryResult,
    ErrorBody,
    HackRequest,
    HackResult,
    Health,
    JobHandle,
    JobState,
    Language,
    LanguageList,
    ProblemInfo,
    ProblemList,
    Progress,
    SubmitRequest,
    Testcase,
    ValidateRequest,
    ValidationReport,
)
from .problems import ProblemBroken, ProblemNotFound, ProblemStore
from .storage import LocalStorage
from .validate import ValidationRegistry, Validator

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s"
)
log = logging.getLogger("judge")

# Populated at startup. A module-level container keeps the wiring visible in
# one place instead of scattered through FastAPI dependencies.
class Services:
    sandbox: GoJudge
    storage: LocalStorage
    store: ProblemStore
    python: SandboxedPython
    judge: Judge
    queue: JobQueue
    validator: Validator
    registry: ValidationRegistry


services = Services()


@asynccontextmanager
async def lifespan(app: FastAPI):
    services.sandbox = GoJudge()
    services.storage = LocalStorage(settings.problems_dir)
    services.store = ProblemStore(services.storage)
    services.python = SandboxedPython(services.sandbox, services.storage)
    services.judge = Judge(services.sandbox, services.storage, services.python)
    services.queue = JobQueue(services.judge)
    services.registry = ValidationRegistry()
    services.validator = Validator(
        services.store, services.storage, services.judge,
        services.python, services.registry,
    )

    if not settings.service_token:
        log.warning(
            "JUDGE_SERVICE_TOKEN is not set; every authenticated request will be "
            "rejected. Set it to the shared secret the backend uses."
        )
    log.info(
        "judge ready: concurrency=%d queue_limit=%d problems_dir=%s",
        services.queue.concurrency, services.queue.queue_limit, settings.problems_dir,
    )
    yield

    services.queue.shutdown()
    services.python.release_all()
    services.sandbox.close()


app = FastAPI(
    title="Judge Service API",
    version="1.0.0",
    description="Code judging for the auction-based coding competition.",
    lifespan=lifespan,
)

bearer = HTTPBearer(auto_error=False)


def require_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> None:
    """Every endpoint except /health requires the shared service token (US-J6-01)."""
    if not settings.service_token:
        # No token configured means the service is misconfigured, not open.
        raise errors.unauthorized()
    if credentials is None or not secrets.compare_digest(
        credentials.credentials, settings.service_token
    ):
        raise errors.unauthorized()


@app.exception_handler(ApiError)
async def api_error_handler(request: Request, exc: ApiError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status,
        content=ErrorBody(error=exc.code, message=exc.message).model_dump(),
        headers=exc.headers,
    )


# --- metadata --------------------------------------------------------------


@app.get("/health", response_model=Health, tags=["Metadata"])
def health() -> Health:
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


@app.get(
    "/languages",
    response_model=LanguageList,
    tags=["Metadata"],
    dependencies=[Depends(require_token)],
)
def list_languages() -> LanguageList:
    return LanguageList(
        languages=[
            Language(key=lang.key, name=lang.name, compiled=lang.compiled)
            for lang in sorted(languages.LANGUAGES.values(), key=lambda l: l.key)
        ]
    )


@app.get(
    "/problems",
    response_model=ProblemList,
    tags=["Metadata"],
    dependencies=[Depends(require_token)],
)
def list_problems() -> ProblemList:
    found = []
    for problem_id in sorted(services.store.ids()):
        try:
            described = services.store.describe(
                problem_id,
                validated=_is_validated(problem_id),
            )
        except (ProblemNotFound, ProblemBroken, OSError) as exc:
            # One broken problem must not hide the other 24.
            log.warning("skipping problem %s: %s", problem_id, exc)
            continue
        found.append(ProblemInfo(**described))
    return ProblemList(problems=found)


@app.get(
    "/problems/{problem_id}",
    response_model=ProblemInfo,
    tags=["Metadata"],
    dependencies=[Depends(require_token)],
)
def get_problem(problem_id: str) -> ProblemInfo:
    _reject_bad_id(problem_id)
    try:
        described = services.store.describe(
            problem_id, validated=_is_validated(problem_id)
        )
    except ProblemNotFound:
        raise errors.problem_not_found(problem_id) from None
    except (ProblemBroken, OSError) as exc:
        raise errors.invalid_request(str(exc)) from None
    return ProblemInfo(**described)


@app.post(
    "/problems/{problem_id}/validate",
    response_model=ValidationReport,
    tags=["Metadata"],
    dependencies=[Depends(require_token)],
)
def validate_problem(problem_id: str, body: ValidateRequest | None = None, version: str | None = None) -> ValidationReport:
    """`version` validates an uploaded-but-unpublished version, so a problem
    can be proven before it goes live (US-B8-01)."""
    _reject_bad_id(problem_id)
    body = body or ValidateRequest()
    problem = _load_problem(problem_id, version)

    language = None
    if body.reference_source or body.wrong_source:
        if not body.language:
            raise errors.invalid_request("language is required when a solution is supplied")
        language = languages.get(body.language)
        if language is None:
            raise errors.unknown_language(body.language, languages.keys())

    try:
        return services.validator.validate(
            problem,
            reference_source=body.reference_source,
            wrong_source=body.wrong_source,
            language=language,
        )
    except SandboxUnavailable:
        raise errors.sandbox_unavailable(services.sandbox.url) from None


@app.get(
    "/problems/{problem_id}/testcases/{index}",
    response_model=Testcase,
    tags=["Metadata"],
    dependencies=[Depends(require_token)],
)
def get_testcase(problem_id: str, index: int, version: str | None = None) -> Testcase:
    """Administrators only. Never expose this to contestants (US-J5-03).

    Always pass `version`, taken from the submission's `problem_version`: after
    a mid-contest edit the current testcase is not the one they failed on.
    """
    _reject_bad_id(problem_id)
    if index < 0:
        raise errors.invalid_request("index must be zero or greater")

    problem = _load_problem(problem_id, version)
    if index >= problem.total:
        raise errors.problem_not_found(f"{problem_id} testcase {index}")

    testcase = problem.testcases[index]
    cap = settings.testcase_response_bytes
    try:
        input_text = services.storage.read_text(testcase.input_key)
        answer_text = services.storage.read_text(testcase.answer_key)
    except (OSError, UnicodeDecodeError) as exc:
        raise errors.invalid_request(f"cannot read testcase {index}: {exc}") from None

    truncated = len(input_text) > cap or len(answer_text) > cap
    return Testcase(
        problem_id=problem_id,
        index=index,
        version=problem.version,
        input=input_text[:cap],
        answer=answer_text[:cap],
        truncated=truncated,
    )


# --- judging ---------------------------------------------------------------


@app.post(
    "/submit",
    response_model=JobHandle,
    status_code=202,
    tags=["Judging"],
    dependencies=[Depends(require_token)],
)
def submit(body: SubmitRequest) -> JobHandle:
    size = len(body.source.encode("utf-8"))
    if size > settings.max_source_bytes:
        raise errors.source_too_large(size, settings.max_source_bytes)

    language = languages.get(body.language)
    if language is None:
        raise errors.unknown_language(body.language, languages.keys())

    problem = _load_problem(body.problem_id)
    _require_capacity()

    job = services.queue.submit(problem, language, body.source, body.submission_id)
    return JobHandle(job_id=job.job_id, submission_id=job.submission_id)


@app.post(
    "/hack",
    response_model=JobHandle,
    status_code=202,
    tags=["Judging"],
    dependencies=[Depends(require_token)],
)
def hack(body: HackRequest) -> JobHandle:
    """Does this input break the given solution? (US-J7-01)"""
    _check_size(body.source, settings.max_source_bytes, errors.source_too_large)
    _check_size(body.input, settings.max_input_bytes, errors.input_too_large)

    language = languages.get(body.language)
    if language is None:
        raise errors.unknown_language(body.language, languages.keys())

    problem = _load_problem(body.problem_id, body.version)
    if not problem.has_reference:
        raise errors.invalid_request(
            f"{body.problem_id} has no reference solution, so it cannot be hacked"
        )
    _require_capacity()

    def work(on_progress, is_cancelled):
        return run_hack(
            services.judge, services.python, services.storage,
            problem, language, body.source, body.input, body.submission_id,
        )

    def on_error(message):
        return HackResult(
            submission_id=body.submission_id, valid_input=True, hacked=None,
            verdict="IE", message=message, problem_version=problem.version,
        )

    job = services.queue.submit_work(3, body.submission_id, work, on_error)
    return JobHandle(job_id=job.job_id, submission_id=job.submission_id)


@app.post(
    "/validate-answers",
    response_model=JobHandle,
    status_code=202,
    tags=["Judging"],
    dependencies=[Depends(require_token)],
)
def validate_answers(body: AnswersRequest) -> JobHandle:
    """Score a list of answers with a supplied validator (US-J7-03)."""
    _check_size(body.validator, settings.max_source_bytes, errors.source_too_large)
    _check_size("\n".join(body.entries), settings.max_input_bytes, errors.input_too_large)
    _require_capacity()

    def work(on_progress, is_cancelled):
        started = time.monotonic()
        results, message = services.python.score_entries(body.validator, body.entries)
        elapsed = int((time.monotonic() - started) * 1000)
        if results is None:
            return AnswersResult(submission_id=body.submission_id, status="IE",
                                 message=message, duration_ms=elapsed)
        return AnswersResult(
            submission_id=body.submission_id,
            status="ok",
            results=[EntryResult(valid=bool(r.get("valid")), error=r.get("error")) for r in results],
            message=message,
            duration_ms=elapsed,
        )

    def on_error(message):
        return AnswersResult(submission_id=body.submission_id, status="IE", message=message)

    job = services.queue.submit_work(1, body.submission_id, work, on_error)
    return JobHandle(job_id=job.job_id, submission_id=job.submission_id)


@app.get(
    "/jobs/{job_id}",
    response_model=JobState,
    tags=["Judging"],
    dependencies=[Depends(require_token)],
)
def get_job(job_id: str) -> JobState:
    job = services.queue.get(job_id)
    if job is None:
        raise errors.job_not_found(job_id)
    return JobState(
        job_id=job.job_id,
        submission_id=job.submission_id,
        state=job.state,
        progress=Progress(done=job.done, total=job.total),
        poll_after_ms=job.poll_after_ms(),
        result=job.result,
    )


@app.delete(
    "/jobs/{job_id}",
    status_code=204,
    tags=["Judging"],
    dependencies=[Depends(require_token)],
)
def cancel_job(job_id: str) -> Response:
    if not services.queue.cancel(job_id):
        raise errors.job_not_found(job_id)
    return Response(status_code=204)


# --- helpers ---------------------------------------------------------------


def _reject_bad_id(problem_id: str) -> None:
    """The path pattern in the spec, enforced before touching the filesystem."""
    if not problem_id or not all(c.isalnum() or c in "._-" for c in problem_id):
        raise errors.problem_not_found(problem_id)


def _load_problem(problem_id: str, version: str | None = None):
    _reject_bad_id(problem_id)
    try:
        return services.store.load(problem_id, version)
    except ProblemNotFound:
        raise errors.problem_not_found(problem_id) from None
    except ProblemBroken as exc:
        raise errors.invalid_request(str(exc)) from None
    except OSError as exc:
        raise errors.invalid_request(f"cannot read problem {problem_id}: {exc}") from None


def _check_size(text: str, limit: int, make_error) -> None:
    size = len(text.encode("utf-8"))
    if size > limit:
        raise make_error(size, limit)


def _require_capacity() -> None:
    """Refuse rather than accept a job we cannot run.

    A verdict must never be recorded against a participant because the sandbox
    was down (US-J2-02), and a full queue answers 429 with Retry-After (US-J6-03).
    """
    if not services.sandbox.reachable():
        raise errors.sandbox_unavailable(services.sandbox.url)
    if not services.queue.has_room():
        raise errors.busy(services.queue.counts()[1], services.queue.queue_limit)


def _is_validated(problem_id: str) -> bool:
    try:
        version = services.store.resolve_version(problem_id)
    except (ProblemNotFound, OSError):
        return False
    return services.registry.is_validated(problem_id, version)
