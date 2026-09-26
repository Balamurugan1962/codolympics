"""The standings in GET /api/state are shared for a second, never longer than the truth allows."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from conftest import add_user, set_contest

from engine import state
from engine.accounts.viewer import Viewer
from engine.core import events


@pytest.fixture(autouse=True)
def fresh_cache(monkeypatch: pytest.MonkeyPatch) -> list[int]:
    state._standings_held = None
    calls: list[int] = [0]
    real = state.phase2_standings

    def counting(conn, frozen_at=None):
        calls[0] += 1
        return real(conn, frozen_at)

    monkeypatch.setattr(state, "phase2_standings", counting)
    return calls


def _viewer(user_id: str) -> Viewer:
    return Viewer(id=user_id, name=user_id, username=user_id, role="participant")


def _final() -> None:
    set_contest(phase="final", leaderboard_mode="live")


def test_everyone_in_the_same_second_shares_one_calculation(fresh_cache: list[int]) -> None:
    for name in ("alice", "bob", "carol"):
        add_user(name)
    _final()
    ranks = [state.state_for(_viewer(n))["rank"] for n in ("alice", "bob", "carol")]
    assert fresh_cache[0] == 1
    assert all(r is not None for r in ranks)  # each still gets their own row
    assert len({r["participant_id"] for r in ranks}) == 3


def test_an_event_ends_the_reuse_at_once(fresh_cache: list[int]) -> None:
    add_user("alice")
    _final()
    state.state_for(_viewer("alice"))
    events.publish("verdict", {"state": "done"}, None)
    state.state_for(_viewer("alice"))
    assert fresh_cache[0] == 2


def test_it_is_not_reused_past_the_limit(
    fresh_cache: list[int], monkeypatch: pytest.MonkeyPatch
) -> None:
    add_user("alice")
    _final()
    clock = [1000.0]
    monkeypatch.setattr(state.time, "monotonic", lambda: clock[0])
    state.state_for(_viewer("alice"))
    clock[0] += 0.5
    state.state_for(_viewer("alice"))
    assert fresh_cache[0] == 1
    clock[0] += 0.6
    state.state_for(_viewer("alice"))
    assert fresh_cache[0] == 2


def test_the_freeze_point_is_part_of_the_key(fresh_cache: list[int]) -> None:
    add_user("alice")
    _final()
    state.state_for(_viewer("alice"))
    set_contest(leaderboard_mode="frozen", leaderboard_frozen_at=datetime.now(UTC))
    state.state_for(_viewer("alice"))
    assert fresh_cache[0] == 2
