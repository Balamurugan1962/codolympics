"""Everything the judge is being asked to do, in one list, for staff.

Three things become judge jobs: a code submission (a judgement row per
attempt), a hack (a p1_hack_attempt row), and a validator run (a p1_answer row,
scored at section close). They are normalised into one shape and merged, with
whatever is still in flight first -- that is the part that can still go wrong.
"""

from __future__ import annotations

from typing import Any

import sqlalchemy as sa

from engine.admin.overview import health
from engine.admin.records import failing_testcase
from engine.core import clock, db, errors
from engine.schema import (
    judgement,
    p1_answer,
    p1_hack_attempt,
    p1_hack_question,
    p1_question,
    question,
    submission,
    user,
)

LIVE = ("pending", "queued", "running")


def activity(limit: int = 200) -> list[dict[str, Any]]:
    """Every judge job, live ones oldest first, then finished ones newest first.

    Each source is capped separately, so a burst of submissions cannot push every
    hack off the list.
    """
    with db.transaction() as conn:
        work = _submissions(conn, limit) + _hacks(conn, limit) + _validators(conn, limit)
    live = [w for w in work if w["live"]]
    done = [w for w in work if not w["live"]]
    live.sort(key=lambda w: w["created_at"])
    done.sort(key=lambda w: w["created_at"], reverse=True)
    return live + done


def overview() -> dict[str, Any]:
    """Judge health and its work in one response.

    Sent together so the tiles and the list never disagree about whether the judge is up.
    """
    status = health()
    work = activity()
    return {
        "judge": status["judge"],
        "backlog": status["backlog"],
        "work": work,
        "counts": summarise(work),
        "server_now": clock.now_ms(),
    }


def summarise(work: list[dict[str, Any]]) -> dict[str, int]:
    live = [w for w in work if w["live"]]
    return {
        "live": len(live),
        "queued": sum(1 for w in live if w["state"] in ("queued", "pending")),
        "running": sum(1 for w in live if w["state"] == "running"),
        "retrying": sum(1 for w in live if w["retries"] > 0),
        "errors": sum(1 for w in work if w["state"] == "error" and not w["superseded"]),
        "hacks": sum(1 for w in live if w["kind"] == "hack"),
    }


def _shape(**w: Any) -> dict[str, Any]:
    """Finish one job row: whether it is live, how long it took, and ISO timestamps."""
    started, ended = w["created_at"], w["ended_at"]
    w["live"] = w["state"] in LIVE
    w["duration_ms"] = clock.ms(ended) - clock.ms(started) if ended else None
    w["created_at"], w["ended_at"] = clock.iso(started), clock.iso(ended)
    return w


def _submissions(conn: sa.Connection, limit: int) -> list[dict[str, Any]]:
    found = conn.execute(
        sa.select(
            judgement,
            submission.c.participant_id,
            submission.c.question_id,
            submission.c.language,
            user.c.name,
            question.c.title,
        )
        .join(submission, submission.c.id == judgement.c.submission_id)
        .join(user, user.c.id == submission.c.participant_id)
        .join(question, question.c.id == submission.c.question_id)
        .order_by(judgement.c.id.desc())
        .limit(limit)
    ).all()
    out = []
    for j in found:
        progress = None
        if j.progress_total > 0:
            progress = {"done": j.progress_done, "total": j.progress_total}
        if j.verdict == "AC":
            tone = "success"
        elif j.verdict:
            tone = "destructive"
        else:
            tone = "neutral"
        row = _shape(
            kind="submission",
            key=f"submission:{j.id}",
            ref=f"submission/{j.id}",
            job_id=j.job_id,
            state="error" if j.state == "done" and j.verdict == "IE" else j.state,
            participant_id=j.participant_id,
            name=j.name or j.participant_id,
            target=j.title,
            problem_id=j.question_id,
            language=j.language,
            progress=progress,
            verdict=j.verdict,
            label=None,
            tone=tone,
            outcome="Cancelled" if j.cancelled else j.message,
            retries=j.retries,
            attempt=j.attempt,
            superseded=j.superseded_at is not None,
            created_at=j.created_at,
            ended_at=j.ended_at,
        )
        out.append(row)
    return out


def _hacks(conn: sa.Connection, limit: int) -> list[dict[str, Any]]:
    found = conn.execute(
        sa.select(
            p1_hack_attempt,
            p1_hack_question.c.title,
            p1_hack_question.c.problem_id,
            p1_hack_question.c.given_language,
            user.c.name,
        )
        .join(p1_hack_question, p1_hack_question.c.id == p1_hack_attempt.c.question_id)
        .join(user, user.c.id == p1_hack_attempt.c.participant_id)
        .order_by(p1_hack_attempt.c.id.desc())
        .limit(limit)
    ).all()
    return [
        _shape(
            kind="hack",
            key=f"hack:{a.id}",
            ref=f"hack/{a.id}",
            job_id=a.job_id,
            state="error" if a.state == "done" and a.verdict == "IE" else a.state,
            participant_id=a.participant_id,
            name=a.name or a.participant_id,
            target=a.title,
            problem_id=a.problem_id,
            language=a.given_language,
            progress=None,
            verdict=a.verdict,
            **hack_chip(a),
            retries=a.retries,
            attempt=None,
            superseded=False,
            created_at=a.created_at,
            ended_at=a.ended_at,
        )
        for a in found
    ]


def _validators(conn: sa.Connection, limit: int) -> list[dict[str, Any]]:
    found = conn.execute(
        sa.select(p1_answer, p1_question.c.title, user.c.name)
        .join(p1_question, p1_question.c.id == p1_answer.c.question_id)
        .join(user, user.c.id == p1_answer.c.participant_id)
        .where(p1_answer.c.score_state.is_not(None))
        .order_by(p1_answer.c.updated_at.desc())
        .limit(limit)
    ).all()
    out = []
    for a in found:
        verdict = None
        label = None
        tone = "success"
        outcome = None
        if a.score_state == "error":
            verdict = "IE"
            label = "Judge error"
            tone = "destructive"
            outcome = a.score_error or "the validator did not finish"
        elif a.score_state == "done":
            label = f"Scored {a.auto_score or 0}"
        row = _shape(
            kind="validator",
            key=f"validator:{a.participant_id}:{a.question_id}",
            ref=f"validator/{a.participant_id}:{a.question_id}",
            job_id=a.score_job_id,
            state=a.score_state or "pending",
            participant_id=a.participant_id,
            name=a.name or a.participant_id,
            target=a.title,
            problem_id=None,
            language="python",
            progress=None,
            verdict=verdict,
            label=label,
            tone=tone,
            outcome=outcome,
            retries=0,
            attempt=None,
            superseded=False,
            # One timestamp on the row, so there is no honest duration to report.
            created_at=a.updated_at,
            ended_at=None,
        )
        out.append(row)
    return out


def hack_chip(a: sa.Row) -> dict[str, Any]:
    """How a hack finished, as a label and a colour.

    A hack has no verdict for the table to spell out.
    """
    if a.state != "done":
        return {"label": None, "tone": "info", "outcome": None}
    if a.verdict == "IE":
        return {
            "label": "Judge error",
            "tone": "destructive",
            "outcome": "the judge could not run it",
        }
    if a.valid_input is False:
        return {
            "label": "Rejected",
            "tone": "warning",
            "outcome": a.invalid_reason or "the input broke the constraints",
        }
    if a.hacked is True:
        return {
            "label": "Broke it",
            "tone": "success",
            "outcome": "the solution failed on this input",
        }
    if a.hacked is False:
        return {"label": "Held", "tone": "neutral", "outcome": "the solution survived"}
    return {"label": None, "tone": "neutral", "outcome": None}


def detail(kind: str, ref: str) -> dict[str, Any]:
    """One job in full. `kind` and `ref` are the two halves of its activity row's `ref`."""
    if kind == "submission":
        return _submission_detail(int(ref))
    if kind == "hack":
        return _hack_detail(int(ref))
    if kind == "validator":
        return _validator_detail(ref)
    raise errors.not_found("job")


def _request(
    job_id: str | None, state: str, created_at: Any, ended_at: Any, **extra: Any
) -> dict[str, Any]:
    """What was asked of the judge, in one shape for every kind of job."""
    base = {
        "job_id": job_id,
        "state": state,
        "attempt": None,
        "retries": 0,
        "cancelled": False,
        "superseded_at": None,
        "problem_version": None,
        "created_at": clock.iso(created_at),
        "ended_at": clock.iso(ended_at),
    }
    return base | extra


def _submission_detail(judgement_id: int) -> dict[str, Any]:
    with db.transaction() as conn:
        j = conn.execute(
            sa.select(
                judgement,
                submission.c.participant_id,
                submission.c.question_id,
                submission.c.source,
                submission.c.language,
                submission.c.created_at.label("submitted_at"),
                user.c.name,
                question.c.title,
            )
            .join(submission, submission.c.id == judgement.c.submission_id)
            .join(user, user.c.id == submission.c.participant_id)
            .join(question, question.c.id == submission.c.question_id)
            .where(judgement.c.id == judgement_id)
        ).one_or_none()
        if j is None:
            raise errors.not_found("job")
        attempts = _attempts(conn, j.submission_id)
    return {
        "kind": "submission",
        "who": {"id": j.participant_id, "name": j.name or j.participant_id},
        "submitted_at": clock.iso(j.submitted_at),
        "target": {"title": j.title, "problem_id": j.question_id},
        "source": j.source,
        "language": j.language,
        "request": _request(
            j.job_id,
            j.state,
            j.created_at,
            j.ended_at,
            attempt=j.attempt,
            retries=j.retries,
            cancelled=j.cancelled,
            superseded_at=clock.iso(j.superseded_at),
            problem_version=j.problem_version,
        ),
        "result": {
            "verdict": j.verdict,
            "passed": j.passed,
            "total": j.total,
            "first_fail": j.first_fail,
            "max_time_ms": j.max_time_ms,
            "max_memory_kb": j.max_memory_kb,
            "message": j.message,
            "jury_detail": j.jury_detail,
            "compile_output": j.compile_output,
            "progress": {"done": j.progress_done, "total": j.progress_total},
        },
        "failing_testcase": failing_testcase(j.question_id, j.first_fail, j.problem_version),
        "attempts": attempts,
    }


def _attempts(conn: sa.Connection, submission_id: int) -> list[dict[str, Any]]:
    """Every judgement of one submission, newest attempt first -- the rejudge history."""
    found = conn.execute(
        sa.select(
            judgement.c.id,
            judgement.c.attempt,
            judgement.c.verdict,
            judgement.c.state,
            judgement.c.created_at,
        )
        .where(judgement.c.submission_id == submission_id)
        .order_by(judgement.c.attempt.desc())
    ).all()
    return [
        {
            "id": a.id,
            "attempt": a.attempt,
            "verdict": a.verdict,
            "state": a.state,
            "createdAt": clock.iso(a.created_at),
        }
        for a in found
    ]


def _hack_detail(attempt_id: int) -> dict[str, Any]:
    with db.transaction() as conn:
        a = conn.execute(
            sa.select(
                p1_hack_attempt,
                p1_hack_question.c.title,
                p1_hack_question.c.problem_id,
                p1_hack_question.c.given_source,
                p1_hack_question.c.given_language,
                p1_hack_question.c.hack_points,
                p1_hack_question.c.fail_penalty,
                user.c.name,
            )
            .join(p1_hack_question, p1_hack_question.c.id == p1_hack_attempt.c.question_id)
            .join(user, user.c.id == p1_hack_attempt.c.participant_id)
            .where(p1_hack_attempt.c.id == attempt_id)
        ).one_or_none()
    if a is None:
        raise errors.not_found("job")
    chip = hack_chip(a)
    if not chip["label"]:
        outcome = None
    elif chip["outcome"]:
        outcome = f"{chip['label']} — {chip['outcome']}"
    else:
        outcome = chip["label"]
    return {
        "kind": "hack",
        "who": {"id": a.participant_id, "name": a.name or a.participant_id},
        "submitted_at": clock.iso(a.created_at),
        "target": {"title": a.title, "problem_id": a.problem_id},
        # A hack sends an input, not code; the code is the solution under attack.
        "input": a.input,
        "source": a.given_source,
        "language": a.given_language,
        "request": _request(a.job_id, a.state, a.created_at, a.ended_at, retries=a.retries),
        "result": {
            "valid_input": a.valid_input,
            "invalid_reason": a.invalid_reason,
            "hacked": a.hacked,
            "verdict": a.verdict,
            "points_awarded": a.points_awarded,
            "outcome": outcome,
        },
        "stakes": {"hack_points": a.hack_points, "fail_penalty": a.fail_penalty},
    }


def _validator_detail(ref: str) -> dict[str, Any]:
    participant_id, _, question_id = ref.partition(":")
    if not question_id.isdigit():
        raise errors.not_found("job")
    with db.transaction() as conn:
        a = conn.execute(
            sa.select(p1_answer, p1_question.c.title, p1_question.c.points_per_entry, user.c.name)
            .join(p1_question, p1_question.c.id == p1_answer.c.question_id)
            .join(user, user.c.id == p1_answer.c.participant_id)
            .where(
                p1_answer.c.participant_id == participant_id,
                p1_answer.c.question_id == int(question_id),
            )
        ).one_or_none()
    if a is None:
        raise errors.not_found("job")
    if isinstance(a.answer, list):
        entries = [str(e) for e in a.answer]
    elif a.answer is None:
        entries = []
    else:
        entries = [str(a.answer)]
    return {
        "kind": "validator",
        "who": {"id": a.participant_id, "name": a.name or a.participant_id},
        "submitted_at": clock.iso(a.updated_at),
        "target": {"title": a.title, "problem_id": None},
        # The validator is an answer key: not returned, even here.
        "entries": entries,
        "language": "python",
        "request": _request(a.score_job_id, a.score_state or "pending", a.updated_at, None),
        "result": {
            "score": a.auto_score,
            "points_per_entry": a.points_per_entry,
            "error": a.score_error,
        },
    }
