"""Problem packages on the shared volume. The engine writes it; the judge mounts it read-only.

    problems/<id>/
      current -> v3        the live version (see engine.packages.publishing)
      v1/ v2/ v3/          each a complete judge package

An upload extracts into a new version directory and never touches the live one.
Two uploads of the same problem at once each claim a version directory with
`mkdir`, which fails for whoever is second, so they get v4 and v5 rather than
both writing into v4.
"""

from __future__ import annotations

import json
import os
import re
import shutil
from pathlib import Path
from typing import Any

from engine.core import db, errors
from engine.core.audit import audit
from engine.core.config import settings
from engine.judge import client as judge_client
from engine.judge.client import JudgeError
from engine.packages.zips import read_zip

ID = re.compile(r"^[A-Za-z0-9._-]+$")
VERSION = re.compile(r"^v\d+$")


def root() -> Path:
    return settings.problems_dir


def dir_for(problem_id: str, *rest: str) -> Path:
    if not ID.match(problem_id):
        raise errors.invalid("problem id: letters, digits, . _ - only")
    return root().joinpath(problem_id, *rest)


def versions_of(problem_id: str) -> list[str]:
    """The version directories of a problem, oldest first."""
    try:
        names = [
            e.name
            for e in dir_for(problem_id).iterdir()
            if e.is_dir() and not e.is_symlink() and VERSION.match(e.name)
        ]
    except FileNotFoundError:
        return []
    return sorted(names, key=lambda v: int(v[1:]))


def current_version(problem_id: str) -> str | None:
    try:
        return Path(os.readlink(dir_for(problem_id, "current"))).name
    except OSError:
        return None


def latest_or_current(problem_id: str) -> str | None:
    """The live version if there is one, otherwise the newest upload."""
    current = current_version(problem_id)
    if current:
        return current
    versions = versions_of(problem_id)
    return versions[-1] if versions else None


def delete_all_packages() -> int:
    """Remove every package from the volume. Only the full contest wipe calls this."""
    try:
        entries = list(root().iterdir())
    except FileNotFoundError:
        return 0
    for entry in entries:
        if entry.is_dir() and not entry.is_symlink():
            shutil.rmtree(entry, ignore_errors=True)
        else:
            entry.unlink(missing_ok=True)
    return len(entries)


def upload_package(actor_id: str, problem_id: str, zip_bytes: bytes, reason: str) -> str:
    """Extract a zip into a new version directory and return the version.

    The live version is never touched.
    """
    files = _package_files(read_zip(zip_bytes))
    target, version = _claim_next_version(problem_id)
    for rel, data in files.items():
        dest = (target / rel).resolve()
        if not dest.is_relative_to(target.resolve()):
            continue  # a path that tries to escape the version directory
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
    with db.transaction() as conn:
        detail = {"version": version, "files": len(files)}
        audit(
            conn,
            actor_id=actor_id,
            action="problem.upload",
            target=problem_id,
            reason=reason,
            detail=detail,
        )
    return version


def _package_files(files: dict[str, bytes]) -> dict[str, bytes]:
    names = [n for n in files if not Path(n).name.startswith(".")]
    if not names:
        raise errors.invalid("the zip is empty")
    # Everything under one top-level folder: strip it.
    tops = {n.split("/")[0] for n in names}
    strip = ""
    if len(tops) == 1 and all("/" in n for n in names):
        strip = f"{next(iter(tops))}/"
    out = {n[len(strip) :]: files[n] for n in names if ".." not in n}
    if "problem.json" not in out:
        raise errors.invalid("the package has no problem.json at its root")
    return out


def _claim_next_version(problem_id: str) -> tuple[Path, str]:
    """mkdir is atomic: whoever gets the directory owns that version number."""
    base = dir_for(problem_id)
    base.mkdir(parents=True, exist_ok=True)
    versions = versions_of(problem_id)
    number = int(versions[-1][1:]) + 1 if versions else 1
    while True:
        target = base / f"v{number}"
        try:
            target.mkdir()
            return target, f"v{number}"
        except FileExistsError:
            number += 1


def packages_on_disk() -> list[dict[str, Any]]:
    """Every package on the volume, shaped like the judge's ProblemInfo so the two lists merge.

    The judge only serves live versions, so anything uploaded and not yet
    published is invisible to it -- this is how an administrator finds it to publish.
    """
    try:
        ids = sorted(e.name for e in root().iterdir() if e.is_dir() and ID.match(e.name))
    except FileNotFoundError:
        return []
    out = []
    for pid in ids:
        info = _disk_info(pid)
        if info is not None:
            out.append(info)
    return out


def _disk_info(problem_id: str) -> dict[str, Any] | None:
    version = latest_or_current(problem_id)
    if version is None:
        return None
    meta = read_problem_json(problem_id, version)
    if meta is None:
        return None  # not a package, or half-written
    tests = dir_for(problem_id, version, "tests")
    testcases = len(list(tests.glob("*.in"))) if tests.is_dir() else 0
    reference = meta.get("reference") or {}
    return {
        "problem_id": problem_id,
        "testcases": testcases,
        "bytes": dir_for(problem_id, version).stat().st_size,
        "version": version,
        "validated": False,  # only the judge can say; the question row carries our own answer
        "compare": str(meta.get("compare", "tokens")),
        "time_limit_ms": int(meta.get("time_limit_ms") or 0),
        "memory_limit_mb": int(meta.get("memory_limit_mb") or 0),
        "early_exit": bool(meta.get("early_exit", True)),
        "has_reference": bool(reference.get("file")),
        "hack_only": bool(meta.get("hack_only")),
        "modified_at": None,
    }


def read_problem_json(problem_id: str, version: str) -> dict[str, Any] | None:
    try:
        return json.loads(dir_for(problem_id, version, "problem.json").read_text())
    except (OSError, ValueError):
        return None


def samples_for(problem_id: str, count: int, version: str | None = None) -> list[dict[str, str]]:
    """The first `count` testcases of a version -- the samples a participant sees."""
    out = []
    for index in range(count):
        try:
            t = judge_client.testcase(problem_id, index, version)
        except JudgeError:
            break
        out.append({"input": t["input"], "output": t["answer"]})
    return out
