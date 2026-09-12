"""The complete set of errors this service returns.

Every one maps to an `error` code in the OpenAPI spec's Error schema. Raising
ApiError anywhere in the call stack produces the right JSON body and status,
so no handler needs to build error responses by hand.
"""
from __future__ import annotations


class ApiError(Exception):
    """An error the caller should see, with its HTTP status already decided."""

    def __init__(self, status: int, code: str, message: str, headers: dict | None = None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.headers = headers or {}


def invalid_request(message: str) -> ApiError:
    return ApiError(400, "invalid_request", message)


def unknown_language(language: str, available: list[str]) -> ApiError:
    return ApiError(
        400,
        "unknown_language",
        f"unknown language {language!r}; available: {', '.join(sorted(available))}",
    )


def source_too_large(size: int, limit: int) -> ApiError:
    return ApiError(
        400, "source_too_large", f"source is {size} bytes; the limit is {limit}"
    )


def unauthorized() -> ApiError:
    return ApiError(401, "unauthorized", "invalid or missing bearer token")


def problem_not_found(problem_id: str) -> ApiError:
    return ApiError(404, "problem_not_found", f"no such problem: {problem_id}")


def job_not_found(job_id: str) -> ApiError:
    return ApiError(
        404, "job_not_found", f"no such job: {job_id} (expired or judge restarted)"
    )


def busy(queued: int, limit: int, retry_after_s: int = 5) -> ApiError:
    return ApiError(
        429,
        "busy",
        f"judge at capacity ({queued}/{limit} queued), retry shortly",
        headers={"Retry-After": str(retry_after_s)},
    )


def sandbox_unavailable(url: str) -> ApiError:
    return ApiError(503, "sandbox_unavailable", f"cannot reach go-judge at {url}")
