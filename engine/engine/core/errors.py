"""Every failure the engine reports on purpose.

An EngineError carries the HTTP status and a stable machine code, so the API
layer turns it into `{ "error": code, "message": message }` without deciding
anything itself. Anything that is not an EngineError is a bug and becomes a 500.
"""

from __future__ import annotations


class EngineError(Exception):
    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


def invalid(message: str) -> EngineError:
    return EngineError(400, "invalid_request", message)


def unauthorized() -> EngineError:
    return EngineError(401, "unauthorized", "sign in required")


def forbidden(message: str = "not allowed") -> EngineError:
    return EngineError(403, "forbidden", message)


def not_found(what: str) -> EngineError:
    return EngineError(404, "not_found", f"{what} not found")


def conflict(code: str, message: str) -> EngineError:
    return EngineError(409, code, message)
