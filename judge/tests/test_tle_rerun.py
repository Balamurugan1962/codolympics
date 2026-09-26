"""A run that hit the time limit is run once more, so a busy machine is not blamed on the program."""
from __future__ import annotations

from app.sandbox.client import Result
from tests.conftest import wait_for_job, write_problem
from tests.test_hack import FLAWED, REFERENCE, correct, flawed, hack, hackable_problem


def make_slow(sandbox, times: int, status: str = "Time Limit Exceeded") -> None:
    """The next `times` program runs come back with `status` instead of running."""
    real = sandbox._run
    left = [times]

    def run(command):
        if left[0] > 0:
            left[0] -= 1
            sandbox.runs += 1
            return Result(status, -1, 1000.0, 1000.0, 2048, "", "", {})
        return real(command)

    sandbox._run = run


def submit(client) -> dict:
    response = client.post("/submit", json={"problem_id": "sum", "language": "cpp", "source": "int main(){}", "submission_id": "s"})
    return wait_for_job(client, response.json()["job_id"])["result"]


def test_a_program_that_was_only_slow_once_is_not_given_a_time_limit_verdict(client, sandbox, problems_dir) -> None:
    write_problem(problems_dir, "sum", [("1 2\n", "3\n"), ("2 3\n", "5\n")])
    sandbox.solve = lambda stdin: str(sum(int(x) for x in stdin.split()))
    make_slow(sandbox, 1)
    result = submit(client)
    assert result["verdict"] == "AC" and result["passed"] == result["total"]   # the slow first run did not fail the test
    assert sandbox.runs == result["total"] + 1                                # every test once, one of them twice


def test_a_program_that_is_slow_every_time_still_gets_time_limit_exceeded(client, sandbox, problems_dir) -> None:
    write_problem(problems_dir, "sum", [("1 2\n", "3\n"), ("2 3\n", "5\n")])
    make_slow(sandbox, 99)
    result = submit(client)
    assert result["verdict"] == "TLE"
    assert sandbox.runs == 2          # once, and once more: not a third try, and the second test is never reached


def test_a_crash_or_a_memory_overrun_is_not_rerun(client, sandbox, problems_dir) -> None:
    write_problem(problems_dir, "sum", [("1 2\n", "3\n")])
    for status, verdict in (("Nonzero Exit Status", "RE"), ("Memory Limit Exceeded", "MLE")):
        before = sandbox.runs
        make_slow(sandbox, 1, status)
        assert submit(client)["verdict"] == verdict
        assert sandbox.runs - before == 1     # it does not depend on how busy the machine is


def test_a_wrong_answer_is_not_rerun(client, sandbox, problems_dir) -> None:
    write_problem(problems_dir, "sum", [("1 2\n", "3\n")])
    sandbox.solve = lambda stdin: "999"
    assert submit(client)["verdict"] == "WA"
    assert sandbox.runs == 1


def test_a_solution_that_was_only_slow_once_is_not_counted_as_broken_by_a_hack(client, sandbox, problems_dir) -> None:
    hackable_problem(problems_dir)
    sandbox.programs = {REFERENCE: correct, FLAWED: flawed}
    real = sandbox._run
    slow_once = [True]

    def run(command):
        mounted = [sandbox._sources.get(v.get("fileId"), "") for v in command.get("copyIn", {}).values()]
        if slow_once[0] and any(FLAWED in source for source in mounted):
            slow_once[0] = False
            sandbox.runs += 1
            return Result("Time Limit Exceeded", -1, 1000.0, 1000.0, 2048, "", "", {})
        return real(command)

    sandbox._run = run
    result = hack(client, FLAWED, "1 5\n")     # the flawed program is right on this input
    assert result["hacked"] is False           # the slow first run did not count as breaking it
