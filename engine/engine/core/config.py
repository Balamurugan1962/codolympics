"""Settings, read once from the environment."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _required(name: str) -> str:
    value = os.environ.get(name, "")
    if not value:
        raise RuntimeError(f"{name} must be set")
    return value


@dataclass(frozen=True)
class Settings:
    database_url: str
    judge_url: str
    judge_token: str
    problems_dir: Path
    # Signs Better Auth's session cookie. Shared with the web app, which issues it.
    auth_secret: str
    # Proves a request came from the web app and not from anything else on the network.
    service_token: str
    admin_username: str
    admin_password: str
    scheduler_interval_s: float


def _sqlalchemy_url(url: str) -> str:
    """Accept the plain `postgres://` URL the rest of the stack uses."""
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix) :]
    return url


def load() -> Settings:
    return Settings(
        database_url=_sqlalchemy_url(
            os.environ.get("DATABASE_URL", "postgres://contest:contest@localhost:5432/contest")
        ),
        judge_url=os.environ.get("JUDGE_URL", "http://localhost:8000").rstrip("/"),
        judge_token=os.environ.get("JUDGE_SERVICE_TOKEN", ""),
        problems_dir=Path(os.environ.get("PROBLEMS_DIR", "../judge/problems")).resolve(),
        auth_secret=_required("BETTER_AUTH_SECRET"),
        service_token=_required("ENGINE_SERVICE_TOKEN"),
        admin_username=os.environ.get("ADMIN_USERNAME", "admin"),
        admin_password=os.environ.get("ADMIN_PASSWORD", ""),
        scheduler_interval_s=float(os.environ.get("SCHEDULER_INTERVAL_S", "1")),
    )


settings = load()
