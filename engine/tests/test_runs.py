"""Practice runs, with the judge replaced by a fake that answers on command."""

from __future__ import annotations

import datetime as dt
import itertools
from typing import Any

import pytest
import sqlalchemy as sa
from conftest import add_question, add_user, at_once, codes, raises_code, rows, set_contest

from engine.coding import runs
from engine.core import db, errors
from engine.judge import client as judge_client
from engine.judge import languages
from engine.judge.client import JudgeError
from engine.schema import ownership, practice_run, question


class FakeJudge:
    def __init__(self) -> None:
        self.requests: list[dict[str, Any]] = []
        self.states: dict[str, dict[str, Any]] = {}
        self.down = False
        self._ids = itertools.count(1)

    def run(self, **request: Any) -> str:
        if self.down:
            raise JudgeError(0, "unreachable", "cannot reach the judge")
        self.requests.append(request)
        job_id = f"job-{next(self._ids)}"
        self.states[job_id] = {
            "state": "queued",
            "progress": {"done": 0, "total": 2},
            "result": None,
        }
        return job_id

    def job(self, job_id: str) -> dict[str, Any]:
        if job_id not in self.states:
            raise JudgeError(404, "job_not_found", "no such job")
        return self.states[job_id]

    def finish(self, job_id: str, verdict: str, outputs: list[dict[str, Any]]) -> None:
        result = {
            "verdict": verdict,
            "message": f"{verdict} summary",
            "compile_output": "",
            "outputs": outputs,
        }
        self.states[job_id] = {
            "state": "done",
            "progress": {"done": 2, "total": 2},
            "result": result,
        }

    def forget(self, job_id: str) -> None:
        del self.states[job_id]


@pytest.fixture
def judge(monkeypatch: pytest.MonkeyPatch) -> FakeJudge:
    fake = FakeJudge()
    monkeypatch.setattr(judge_client, "run", fake.run)
    monkeypatch.setattr(judge_client, "job", fake.job)
    monkeypatch.setattr(
        languages, "offered", lambda: [{"key": "cpp", "name": "C++", "compiled": True}]
    )
    set_contest(phase="coding1")
    add_question("q")
    with db.transaction() as conn:
        conn.execute(sa.update(question).where(question.c.id == "q").values(sample_count=2))
    add_user("alice")
    with db.transaction() as conn:
        conn.execute(
            sa.insert(ownership).values(question_id="q", participant_id="alice", price_paid=100)
        )
    return fake


def row(run_id: int) -> sa.Row:
    return rows(sa.select(practice_run).where(practice_run.c.id == run_id))[0]


def test_the_judge_is_asked_for_the_samples_and_the_custom_input(judge: FakeJudge) -> None:
    run_id = runs.start("alice", "q", "cpp", "int main(){}", "7 8\n")
    sent = judge.requests[0]
    assert (sent["samples"], sent["inputs"]) == (2, [{"input": "7 8\n", "answer": None}])
    assert sent["submission_id"] == f"run_{run_id}"
    kept = row(run_id)
    assert (kept.state, kept.source, kept.custom_input, kept.sample_count) == (
        "queued",
        "int main(){}",
        "7 8\n",
        2,
    )


def test_the_scheduler_records_the_verdict_and_the_workspace_reads_the_outputs(
    judge: FakeJudge,
) -> None:
    run_id = runs.start("alice", "q", "cpp", "x", None)
    assert runs.poll("alice", run_id)["state"] == "queued"
    outputs = [{"verdict": "AC", "stdout": "3"}, {"verdict": "WA", "stdout": "8"}]
    judge.finish(row(run_id).job_id, "WA", outputs)
    # The workspace's poll does not ask the judge while the run is in flight.
    assert runs.poll("alice", run_id)["state"] == "queued"
    runs.tick()
    view = runs.poll("alice", run_id)
    assert (view["state"], view["verdict"], view["outputs"]) == ("done", "WA", outputs)
    assert (row(run_id).verdict, row(run_id).message) == ("WA", "WA summary")
    assert row(run_id).ended_at is not None
    # The outputs are on the row now, so the judge forgetting the job changes nothing.
    judge.forget(row(run_id).job_id)
    assert runs.poll("alice", run_id)["outputs"] == outputs


def test_one_run_at_a_time(judge: FakeJudge) -> None:
    results = at_once([lambda: runs.start("alice", "q", "cpp", "x", None) for _ in range(6)])
    assert sum(isinstance(r, int) for r in results) == 1
    assert set(codes(results)) == {"in_flight"}


def test_a_finished_run_frees_the_next(judge: FakeJudge) -> None:
    first = runs.start("alice", "q", "cpp", "x", None)
    judge.finish(row(first).job_id, "AC", [])
    runs.tick()
    assert isinstance(runs.start("alice", "q", "cpp", "y", None), int)


def test_only_the_owner_may_run(judge: FakeJudge) -> None:
    add_user("bob")
    raises_code("forbidden", lambda: runs.start("bob", "q", "cpp", "x", None))


def test_nobody_else_can_read_a_run(judge: FakeJudge) -> None:
    add_user("bob")
    run_id = runs.start("alice", "q", "cpp", "x", None)
    raises_code("not_found", lambda: runs.poll("bob", run_id))


def test_a_judge_that_is_down_leaves_no_run_in_flight(judge: FakeJudge) -> None:
    judge.down = True
    with pytest.raises(errors.EngineError):
        runs.start("alice", "q", "cpp", "x", None)
    judge.down = False
    assert isinstance(runs.start("alice", "q", "cpp", "x", None), int)


def test_a_job_the_judge_forgot_ends_the_run(judge: FakeJudge) -> None:
    run_id = runs.start("alice", "q", "cpp", "x", None)
    judge.forget(row(run_id).job_id)
    runs.tick()
    assert (row(run_id).state, row(run_id).verdict) == ("done", "IE")
    assert isinstance(runs.start("alice", "q", "cpp", "x", None), int)


def test_a_run_that_was_never_sent_is_given_up_on(judge: FakeJudge) -> None:
    with db.transaction() as conn:
        run_id = conn.execute(
            sa.insert(practice_run)
            .values(participant_id="alice", question_id="q", language="cpp")
            .returning(practice_run.c.id)
        ).scalar_one()
    raises_code("in_flight", lambda: runs.start("alice", "q", "cpp", "x", None))
    with db.transaction() as conn:
        conn.execute(
            sa.update(practice_run)
            .where(practice_run.c.id == run_id)
            .values(created_at=sa.func.now() - dt.timedelta(minutes=1))
        )
    runs.tick()
    assert (row(run_id).state, row(run_id).verdict) == ("done", "IE")
    assert isinstance(runs.start("alice", "q", "cpp", "x", None), int)


def test_nothing_to_run_without_samples_or_input(judge: FakeJudge) -> None:
    with db.transaction() as conn:
        conn.execute(sa.update(question).where(question.c.id == "q").values(sample_count=0))
    raises_code("nothing_to_run", lambda: runs.start("alice", "q", "cpp", "x", None))
    assert isinstance(runs.start("alice", "q", "cpp", "x", "1\n"), int)


def test_runs_are_closed_with_the_round(judge: FakeJudge) -> None:
    set_contest(phase="ended")
    raises_code("not_open", lambda: runs.start("alice", "q", "cpp", "x", None))
