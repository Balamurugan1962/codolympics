"""Every endpoint except /health requires the shared service token (US-J6-01)."""
from __future__ import annotations

import secrets

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.api import errors
from app.api.deps import Svc

bearer = HTTPBearer(auto_error=False)


def require_token(
    services: Svc,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> None:
    expected = services.settings.service_token
    if not expected:
        # No token configured means the service is misconfigured, not open.
        raise errors.unauthorized()
    if credentials is None or not secrets.compare_digest(credentials.credentials, expected):
        raise errors.unauthorized()
