"""Validating a package version through the judge, and the record of it kept beside the package.

A validation runs the reference solution over every testcase. The result is
written to `validation.json` in the version directory, so it travels with an
export. That record is provenance, never permission: one that arrived in an
imported zip is kept, but stamped as having run elsewhere.
"""

from __future__ import annotations

import contextlib
import json
from typing import Any

import sqlalchemy as sa

from engine.core import clock, db, errors
from engine.judge import client as judge_client
from engine.judge.client import JudgeError
from engine.packages.volume import (
    ID,
    VERSION,
    dir_for,
    latest_or_current,
    packages_on_disk,
    read_problem_json,
)
from engine.schema import question


def validate_version(
    problem_id: str, version: str, body: dict[str, Any] | None = None
) -> dict[str, Any]:
    """Run the reference solution over every testcase of a version, through the judge."""
    if not ID.match(problem_id) or not VERSION.match(version):
        raise errors.invalid("bad id or version")
    try:
        report = judge_client.validate(problem_id, body or {}, version)
    except JudgeError as err:
        if err.judge_status == 404:
            raise errors.not_found(f"{problem_id} {version} on the judge") from None
        raise
    _record_validation(problem_id, version, report)
    return report


def _record_validation(problem_id: str, version: str, report: dict[str, Any]) -> None:
    """Keep the parts of the judge's report worth reading later, beside the package."""
    meta = read_problem_json(problem_id, version) or {}
    reference = report.get("reference") or {}
    time_limit_ms = int(meta.get("time_limit_ms") or 0)
    record = {
        "at": clock.iso(clock.now()),
        "verdict": reference.get("verdict"),
        "passed": reference.get("passed"),
        "testcases": report.get("testcases"),
        "max_time_ms": reference.get("max_time_ms"),
        "time_limit_ms": time_limit_ms or None,
        "ok": report.get("ok"),
    }
    _write_validation(problem_id, version, record)


def _write_validation(problem_id: str, version: str, record: dict[str, Any]) -> None:
    path = dir_for(problem_id, version, "validation.json")
    # A package we cannot write to still validated; the record is a convenience.
    with contextlib.suppress(OSError):
        path.write_text(json.dumps(record, indent=2) + "\n")


def validation_of(problem_id: str, version: str | None) -> dict[str, Any] | None:
    if not version:
        return None
    try:
        return json.loads(dir_for(problem_id, version, "validation.json").read_text())
    except (OSError, ValueError):
        return None


def stamp_imported_validation(problem_id: str, version: str) -> dict[str, Any] | None:
    """Keep a validation that arrived in a zip, marked as having run elsewhere."""
    record = validation_of(problem_id, version)
    if record is None:
        return None
    stamped = {**record, "imported": clock.iso(clock.now())}
    _write_validation(problem_id, version, stamped)
    return stamped


def mark_validated(problem_id: str, ok: bool) -> None:
    with db.transaction() as conn:
        conn.execute(sa.update(question).where(question.c.id == problem_id).values(validated=ok))


def validate_and_record(problem_id: str, version: str, body: dict[str, Any]) -> dict[str, Any]:
    """Validate a version and set the question's validated flag from the result."""
    report = validate_version(problem_id, version, body)
    mark_validated(problem_id, report["ok"])
    return report


def validate_all() -> list[dict[str, Any]]:
    """Validate every package that can be, one at a time.

    Sequential on purpose: the judge is sized for a contest, and a burst of
    validations racing real submissions would slow both.
    """
    return [_validate_one(p) for p in packages_on_disk()]


def _validate_one(package: dict[str, Any]) -> dict[str, Any]:
    pid = package["problem_id"]
    version = latest_or_current(pid)
    row = {
        "id": pid,
        "version": version,
        "ok": False,
        "skipped": None,
        "verdict": None,
        "passed": None,
        "testcases": None,
        "max_time_ms": None,
        "issues": [],
    }
    if package["hack_only"]:
        return row | {"skipped": "hacking package — nothing to validate against"}
    if version is None:
        return row | {"skipped": "no version on disk"}
    if not package["has_reference"]:
        return row | {"skipped": "no reference solution in the package"}
    try:
        report = validate_and_record(pid, version, {})
    except errors.EngineError as err:
        return row | {"issues": [err.message]}
    reference = report.get("reference") or {}
    return row | {
        "ok": report["ok"],
        "verdict": reference.get("verdict"),
        "passed": reference.get("passed"),
        "testcases": report.get("testcases"),
        "max_time_ms": reference.get("max_time_ms"),
        "issues": report.get("issues", []),
    }
