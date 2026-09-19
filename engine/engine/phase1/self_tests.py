"""Self-tests: proving a Phase 1 question works before it can be published.

A puzzle is proven according to how it is graded, and a hack question by a breaking
input run on the judge. The outcome sets the question's `ready` flag. Questions
imported with readiness already proven elsewhere are recorded by carry_verification.
"""

from __future__ import annotations

from typing import Any

import sqlalchemy as sa

from engine.core import db, errors
from engine.judge import client as judge_client
from engine.packages.volume import latest_or_current
from engine.phase1.answers import normalise_answer, score_auto
from engine.phase1.authoring import get_question, table_for
from engine.schema import p1_hack_question, p1_question


def self_test_puzzle(
    question_id: int,
    answer: Any = None,
    should_pass: list[str] | None = None,
    should_fail: list[str] | None = None,
) -> dict[str, Any]:
    """Prove a puzzle works, according to how it is graded.

    Auto: the intended answer must score full marks. Validator: it passes and fails
    what it should. Manual: a model answer exists.
    """
    with db.transaction() as conn:
        q = get_question(conn, p1_question, question_id)
    if q.grading == "auto":
        outcome = _test_auto(q, answer)
    elif q.grading == "validator":
        outcome = _test_validator(q, should_pass or [], should_fail or [])
    else:
        ready = bool(q.model_answer and q.model_answer.strip())
        if ready:
            detail = "manual grading; a model answer is recorded"
        else:
            detail = "record a model answer before publishing"
        outcome = {"ready": ready, "detail": detail}
    with db.transaction() as conn:
        # Proven here, so whatever an imported zip claimed no longer applies.
        conn.execute(
            sa.update(p1_question)
            .where(p1_question.c.id == question_id)
            .values(ready=outcome["ready"], verified_elsewhere=False)
        )
    return outcome


def _test_auto(q: sa.Row, answer: Any) -> dict[str, Any]:
    if answer is None:
        raise errors.invalid("supply the intended answer")
    score = score_auto(q, normalise_answer(q, answer))
    ready = score == q.points
    if ready:
        detail = f"intended answer scores {score}/{q.points}"
    else:
        detail = f"intended answer scores only {score}/{q.points} — check the answer key"
    return {"ready": ready, "detail": detail, "score": score}


def _test_validator(q: sa.Row, should_pass: list[str], should_fail: list[str]) -> dict[str, Any]:
    if not should_pass:
        raise errors.invalid("supply at least one entry that should pass")
    job_id = judge_client.validate_answers(
        validator=q.validator_py,
        entries=should_pass + should_fail,
        submission_id=f"p1test_{q.id}",
    )
    result = judge_client.wait_for_job(job_id)
    if result["status"] == "IE":
        return {"ready": False, "detail": f"validator failed to run: {result['message']}"}
    # Results come back in the order sent: the should-pass entries first.
    got = [r["valid"] for r in result["results"]]
    pass_ok = all(got[: len(should_pass)])
    fail_ok = not any(got[len(should_pass) :])
    if pass_ok and fail_ok:
        return {
            "ready": True,
            "detail": "validator accepts what it should and rejects what it should",
        }
    problems = []
    if not pass_ok:
        problems.append("rejected a should-pass entry")
    if not fail_ok:
        problems.append("accepted a should-fail entry")
    return {"ready": False, "detail": "validator " + " and ".join(problems)}


def self_test_hack(question_id: int, breaking_input: str) -> dict[str, Any]:
    """The known breaking input must be valid and must break the given solution."""
    with db.transaction() as conn:
        q = get_question(conn, p1_hack_question, question_id)
    # A proof has to work before the package is published, so the newest upload is used
    # if nothing is live.
    version = latest_or_current(q.problem_id)
    if version is None:
        raise errors.conflict(
            "package_missing",
            f"there is no judge package called {q.problem_id} — upload it under Problems first",
        )
    job_id = judge_client.hack(
        problem_id=q.problem_id,
        language=q.given_language,
        source=q.given_source,
        input=breaking_input,
        version=version,
        submission_id=f"p1hacktest_{question_id}",
    )
    result = judge_client.wait_for_job(job_id)
    ready, detail = _hack_proof(result)
    with db.transaction() as conn:
        values: dict[str, Any] = {"ready": ready, "verified_elsewhere": False}
        if ready:
            # The input that proved it is kept: it is how the question is proven again
            # after an edit or import.
            values["breaking_input"] = breaking_input
        conn.execute(
            sa.update(p1_hack_question).where(p1_hack_question.c.id == question_id).values(**values)
        )
    return {"ready": ready, "detail": detail, "result": result}


def _hack_proof(result: dict[str, Any]) -> tuple[bool, str]:
    if not result["valid_input"]:
        return False, f"your breaking input is itself invalid: {result['invalid_reason']}"
    if result["verdict"] == "IE":
        return False, f"the problem is broken: {result['message']}"
    if result["hacked"]:
        detail = f"the given solution fails on it ({result['verdict']}); the reference handles it"
        return True, detail
    return False, "the given solution handles this input correctly. It does not break it"


def carry_verification(section: str, question_id: int, breaking_input: str | None = None) -> None:
    """Readiness that arrived in a zip, recorded as proven elsewhere. Only importers call this."""
    values: dict[str, Any] = {"ready": True, "verified_elsewhere": True}
    if section == "hacking":
        values["breaking_input"] = breaking_input
    table = table_for(section)
    with db.transaction() as conn:
        conn.execute(sa.update(table).where(table.c.id == question_id).values(**values))
