"""Submissions and the judge poller, with the judge replaced by a fake that answers on command."""

from __future__ import annotations

import itertools
import threading
from typing import Any

import pytest
import sqlalchemy as sa
from conftest import add_question, add_user, at_once, codes, raises_code, rows, scalar, set_contest

from engine.coding import judging, rejudge, submissions
from engine.core import db
from engine.judge import client as judge_client
from engine.judge import languages
from engine.schema import judgement, ownership, participant


class FakeJudge:
    """Records every job it is sent and reports whatever the test says about each."""

    def __init__(self) -> None:
        self.sent: list[str] = []
        self.states: dict[str, dict[str, Any]] = {}
        self.cancelled: list[str] = []
        self._ids = itertools.count(1)
        self._lock = threading.Lock()

    def submit(self, **request: Any) -> str:
        with self._lock:
            job_id = f"job-{next(self._ids)}"
            self.sent.append(request["submission_id"])
        self.states[job_id] = {
            "state": "queued",
            "progress": {"done": 0, "total": 3},
            "result": None,
        }
        return job_id

    def job(self, job_id: str) -> dict[str, Any]:
        return self.states[job_id]

    def cancel(self, job_id: str) -> None:
        self.cancelled.append(job_id)

    def finish(self, job_id: str, verdict: str) -> None:
        result = {
            "verdict": verdict,
            "passed": 3 if verdict == "AC" else 0,
            "total": 3,
            "message": verdict,
            "problem_version": "v1",
        }
        self.states[job_id] = {
            "state": "done",
            "progress": {"done": 3, "total": 3},
            "result": result,
        }


@pytest.fixture
def judge(monkeypatch: pytest.MonkeyPatch) -> FakeJudge:
    fake = FakeJudge()
    monkeypatch.setattr(judge_client, "submit", fake.submit)
    monkeypatch.setattr(judge_client, "job", fake.job)
    monkeypatch.setattr(judge_client, "cancel", fake.cancel)
    monkeypatch.setattr(
        languages, "offered", lambda: [{"key": "cpp", "name": "C++", "compiled": True}]
    )
    set_contest(phase="coding1")
    add_question("q")
    add_user("alice")
    with db.transaction() as conn:
        conn.execute(
            sa.insert(ownership).values(question_id="q", participant_id="alice", price_paid=100)
        )
    return fake


def current(submission_id: int) -> sa.Row:
    query = sa.select(judgement).where(
        judgement.c.submission_id == submission_id, judgement.c.superseded_at.is_(None)
    )
    return rows(query)[0]


def test_a_submission_is_stored_and_sent_once(judge: FakeJudge) -> None:
    sid = submissions.submit("alice", "q", "cpp", "int main(){}")
    assert current(sid).state == "queued"
    judging.send_pending()
    assert judge.sent == [f"sub_{sid}_1"]


def test_many_clicks_at_once_make_one_submission(judge: FakeJudge) -> None:
    results = at_once([lambda: submissions.submit("alice", "q", "cpp", "x") for _ in range(10)])
    assert sum(isinstance(r, int) for r in results) == 1
    assert set(codes(results)) == {"in_flight"}


def test_only_the_owner_may_submit(judge: FakeJudge) -> None:
    add_user("bob")
    raises_code("forbidden", lambda: submissions.submit("bob", "q", "cpp", "x"))


def test_a_verdict_is_recorded_and_the_cooldown_starts(judge: FakeJudge) -> None:
    sid = submissions.submit("alice", "q", "cpp", "x")
    judge.finish(current(sid).job_id, "AC")
    judging.poll_in_flight()
    assert (current(sid).state, current(sid).verdict) == ("done", "AC")
    raises_code("cooldown", lambda: submissions.submit("alice", "q", "cpp", "y"))


def test_a_result_arriving_after_a_cancel_changes_nothing(judge: FakeJudge) -> None:
    sid = submissions.submit("alice", "q", "cpp", "x")
    job_id = current(sid).job_id
    assert submissions.cancel_in_flight("alice") is True
    judge.finish(job_id, "AC")
    judging.poll_in_flight()
    row = current(sid)
    assert (row.cancelled, row.verdict) == (True, "IE")
    assert judge.cancelled == [job_id]


def test_a_result_for_a_superseded_judgement_changes_nothing(judge: FakeJudge) -> None:
    sid = submissions.submit("alice", "q", "cpp", "x")
    old_job = current(sid).job_id
    rejudge.rejudge_question("q")
    with db.transaction() as conn:
        old_row = conn.execute(sa.select(judgement).where(judgement.c.job_id == old_job)).one()
        written = judging._write_result(
            conn, old_row.id, old_job, "alice", {"verdict": "AC", "message": "late"}
        )
    assert written is False
    assert current(sid).attempt == 2


def test_concurrent_rejudges_leave_exactly_one_current_judgement(judge: FakeJudge) -> None:
    sid = submissions.submit("alice", "q", "cpp", "x")
    at_once([lambda: rejudge.rejudge_question("q") for _ in range(6)])
    count = scalar(
        sa.select(sa.func.count())
        .select_from(judgement)
        .where(judgement.c.submission_id == sid, judgement.c.superseded_at.is_(None))
    )
    assert count == 1


def test_several_schedulers_send_each_pending_judgement_once(
    judge: FakeJudge, monkeypatch: pytest.MonkeyPatch
) -> None:
    for i in range(5):
        add_user(f"p{i}")
        add_question(f"q{i}")
        with db.transaction() as conn:
            conn.execute(
                sa.insert(ownership).values(
                    question_id=f"q{i}", participant_id=f"p{i}", price_paid=1
                )
            )
    real_send = judging.send_pending
    # Submitting sends one job at once; stop that, so every job is left for the racing schedulers.
    monkeypatch.setattr(submissions, "send_one", lambda: None)
    ids = [submissions.submit(f"p{i}", f"q{i}", "cpp", "x") for i in range(5)]
    at_once([real_send for _ in range(8)])
    assert sorted(judge.sent) == sorted(f"sub_{sid}_1" for sid in ids)


def test_a_restarted_judge_gets_the_stored_source_again(
    judge: FakeJudge, monkeypatch: pytest.MonkeyPatch
) -> None:
    sid = submissions.submit("alice", "q", "cpp", "x")

    def forgotten(job_id: str) -> dict[str, Any]:
        raise judge_client.JudgeError(404, "not_found", "no such job")

    monkeypatch.setattr(judge_client, "job", forgotten)
    judging.poll_in_flight()
    assert (current(sid).state, current(sid).retries) == ("pending", 1)
    judging.send_pending()
    assert judge.sent == [f"sub_{sid}_1", f"sub_{sid}_1"]


def test_the_participant_row_is_never_left_with_a_negative_balance(judge: FakeJudge) -> None:
    assert scalar(sa.select(sa.func.min(participant.c.balance))) >= 0
