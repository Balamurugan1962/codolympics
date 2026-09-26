"""Making a package version live.

A problem's `current` symlink names its live version, and swapping that symlink is
the atomic publish. Publishes of one problem serialise on an advisory lock, so the
symlink and the question row always name the same version.

Publishing while the contest is running rejudges every submission for the question,
so the caller must confirm how many submissions that will be.
"""

from __future__ import annotations

import os

import sqlalchemy as sa

from engine.coding.rejudge import rejudge_question, submission_count
from engine.contest.rules import get_contest, is_phase2
from engine.core import clock, db, errors
from engine.core.audit import audit
from engine.packages.validation import validation_of
from engine.packages.volume import (
    current_version,
    dir_for,
    packages_on_disk,
    read_problem_json,
    versions_of,
)
from engine.schema import question


def publish_version(
    actor_id: str, problem_id: str, version: str, reason: str, confirmed_rejudge: int
) -> dict[str, int]:
    """Swap the live symlink, then rejudge if the contest is running.

    The number of submissions to rejudge must have been confirmed.
    """
    if version not in versions_of(problem_id):
        raise errors.not_found(f"{problem_id} {version}")
    with db.transaction() as conn:
        db.advisory_xact_lock_on(conn, db.LOCK_PUBLISH_PACKAGE, problem_id)
        affected = submission_count(conn, problem_id) if is_phase2(get_contest(conn).phase) else 0
        if affected != confirmed_rejudge:
            raise errors.conflict(
                "confirm_rejudge",
                f"publishing will rejudge {affected} submission(s); confirm that number",
            )
        _swap_current(problem_id, version)
        # The flag follows the version: one with a passing record stays validated.
        record = validation_of(problem_id, version) or {}
        validated = bool(record.get("ok"))
        conn.execute(
            sa.update(question)
            .where(question.c.id == problem_id)
            .values(problem_version=version, validated=validated)
        )
        audit(
            conn,
            actor_id=actor_id,
            action="problem.publish",
            target=problem_id,
            reason=reason,
            detail={"version": version, "rejudged": affected},
        )
    rejudged = rejudge_question(problem_id) if affected > 0 else 0
    return {"rejudged": rejudged}


def _swap_current(problem_id: str, version: str) -> None:
    """Write a new symlink beside `current`, then rename it over the old one in one step."""
    link = dir_for(problem_id, "current")
    tmp = dir_for(problem_id, f".current.{clock.now_ms()}")
    os.symlink(version, tmp)
    os.replace(tmp, link)


def publish_all(actor_id: str, reason: str) -> dict[str, object]:
    """Make the newest version of every package live, where that is safe to do unattended.

    A package is skipped, and named in the answer, when its newest version is already live,
    when it has no passing validation (a hacking package is proven by its question instead),
    or when publishing would rejudge submissions, which needs a person to confirm the count.
    """
    published: list[str] = []
    skipped: list[dict[str, str]] = []
    for info in packages_on_disk():
        problem_id = info["problem_id"]
        versions = versions_of(problem_id)
        if not versions:
            continue
        newest = versions[-1]
        if current_version(problem_id) == newest:
            continue
        hack_only = bool((read_problem_json(problem_id, newest) or {}).get("hack_only"))
        if not hack_only and not (validation_of(problem_id, newest) or {}).get("ok"):
            skipped.append({"id": problem_id, "why": "not validated"})
            continue
        try:
            publish_version(actor_id, problem_id, newest, reason, 0)
        except errors.EngineError as err:
            skipped.append({"id": problem_id, "why": err.message})
            continue
        published.append(problem_id)
    return {"published": len(published), "skipped": skipped}
