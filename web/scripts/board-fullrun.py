"""Run one submission over every hidden testcase. Runs inside the judge-api container.

    echo '{"problem_id": "q24", "version": "v1", "language": "cpp", "source": "...", "skip": 3}' |
        docker compose exec -T judge-api python - < web/scripts/board-fullrun.py

Reads that JSON on stdin and prints {"verdict", "passed", "total"} over the hidden tests
only: the first `skip` testcases are the samples shown in the statement, and are
left out so passing them alone earns nothing. It uses the judge's own Judge with
run_all=True (what validation uses), so early_exit is ignored and `passed` is the
true count. It bypasses the job queue and records nothing: the
contest's judgements are untouched.
"""

import dataclasses
import json
import sys

from app.config import Settings
from app.core import languages
from app.judging.judge import Judge, Submission
from app.judging.program import Compiler
from app.problems.storage import LocalStorage
from app.problems.store import ProblemStore
from app.sandbox.client import GoJudge
from app.sandbox.command import Limits
from app.sandbox.scripts import SandboxedPython

job = json.loads(sys.stdin.readline())
settings = Settings()
sandbox = GoJudge(settings.go_judge_url, settings.go_judge_timeout_s)
store = ProblemStore(LocalStorage(settings.problems_dir))
limits = Limits(settings.checker_time_limit_ms, settings.checker_memory_mb, settings.script_output_bytes)
python = SandboxedPython(
    sandbox, limits=limits,
    answers_limits=Limits(limits.time_ms, limits.memory_mb, settings.max_input_bytes * 4),
)
judge = Judge(
    sandbox, store,
    compiler=Compiler(sandbox, settings.compile_output_bytes),
    python=python,
    output_limit_bytes=settings.output_limit_mb * 1024 * 1024,
)
try:
    problem = store.load(job["problem_id"], job.get("version") or None)
    problem = dataclasses.replace(problem, testcases=problem.testcases[int(job.get("skip") or 0):])
    result = judge.run(Submission(problem, languages.get(job["language"]), job["source"]), run_all=True)
    print(json.dumps({"verdict": str(result.verdict), "passed": result.passed, "total": result.total}))
finally:
    judge.compiler.release_all()
    python.release_all()
    sandbox.close()
