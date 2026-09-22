"""The HTTP layer: the service token, the session cookie, roles, and the error shape."""

from __future__ import annotations

import base64
import hashlib
import hmac
from datetime import UTC, datetime, timedelta
from urllib.parse import quote

import pytest
import sqlalchemy as sa
from conftest import add_user
from fastapi.testclient import TestClient

from api.main import app
from engine.core import db
from engine.core.config import settings
from engine.schema import session

client = TestClient(app)  # not entered as a context manager: no scheduler thread in tests
TOKEN = {"x-engine-token": settings.service_token}


def sign_in(user_id: str, *, expired: bool = False) -> str:
    """A session row and the cookie value Better Auth would have set for it."""
    token = f"token-{user_id}"
    lifetime = timedelta(hours=-1 if expired else 1)
    expires = datetime.now(UTC).replace(tzinfo=None) + lifetime
    with db.transaction() as conn:
        conn.execute(
            sa.insert(session).values(
                id=f"s-{user_id}",
                token=token,
                user_id=user_id,
                expires_at=expires,
                updated_at=expires,
            )
        )
    digest = hmac.new(settings.auth_secret.encode(), token.encode(), hashlib.sha256).digest()
    signature = base64.b64encode(digest).decode()
    return quote(f"{token}.{signature}", safe="")


def get(path: str, cookie: str | None = None, headers: dict[str, str] | None = None):
    cookies = {"better-auth.session_token": cookie} if cookie else {}
    return client.get(path, headers=headers if headers is not None else TOKEN, cookies=cookies)


def test_requests_without_the_service_token_are_refused() -> None:
    response = get("/api/state", headers={})
    assert response.status_code == 403 and response.json()["error"] == "forbidden"


def test_health_needs_no_token() -> None:
    assert client.get("/health").json() == {"status": "ok"}


def test_no_cookie_is_unauthorised() -> None:
    assert get("/api/state").json() == {"error": "unauthorized", "message": "sign in required"}


def test_a_forged_signature_is_unauthorised() -> None:
    add_user("alice")
    good = sign_in("alice")
    assert get("/api/state", cookie=good[:-6] + "AAAAAA").status_code == 401


def test_an_expired_session_is_unauthorised() -> None:
    add_user("alice")
    assert get("/api/state", cookie=sign_in("alice", expired=True)).status_code == 401


def test_a_valid_session_reads_state_with_an_event_cursor() -> None:
    add_user("alice", "Alice")
    body = get("/api/state", cookie=sign_in("alice")).json()
    assert body["viewer"] == {
        "id": "alice",
        "name": "Alice",
        "username": "Alice",
        "role": "participant",
    }
    assert body["me"]["balance"] == 1000 and isinstance(body["event_cursor"], int)


@pytest.mark.parametrize("path", ["/api/admin/contest", "/api/grade/queue"])
def test_participants_are_forbidden_from_staff_routes(path: str) -> None:
    add_user("alice")
    assert get(path, cookie=sign_in("alice")).status_code == 403


def test_an_evaluator_may_read_but_not_change_the_contest() -> None:
    add_user("eve", role="evaluator", balance=None)
    cookie = sign_in("eve")
    assert get("/api/admin/contest", cookie=cookie).status_code == 200
    response = client.patch(
        "/api/admin/contest",
        json={"reason": "try", "bid_increment": 5},
        headers=TOKEN,
        cookies={"better-auth.session_token": cookie},
    )
    assert response.status_code == 403


def test_a_malformed_body_is_a_400_naming_the_field() -> None:
    add_user("alice")
    response = client.post(
        "/api/bids",
        json={"lot_id": "one", "amount": 100},
        headers=TOKEN,
        cookies={"better-auth.session_token": sign_in("alice")},
    )
    assert response.status_code == 400
    body = response.json()
    assert body["error"] == "invalid_request" and body["message"].startswith("lot_id")


def test_an_engine_refusal_keeps_its_code_and_status() -> None:
    add_user("alice")
    response = client.post(
        "/api/bids",
        json={"lot_id": 99, "amount": 100},
        headers=TOKEN,
        cookies={"better-auth.session_token": sign_in("alice")},
    )
    assert (response.status_code, response.json()["error"]) == (404, "not_found")


def test_an_unknown_route_is_a_json_404() -> None:
    assert get("/api/nothing-here").json()["error"] == "not_found"


# --- locked out for leaving the page ------------------------------------------


def post(path: str, cookie: str, json: dict | None = None):
    return client.post(
        path, json=json or {}, headers=TOKEN, cookies={"better-auth.session_token": cookie}
    )


def test_alerts_count_up_and_then_lock_out_every_write() -> None:
    add_user("alice")
    cookie = sign_in("alice")
    seen = [
        post("/api/proctor/alert", cookie, {"kind": k}).json() for k in ("blur", "hidden", "blur")
    ]
    assert [s["alerts"] for s in seen] == [1, 2, 3]
    assert all(s["locked"] is False for s in seen)

    locked = post("/api/proctor/alert", cookie, {"kind": "fullscreen"}).json()
    assert locked == {"enabled": True, "alerts": 4, "warnings": 3, "locked": True}
    # Reads still work, so the page can show the locked screen; every write is refused.
    assert get("/api/state", cookie).json()["me"]["proctor"]["locked"] is True
    refused = post("/api/bids", cookie, {"lot_id": 1, "amount": 100})
    assert (refused.status_code, refused.json()["error"]) == (409, "locked")
    # Reporting again while locked changes nothing.
    assert post("/api/proctor/alert", cookie, {"kind": "blur"}).json()["alerts"] == 4


def test_only_an_administrator_unlocks_and_the_count_starts_again() -> None:
    add_user("alice")
    add_user("root", role="admin", balance=None)
    alice, root = sign_in("alice"), sign_in("root")
    for _ in range(4):
        post("/api/proctor/alert", alice, {"kind": "blur"})
    assert post("/api/admin/participants/alice/unlock", alice, {"reason": "me"}).status_code == 403

    freed = post("/api/admin/participants/alice/unlock", root, {"reason": "spoke to them"})
    assert freed.status_code == 200
    me = get("/api/state", alice).json()["me"]["proctor"]
    assert me == {"enabled": True, "alerts": 0, "warnings": 3, "locked": False}
    again = post("/api/admin/participants/alice/unlock", root, {"reason": "twice"})
    assert again.json()["error"] == "not_locked"


def test_alerts_are_not_counted_while_supervision_is_off() -> None:
    add_user("alice")
    with db.transaction() as conn:
        conn.execute(sa.text("update contest set proctoring = false"))
    state = post("/api/proctor/alert", sign_in("alice"), {"kind": "blur"}).json()
    assert state == {"enabled": False, "alerts": 0, "warnings": 3, "locked": False}
