"""The composition root: the one place that reads settings and wires objects.

Every class in the service takes its collaborators and limits through its
constructor. This is where they are decided, so a test can build the same
graph around a fake sandbox by passing it in and changing nothing else.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.config import Settings
from app.jobs.queue import JobQueue
from app.judging.answers import AnswerScorer
from app.judging.hack import Hacker
from app.judging.judge import Judge
from app.judging.program import Compiler
from app.judging.run import Runner
from app.judging.validation import ValidationRegistry, Validator
from app.problems.storage import LocalStorage
from app.problems.store import ProblemStore
from app.sandbox.client import GoJudge, Sandbox
from app.sandbox.command import Limits
from app.sandbox.scripts import SandboxedPython


@dataclass
class Services:
    settings: Settings
    sandbox: Sandbox
    store: ProblemStore
    python: SandboxedPython
    judge: Judge
    hacker: Hacker
    runner: Runner
    scorer: AnswerScorer
    validator: Validator
    registry: ValidationRegistry
    queue: JobQueue

    def close(self) -> None:
        self.queue.shutdown()
        self.judge.compiler.release_all()
        self.python.release_all()
        self.sandbox.close()


def build(settings: Settings, sandbox: Sandbox | None = None) -> Services:
    sandbox = sandbox or GoJudge(settings.go_judge_url, settings.go_judge_timeout_s)
    store = ProblemStore(LocalStorage(settings.problems_dir))
    script_limits = Limits(settings.checker_time_limit_ms, settings.checker_memory_mb, settings.script_output_bytes)
    python = SandboxedPython(
        sandbox,
        limits=script_limits,
        answers_limits=Limits(script_limits.time_ms, script_limits.memory_mb, settings.max_input_bytes * 4),
    )
    judge = Judge(
        sandbox, store,
        compiler=Compiler(sandbox, settings.compile_output_bytes),
        python=python,
        output_limit_bytes=settings.output_limit_mb * 1024 * 1024,
    )
    registry = ValidationRegistry()
    return Services(
        settings=settings,
        sandbox=sandbox,
        store=store,
        python=python,
        judge=judge,
        hacker=Hacker(judge, python, store),
        runner=Runner(judge, store),
        scorer=AnswerScorer(python),
        validator=Validator(store, judge, python, registry),
        registry=registry,
        queue=JobQueue(
            settings.resolved_concurrency(), settings.resolved_queue_limit(), settings.job_ttl_s,
            settings.resolved_hack_concurrency(), settings.resolved_hack_queue_limit(),
        ),
    )
