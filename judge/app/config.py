"""Every tunable in one place, all overridable by environment variable.

Nothing else in the service reads os.environ, so this file is the complete
list of knobs an operator has. `Settings()` is built once, in create_app, and
handed to the container; nothing reads it as a global.
"""
from __future__ import annotations

import os

from pydantic_settings import BaseSettings


def _default_concurrency() -> int:
    """One judging slot per core, capped at 4.

    Timing fairness (US-J2-05) depends on judging never oversubscribing the
    CPU, so the default deliberately errs low. Raise JUDGE_CONCURRENCY only
    if the machine has cores to spare.
    """
    return max(1, min(4, os.cpu_count() or 1))


class Settings(BaseSettings):
    # --- the sandbox -------------------------------------------------------
    go_judge_url: str = "http://go-judge:5050"
    go_judge_timeout_s: float = 120.0

    # --- where problems live ----------------------------------------------
    problems_dir: str = "/problems"

    # --- who may call us ---------------------------------------------------
    # The backend is the only client. Empty means "reject everything", which
    # is the safe default: a missing token should fail loudly, not open up.
    service_token: str = ""

    # --- capacity ----------------------------------------------------------
    concurrency: int = 0          # 0 means "use _default_concurrency()"
    queue_limit: int = 0          # 0 means "2 x concurrency"
    # Hack attempts run on a pool of their own. Hacking only happens in Phase 1,
    # when nothing is being timed for score, so this can be larger than
    # `concurrency` without disturbing Phase 2. 0 means "the same as
    # `concurrency`", which is the safe default: the sandbox is pinned to a set
    # of cores (GO_JUDGE_CPUSET), and more slots than cores gains nothing.
    # Raise the two together.
    hack_concurrency: int = 0
    hack_queue_limit: int = 0     # 0 means "2 x hack_concurrency"

    # --- limits ------------------------------------------------------------
    max_source_bytes: int = 262_144        # 256 KB, matches the OpenAPI spec
    max_input_bytes: int = 262_144         # cap on a supplied hack input or answer list
    compile_output_bytes: int = 4_096      # truncate compiler diagnostics
    output_limit_mb: int = 64              # a run producing more than this is OLE
    testcase_response_bytes: int = 1_048_576   # 1 MB cap on GET /testcases

    # --- jobs --------------------------------------------------------------
    job_ttl_s: int = 600          # keep finished jobs for 10 minutes

    # --- checkers and validators ------------------------------------------
    checker_time_limit_ms: int = 10_000
    checker_memory_mb: int = 512
    script_output_bytes: int = 65_536      # what a checker or validator may print

    model_config = {"env_prefix": "JUDGE_", "env_file": ".env"}

    def resolved_concurrency(self) -> int:
        return self.concurrency if self.concurrency > 0 else _default_concurrency()

    def resolved_hack_concurrency(self) -> int:
        return self.hack_concurrency if self.hack_concurrency > 0 else self.resolved_concurrency()

    def resolved_hack_queue_limit(self) -> int:
        return self.hack_queue_limit if self.hack_queue_limit > 0 else self.resolved_hack_concurrency() * 2

    def resolved_queue_limit(self) -> int:
        return self.queue_limit if self.queue_limit > 0 else self.resolved_concurrency() * 2

