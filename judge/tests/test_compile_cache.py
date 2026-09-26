"""Hack attempts reuse a compiled program instead of compiling it for every attempt."""
from __future__ import annotations

import threading

from app.core.languages import LANGUAGES
from app.judging.program import Compiler
from app.sandbox.client import Result
from tests.conftest import FakeSandbox
from tests.test_hack import FLAWED, REFERENCE, correct, flawed, hack, hackable_problem

CPP = LANGUAGES["cpp"]
PY = LANGUAGES["python"]


def make(limit: int = 64) -> tuple[FakeSandbox, Compiler]:
    sandbox = FakeSandbox()
    return sandbox, Compiler(sandbox, 4096, keep_limit=limit)


def use(compiler: Compiler, language, source: str, **kw) -> bool:
    with compiler.prepare_kept(language, source, **kw) as (program, reused):
        assert program.ok
        return reused


class TestKeepingCompiledPrograms:
    def test_the_same_source_is_compiled_once(self):
        sandbox, compiler = make()
        assert [use(compiler, CPP, "int main(){}") for _ in range(5)] == [False, True, True, True, True]
        assert sandbox.compiles == 1
        assert sandbox.deleted == []          # still kept between attempts

    def test_another_source_or_language_is_its_own_program(self):
        sandbox, compiler = make()
        use(compiler, CPP, "int main(){}")
        use(compiler, CPP, "int main(){return 1;}")
        use(compiler, LANGUAGES["c"], "int main(){}")
        assert sandbox.compiles == 3

    def test_an_interpreted_language_is_not_kept(self):
        sandbox, compiler = make()
        use(compiler, PY, "print(1)")
        use(compiler, PY, "print(1)")
        assert sandbox.compiles == 0
        assert len(sandbox.uploaded) == 2 and len(sandbox.deleted) == 2   # uploaded and released each time

    def test_a_failed_compile_is_not_kept(self):
        sandbox, compiler = make()
        sandbox.compile_fails = True
        for _ in range(2):
            with compiler.prepare_kept(CPP, "broken") as (program, reused):
                assert not program.ok and not reused
        assert sandbox.compiles == 2

    def test_fresh_throws_the_kept_copy_away(self):
        sandbox, compiler = make()
        use(compiler, CPP, "int main(){}")
        assert use(compiler, CPP, "int main(){}", fresh=True) is False
        assert sandbox.compiles == 2
        assert sandbox.deleted == ["file-1"]  # the old artefact was released
        assert use(compiler, CPP, "int main(){}") is True   # and the new one is what is kept

    def test_the_least_recently_used_program_leaves_first(self):
        sandbox, compiler = make(limit=2)
        for source in ("a", "b"):
            use(compiler, CPP, source)
        use(compiler, CPP, "a")               # a is now newer than b
        use(compiler, CPP, "c")               # pushes b out
        assert sandbox.deleted == ["file-2"]
        assert use(compiler, CPP, "a") is True
        assert use(compiler, CPP, "b") is False   # b has to be compiled again

    def test_a_program_still_running_is_not_deleted_from_under_it(self):
        sandbox, compiler = make(limit=1)
        with compiler.prepare_kept(CPP, "a") as (first, _):
            use(compiler, CPP, "b")           # pushes a out of the cache while it is running
            assert sandbox.deleted == []      # its artefact is still there for the run using it
            assert first.ok
        assert sandbox.deleted == ["file-1"]  # released by its last user

    def test_release_all_gives_everything_back(self):
        sandbox, compiler = make()
        use(compiler, CPP, "a")
        use(compiler, CPP, "b")
        compiler.release_all()
        assert sorted(sandbox.deleted) == ["file-1", "file-2"]

    def test_a_crowd_arriving_together_compiles_once(self):
        sandbox, compiler = make()
        gate = threading.Barrier(12)
        reused: list[bool] = []

        def worker():
            gate.wait()
            reused.append(use(compiler, CPP, "int main(){}"))

        threads = [threading.Thread(target=worker) for _ in range(12)]
        [t.start() for t in threads]
        [t.join() for t in threads]
        assert sandbox.compiles == 1
        assert reused.count(False) == 1 and reused.count(True) == 11


class TestHackAttemptsUseIt:
    def test_many_attempts_compile_the_flawed_solution_and_the_reference_once_each(
        self, client, sandbox, problems_dir
    ):
        hackable_problem(problems_dir)
        sandbox.programs = {REFERENCE: correct, FLAWED: flawed}
        for _ in range(5):
            assert hack(client, FLAWED, "-1 5\n")["hacked"] is True
        assert sandbox.compiles == 2          # one each, not ten
        assert sandbox.runs == 10             # but every attempt still ran both

    def test_a_sandbox_that_forgot_the_artefact_is_recompiled_for_once(
        self, client, sandbox, problems_dir
    ):
        hackable_problem(problems_dir)
        sandbox.programs = {REFERENCE: correct, FLAWED: flawed}
        assert hack(client, FLAWED, "-1 5\n")["hacked"] is True

        forgotten = set(sandbox._sources)      # every artefact so far: pretend the sandbox restarted
        real_run = sandbox._run

        def run(command):
            mounted = {v.get("fileId") for v in command.get("copyIn", {}).values()}
            if mounted & forgotten:
                sandbox.runs += 1
                return Result("File Error", -1, 0.0, 0.0, 0, "", "no such file", {})
            return real_run(command)

        sandbox._run = run
        before = sandbox.compiles
        result = hack(client, FLAWED, "-1 5\n")
        assert result["hacked"] is True       # not reported as a fault
        assert sandbox.compiles == before + 2  # flawed and reference compiled afresh
