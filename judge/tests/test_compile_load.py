"""A compile that a busy machine starved is the judge's failure, never a Compile Error."""
from __future__ import annotations

import pytest

from app.core.languages import LANGUAGES
from app.judging.program import COMPILE_WALL_FACTOR, Compiler
from app.sandbox.client import CompilerOverloaded, Result
from tests.conftest import FakeSandbox

CPP = LANGUAGES["cpp"]
LIMIT = CPP.compile_time_limit_ms


class ScriptedSandbox(FakeSandbox):
    """Compiles answer from a script, one result per attempt, then behave normally."""

    def __init__(self, *results: Result):
        super().__init__()
        self.script = list(results)
        self.commands: list[dict] = []

    def _compile(self, command: dict) -> Result:
        self.commands.append(command)
        if self.script:
            self.compiles += 1
            return self.script.pop(0)
        return super()._compile(command)


def timed_out(cpu_ms: float, wall_ms: float, ids: dict[str, str] | None = None) -> Result:
    return Result("Time Limit Exceeded", -1, cpu_ms, wall_ms, 4096, "", "", ids or {})


def test_the_compile_gets_a_generous_wall_clock_but_the_same_cpu_budget() -> None:
    sandbox = ScriptedSandbox()
    with Compiler(sandbox, 4096).prepare(CPP, "int main(){}") as program:
        assert program.ok
    limits = sandbox.commands[0]
    assert limits["cpuLimit"] == LIMIT * 1_000_000               # what says a program is too heavy
    assert limits["clockLimit"] == LIMIT * COMPILE_WALL_FACTOR * 1_000_000
    assert COMPILE_WALL_FACTOR > 2                                # more than the 2x every other command gets


def test_a_starved_compile_is_tried_again_and_then_succeeds() -> None:
    sandbox = ScriptedSandbox(timed_out(cpu_ms=3000, wall_ms=120_000, ids={"main": "half-built"}))
    with Compiler(sandbox, 4096).prepare(CPP, "int main(){}") as program:
        assert program.ok                                         # the second attempt worked
    assert sandbox.compiles == 2
    assert "half-built" in sandbox.deleted                        # nothing from the failed attempt is left behind


def test_two_starved_compiles_are_the_judges_failure_not_a_compile_error() -> None:
    sandbox = ScriptedSandbox(timed_out(3000, 120_000), timed_out(3200, 120_000))
    with pytest.raises(CompilerOverloaded):
        with Compiler(sandbox, 4096).prepare(CPP, "int main(){}"):
            pass


def test_a_program_that_really_is_too_heavy_is_still_a_compile_error() -> None:
    # It used all of its CPU budget: that is the program, so it is the contestant's compile error.
    sandbox = ScriptedSandbox(timed_out(cpu_ms=LIMIT + 50, wall_ms=LIMIT + 60))
    with Compiler(sandbox, 4096).prepare(CPP, "template<int N> struct T{};") as program:
        assert not program.ok
        assert "time limit exceeded" in program.compile_output
    assert sandbox.compiles == 1                                  # no retry: nothing to retry


def test_a_starved_compile_in_a_submission_is_an_internal_error_with_a_plain_message(client, sandbox, problems_dir) -> None:
    from tests.conftest import wait_for_job, write_problem

    write_problem(problems_dir, "sum", [("1 2\n", "3\n")])
    real = sandbox._compile
    sandbox._compile = lambda command: timed_out(3000, 120_000)   # every attempt starved
    response = client.post("/submit", json={"problem_id": "sum", "language": "cpp", "source": "int main(){}", "submission_id": "s1"})
    result = wait_for_job(client, response.json()["job_id"])["result"]
    sandbox._compile = real
    assert result["verdict"] == "IE"                              # not "CE"
    assert "not your fault" in result["message"]
