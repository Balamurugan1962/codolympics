"""Who is calling.

Two checks, in this order, on every request:

1. The request came through the web app. The engine publishes no ports, and
   the web app adds `x-engine-token` when it forwards a request. Anything else
   on the network is refused before a route runs (see main.py).

2. Which person it is on behalf of. Better Auth, in the web app, signs people
   in and sets the `better-auth.session_token` cookie, whose value is
   `<token>.<base64 HMAC-SHA256(token, BETTER_AUTH_SECRET)>`. The engine checks
   that signature with the same secret, then looks the token up in the session
   table. Sessions live in Postgres, so signing out -- or signing in again
   somewhere else, which deletes a participant's other sessions -- takes effect
   on the very next request.

Roles are enforced here, on the server, for every route: hiding a button is
never the control.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
from collections.abc import Callable
from typing import Annotated
from urllib.parse import unquote

from fastapi import Depends, Request

from engine.accounts.viewer import Viewer, viewer_for_session_token
from engine.core import errors
from engine.core.config import settings

COOKIE_NAMES = ("__Secure-better-auth.session_token", "better-auth.session_token")


def session_token(request: Request) -> str | None:
    """The verified session token from the cookie, or None if absent or forged."""
    raw = next((request.cookies[name] for name in COOKIE_NAMES if request.cookies.get(name)), None)
    if raw is None:
        return None
    token, _, signature = unquote(raw).rpartition(".")
    if not token or not signature:
        return None
    digest = hmac.new(settings.auth_secret.encode(), token.encode(), hashlib.sha256).digest()
    expected = base64.b64encode(digest).decode()
    return token if hmac.compare_digest(expected, signature) else None


def current_viewer(request: Request) -> Viewer:
    token = session_token(request)
    viewer = viewer_for_session_token(token) if token else None
    if viewer is None:
        raise errors.unauthorized()
    return viewer


def require(*roles: str) -> Callable[[Request], Viewer]:
    """A dependency that admits a signed-in viewer, and only in one of `roles` if any are given."""

    def dependency(request: Request) -> Viewer:
        viewer = current_viewer(request)
        if roles and viewer.role not in roles:
            raise errors.forbidden()
        return viewer

    return dependency


SignedIn = Annotated[Viewer, Depends(require())]
Participant = Annotated[Viewer, Depends(require("participant"))]
Staff = Annotated[Viewer, Depends(require("admin", "evaluator"))]
Admin = Annotated[Viewer, Depends(require("admin"))]
