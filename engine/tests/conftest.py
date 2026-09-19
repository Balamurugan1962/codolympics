"""Shared fixtures and helpers for the database tests.

They run against a real Postgres, and only one whose name says it is for testing.

    DATABASE_URL=postgres://contest:contest@localhost:5432/contest_engine_test .venv/bin/pytest

The suites truncate every table a contest run writes to. That is correct for a
scratch database and catastrophic for a live one -- a live contest has already
lost its auction to a test run pointed at the wrong database -- so the check is
here rather than in anyone's memory.
"""

from __future__ import annotations

import os
import re
import threading
from collections.abc import Callable, Iterator
from concurrent.futures import ThreadPoolExecutor
from typing import Any
from urllib.parse import urlparse

import pytest

os.environ.setdefault(
    "DATABASE_URL", "postgres://contest:contest@localhost:5432/contest_engine_test"
)
os.environ.setdefault("BETTER_AUTH_SECRET", "test-secret")
os.environ.setdefault("ENGINE_SERVICE_TOKEN", "test-service-token")
os.environ.setdefault("PROBLEMS_DIR", "/tmp/contest-engine-test-problems")

_db_name = urlparse(os.environ["DATABASE_URL"]).path.lstrip("/")
if (
    not re.search(r"(^|[_-])test([_-]|$)|^test|_scratch$|_ci$", _db_name)
    and os.environ.get("I_KNOW_THIS_DESTROYS_DATA") != "yes"
):
    raise RuntimeError(
        f'refusing to run the database tests against "{_db_name}": '
        "its name must say it is for testing"
    )

import sqlalchemy as sa  # noqa: E402

from engine.core import db, errors  # noqa: E402
from engine.migrate import main as migrate  # noqa: E402
from engine.schema import contest, participant, question, user  # noqa: E402

# fmt: off
RUN_TABLES = (
    "event", "bid", "lot", "ownership", "hint_purchase", "ledger", "judgement", "submission",
    "draft", "notification", "announcement", "audit_log", "p1_answer", "p1_hack_attempt",
    "p1_advancement", "powerup_event", "powerup_inventory", "blackout", "participant", "hint",
    "question", "p1_question", "p1_hack_question", "powerup", "session", "account",
)
# fmt: on


@pytest.fixture(scope="session", autouse=True)
def schema() -> None:
    migrate()


@pytest.fixture(autouse=True)
def clean(schema: None) -> Iterator[None]:
    with db.transaction() as conn:
        names = ", ".join(f'"{t}"' for t in RUN_TABLES)
        conn.execute(sa.text(f"truncate table {names} restart identity cascade"))
        conn.execute(sa.delete(user))
        conn.execute(sa.text("insert into contest (id) values (1) on conflict do nothing"))
        conn.execute(
            sa.update(contest).values(
                phase="registration",
                phase_ends_at=None,
                registration_open=True,
                auction_paused_at=None,
                auction_mode="online",
                marketplace_open=False,
                bid_increment=10,
                countdown_seconds=60,
                opening_window_seconds=60,
                ownership_cap=None,
                leaderboard_mode="live",
                leaderboard_frozen_at=None,
                starting_balance=1000,
            )
        )
    yield


def set_contest(**values: Any) -> None:
    with db.transaction() as conn:
        conn.execute(sa.update(contest).values(**values))


def add_user(
    user_id: str, name: str | None = None, role: str = "participant", balance: int | None = 1000
) -> str:
    with db.transaction() as conn:
        conn.execute(
            sa.insert(user).values(
                id=user_id,
                name=name or user_id,
                email=f"{user_id}@t.invalid",
                email_verified=True,
                role=role,
                created_at=sa.func.now(),
                updated_at=sa.func.now(),
            )
        )
        if role == "participant" and balance is not None:
            conn.execute(sa.insert(participant).values(user_id=user_id, balance=balance))
    return user_id


def add_question(
    question_id: str, order: int = 1, base_price: int = 100, score: int = 100, topic: str = "Graphs"
) -> str:
    with db.transaction() as conn:
        conn.execute(
            sa.insert(question).values(
                id=question_id,
                title=question_id,
                topic=topic,
                difficulty="easy",
                score=score,
                base_price=base_price,
                auction_order=order,
            )
        )
    return question_id


def scalar(query: Any) -> Any:
    with db.transaction() as conn:
        return conn.execute(query).scalar()


def rows(query: Any) -> list[sa.Row]:
    with db.transaction() as conn:
        return conn.execute(query).all()


def balance_of(participant_id: str) -> int:
    return scalar(sa.select(participant.c.balance).where(participant.c.user_id == participant_id))


def at_once(calls: list[Callable[[], Any]]) -> list[Any]:
    """Run every call in its own thread, released together.

    Returns each call's result, or the exception it raised.
    """
    gate = threading.Barrier(len(calls))

    def run(call: Callable[[], Any]) -> Any:
        gate.wait()
        try:
            return call()
        except Exception as err:  # collected, so the test can assert on who failed and why
            return err

    with ThreadPoolExecutor(max_workers=len(calls)) as pool:
        return list(pool.map(run, calls))


def codes(results: list[Any]) -> list[str]:
    return sorted(r.code for r in results if isinstance(r, errors.EngineError))


def raises_code(code: str, call: Callable[[], Any]) -> None:
    with pytest.raises(errors.EngineError) as caught:
        call()
    assert caught.value.code == code, caught.value.message
