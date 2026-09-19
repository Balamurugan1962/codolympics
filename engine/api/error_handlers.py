"""Every error the API returns has one shape: `{ "error": code, "message": message }`.

Errors the engine raises on purpose carry their own status and code. A request
that fails validation is a 400 naming the first bad field. Anything else is a bug
and becomes a logged 500.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from starlette.exceptions import HTTPException

from engine.core.errors import EngineError

log = logging.getLogger("api")


def error_response(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse({"error": code, "message": message}, status_code=status)


async def engine_error(_: Request, err: EngineError) -> JSONResponse:
    return error_response(err.status, err.code, err.message)


async def invalid_request(
    _: Request, err: RequestValidationError | ValidationError
) -> JSONResponse:
    first = err.errors()[0]
    location = [str(part) for part in first["loc"] if part not in ("body", "query", "path")]
    field = ".".join(location) or "body"
    return error_response(400, "invalid_request", f"{field}: {first['msg']}")


async def http_error(_: Request, err: HTTPException) -> JSONResponse:
    if err.status_code == 404:
        return error_response(404, "not_found", "route not found")
    if err.status_code == 405:
        return error_response(405, "method_not_allowed", "that method is not allowed here")
    return error_response(err.status_code, "error", str(err.detail))


async def unexpected_error(_: Request, err: Exception) -> JSONResponse:
    log.exception("unhandled error", exc_info=err)
    return error_response(500, "internal_error", "something went wrong on the server")


def register(app: FastAPI) -> None:
    app.add_exception_handler(EngineError, engine_error)
    app.add_exception_handler(RequestValidationError, invalid_request)
    # Raised by routes that validate a body themselves, because its shape depends on the path.
    app.add_exception_handler(ValidationError, invalid_request)
    app.add_exception_handler(HTTPException, http_error)
    app.add_exception_handler(Exception, unexpected_error)
