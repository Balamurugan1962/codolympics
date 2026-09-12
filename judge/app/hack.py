"""Hacking: does this supplied input break the given solution? (US-J7-01)

Three runs in order, each able to stop the process:

  1. the problem's validator on the input   -> invalid input is not a hack
  2. the stored reference solution           -> the correct answer for this input
  3. the given solution, compared to (2)     -> hacked if it fails in any way

Anything wrong with the *problem* -- no reference, reference fails, given
solution does not compile -- is IE. A participant is never credited or
penalised for a broken question.
"""
from __future__ import annotations

import time

from . import languages
from .checker import SandboxedPython
from .judge import Judge
from .languages import Language
from .models import HackResult
from .problems import Problem
from .storage import Storage


def run_hack(
    judge: Judge,
    python: SandboxedPython,
    storage: Storage,
    problem: Problem,
    language: Language,
    source: str,
    input_text: str,
    submission_id: str | None,
) -> HackResult:
    started = time.monotonic()

    def finish(**fields) -> HackResult:
        return HackResult(
            submission_id=submission_id,
            problem_version=problem.version,
            duration_ms=int((time.monotonic() - started) * 1000),
            **fields,
        )

    def broken(why: str) -> HackResult:
        return finish(valid_input=True, hacked=None, verdict="IE",
                      message=f"problem is broken, not the participant: {why}")

    # 1. Constraints. Without a validator every input is taken as legal.
    if storage.exists(problem.validator_key):
        valid, reason = python.validate_input(problem, input_text)
        if not valid:
            return finish(valid_input=False, invalid_reason=reason,
                          message="input violates the problem's constraints")

    # 2. The correct answer, from the stored reference solution.
    if not problem.has_reference:
        return broken("no reference solution is stored with the problem")
    reference_language = languages.get(problem.reference_language or "")
    if reference_language is None:
        return broken(f"reference language {problem.reference_language!r} is not offered")
    try:
        reference_source = storage.read_text(problem.reference_key)
    except (OSError, UnicodeDecodeError) as exc:
        return broken(f"cannot read the reference solution: {exc}")

    reference = judge.run_single(problem, reference_language, reference_source, input_text, None)
    if reference.verdict != "AC":
        return broken(f"reference solution got {reference.verdict} on this input")

    # 3. The given solution, judged against the reference's output.
    given = judge.run_single(problem, language, source, input_text, reference.stdout)
    if given.verdict == "CE":
        return broken("the given solution does not compile")
    if given.verdict == "IE":
        return broken(given.detail or "sandbox fault while running the given solution")

    hacked = given.verdict != "AC"
    return finish(
        valid_input=True,
        hacked=hacked,
        verdict=given.verdict,
        message="the solution failed on this input" if hacked
                else "the solution handled this input correctly",
    )
