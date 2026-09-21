"""Submitting work and polling for its result."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Response

from app.api import errors
from app.api.auth import require_token
from app.api.deps import Svc, check_size, language_or_400, load_problem, require_capacity
from app.api.schemas import AnswersRequest, HackRequest, JobHandle, JobState, Progress, RunRequest, SubmitRequest
from app.container import Services
from app.jobs.control import Task
from app.jobs.queue import Job
from app.judging.judge import Submission
from app.judging.run import RunInput
from app.judging.tasks import AnswersTask, HackTask, JudgeTask, RunTask

router = APIRouter(tags=["Judging"], dependencies=[Depends(require_token)])


@router.post("/submit", response_model=JobHandle, status_code=202)
def submit(body: SubmitRequest, services: Svc) -> JobHandle:
    check_size(body.source, services.settings.max_source_bytes, errors.source_too_large)
    language = language_or_400(body.language)
    problem = load_problem(services, body.problem_id)
    submission = Submission(problem, language, body.source, body.submission_id)
    return _enqueue(services, JudgeTask(services.judge, submission))


@router.post("/hack", response_model=JobHandle, status_code=202)
def hack(body: HackRequest, services: Svc) -> JobHandle:
    """Does this input break the given solution? (US-J7-01)"""
    check_size(body.source, services.settings.max_source_bytes, errors.source_too_large)
    check_size(body.input, services.settings.max_input_bytes, errors.input_too_large)
    language = language_or_400(body.language)
    problem = load_problem(services, body.problem_id, body.version)
    if not problem.has_reference:
        raise errors.invalid_request(f"{body.problem_id} has no reference solution, so it cannot be hacked")
    submission = Submission(problem, language, body.source, body.submission_id)
    return _enqueue(services, HackTask(services.hacker, submission, body.input))


@router.post("/run", response_model=JobHandle, status_code=202)
def run(body: RunRequest, services: Svc) -> JobHandle:
    """Run source on the caller's inputs, with no testcases and no score."""
    check_size(body.source, services.settings.max_source_bytes, errors.source_too_large)
    check_size("\n".join(c.input for c in body.inputs), services.settings.max_input_bytes, errors.input_too_large)
    language = language_or_400(body.language)
    problem = load_problem(services, body.problem_id)
    submission = Submission(problem, language, body.source, body.submission_id)
    inputs = services.runner.samples(problem, body.samples) + [RunInput(c.input, c.answer) for c in body.inputs]
    if not inputs:
        raise errors.invalid_request("nothing to run: the problem has no samples and no input was given")
    return _enqueue(services, RunTask(services.runner, submission, inputs))


@router.post("/validate-answers", response_model=JobHandle, status_code=202)
def validate_answers(body: AnswersRequest, services: Svc) -> JobHandle:
    """Score a list of answers with a supplied validator (US-J7-03)."""
    check_size(body.validator, services.settings.max_source_bytes, errors.source_too_large)
    check_size("\n".join(body.entries), services.settings.max_input_bytes, errors.input_too_large)
    return _enqueue(services, AnswersTask(services.scorer, body.validator, body.entries, body.submission_id))


@router.get("/jobs/{job_id}", response_model=JobState)
def get_job(job_id: str, services: Svc) -> JobState:
    job = _job_or_404(services, job_id)
    return JobState(
        job_id=job.job_id,
        submission_id=job.submission_id,
        state=job.state,
        progress=Progress(done=job.done, total=job.total),
        poll_after_ms=job.poll_after_ms(),
        result=job.result,
    )


@router.delete("/jobs/{job_id}", status_code=204)
def cancel_job(job_id: str, services: Svc) -> Response:
    if not services.queue.cancel(job_id):
        raise errors.job_not_found(job_id)
    return Response(status_code=204)


def _enqueue(services: Services, task: Task) -> JobHandle:
    """Queue a task once the request is known to be runnable."""
    require_capacity(services)
    job = services.queue.submit(task)
    return JobHandle(job_id=job.job_id, submission_id=job.submission_id)


def _job_or_404(services: Services, job_id: str) -> Job:
    job = services.queue.get(job_id)
    if job is None:
        raise errors.job_not_found(job_id)
    return job
