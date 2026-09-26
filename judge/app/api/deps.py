"""What routes need before they can do their job: the services, a loaded
problem, a known language, room in the queue."""
from __future__ import annotations

import re
from typing import Annotated, Callable

from fastapi import Depends, Request

from app.api import errors
from app.api.errors import ApiError
from app.container import Services
from app.core import languages
from app.core.languages import Language
from app.core.problem import ID_PATTERN, Problem, ProblemBroken, ProblemNotFound


def get_services(request: Request) -> Services:
    return request.app.state.services


Svc = Annotated[Services, Depends(get_services)]


def reject_bad_id(problem_id: str) -> None:
    """The path pattern in the spec, enforced before touching the filesystem."""
    if not re.fullmatch(ID_PATTERN, problem_id):
        raise errors.problem_not_found(problem_id)


def load_problem(services: Services, problem_id: str, version: str | None = None) -> Problem:
    reject_bad_id(problem_id)
    try:
        return services.store.load(problem_id, version)
    except ProblemNotFound:
        raise errors.problem_not_found(problem_id) from None
    except ProblemBroken as exc:
        raise errors.invalid_request(str(exc)) from None
    except OSError as exc:
        raise errors.invalid_request(f"cannot read problem {problem_id}: {exc}") from None


def language_or_400(key: str) -> Language:
    language = languages.get(key)
    if language is None:
        raise errors.unknown_language(key, languages.keys())
    return language


def check_size(text: str, limit: int, make_error: Callable[[int, int], ApiError]) -> None:
    size = len(text.encode("utf-8"))
    if size > limit:
        raise make_error(size, limit)


def require_capacity(services: Services, pool: str = "main") -> None:
    """Refuse rather than accept a job we cannot run.

    A verdict must never be recorded against a participant because the sandbox
    was down (US-J2-02), and a full queue answers 429 with Retry-After (US-J6-03).
    """
    if not services.sandbox.reachable():
        raise errors.sandbox_unavailable(services.sandbox.url)
    if not services.queue.has_room(pool):
        raise errors.busy(services.queue.counts(pool)[1], services.queue.limit(pool))
