"""A whole Phase 2 problem as one portable zip: the judge package and the contest details.

    question.json        title, statement, score, price, hints
    package/...          the judge package, byte for byte

A bundle of problems holds one such folder per problem under `problems/<id>/`.
`package/` alone is exactly what the plain upload accepts, so a zip built by hand
for the judge still imports here.

An import lands as a new unpublished version. It is published only when the
importer asks for that, the problem was live where the zip was made, and the
contest is still in registration.
"""

from __future__ import annotations

import contextlib
import json
from dataclasses import asdict, dataclass, field
from typing import Any

import sqlalchemy as sa

from engine.coding.question_authoring import write_question
from engine.contest.rules import get_contest
from engine.core import clock, db, errors
from engine.core.audit import audit
from engine.packages.publishing import publish_version
from engine.packages.validation import stamp_imported_validation, validation_of
from engine.packages.volume import (
    ID,
    current_version,
    dir_for,
    latest_or_current,
    root,
    upload_package,
)
from engine.packages.zips import bundle_dirs, check_format, json_bytes, read_zip, subtree, write_zip
from engine.schema import DIFFICULTIES, hint, question

FORMAT = 1
MAX_PACKAGE_BYTES = 64 * 1024 * 1024


def _read_version(problem_id: str, version: str) -> dict[str, bytes]:
    base = dir_for(problem_id, version)
    if not base.is_dir():
        raise errors.not_found("package version")
    out = {}
    total = 0
    for path in sorted(p for p in base.rglob("*") if p.is_file()):
        data = path.read_bytes()
        total += len(data)
        if total > MAX_PACKAGE_BYTES:
            raise errors.invalid("that package is larger than 64 MB")
        out[path.relative_to(base).as_posix()] = data
    return out


def export_problem(problem_id: str) -> tuple[str, bytes]:
    """One problem as a zip.

    The package is the live version if there is one -- what this contest actually
    ran -- otherwise the newest upload.
    """
    files = problem_files(problem_id)
    return f"{problem_id}.zip", write_zip(files)


def problem_files(problem_id: str) -> dict[str, bytes]:
    if not ID.match(problem_id):
        raise errors.invalid("problem id: letters, digits, . _ - only")
    with db.transaction() as conn:
        q = conn.execute(sa.select(question).where(question.c.id == problem_id)).one_or_none()
        hints = conn.execute(
            sa.select(hint).where(hint.c.question_id == problem_id).order_by(hint.c.idx)
        ).all()
    version = latest_or_current(problem_id)
    if q is None and version is None:
        raise errors.not_found("problem")
    files: dict[str, bytes] = {}
    if version:
        for name, data in _read_version(problem_id, version).items():
            files[f"package/{name}"] = data
    files["question.json"] = json_bytes(_question_doc(problem_id, q, hints, version))
    return files


def _question_doc(
    problem_id: str, q: sa.Row | None, hints: list[sa.Row], version: str | None
) -> dict[str, Any]:
    details = None
    if q is not None:
        details = {
            "title": q.title,
            "topic": q.topic,
            "difficulty": q.difficulty,
            "score": q.score,
            "base_price": q.base_price,
            "statement_md": q.statement_md,
            "sample_count": q.sample_count,
            "hints": [{"price": h.price, "body_md": h.body_md} for h in hints],
        }
    return {
        "format": FORMAT,
        "type": "problem",
        "id": problem_id,
        "details": details,
        # For the reader, never replayed: the running order belongs to the contest that
        # exported it, and a validation from another machine says nothing about this
        # machine's speed.
        "exported_from": {
            "version": version,
            "auction_order": q.auction_order if q else None,
            "was_live": current_version(problem_id) is not None,
            "validation": validation_of(problem_id, version) if version else None,
        },
    }


def export_all_problems() -> tuple[str, bytes]:
    """Every problem, each in its own folder with the same shape it has alone."""
    ids = all_problem_ids()
    if not ids:
        raise errors.not_found("problems")
    files = problems_bundle(ids)
    manifest = {
        "format": FORMAT,
        "type": "problems",
        "exported_at": clock.iso(clock.now()),
        "ids": ids,
    }
    files["manifest.json"] = json_bytes(manifest)
    return f"codolympics-problems-{clock.now().date().isoformat()}.zip", write_zip(files)


def problems_bundle(ids: list[str]) -> dict[str, bytes]:
    """Each problem under `problems/<id>/`, in the same shape it has exported alone."""
    files: dict[str, bytes] = {}
    for problem_id in ids:
        for name, data in problem_files(problem_id).items():
            files[f"problems/{problem_id}/{name}"] = data
    return files


def all_problem_ids() -> list[str]:
    """Described questions and packages on disk.

    Half-finished work in either place is worth carrying.
    """
    with db.transaction() as conn:
        described = (
            conn.execute(sa.select(question.c.id).order_by(question.c.auction_order, question.c.id))
            .scalars()
            .all()
        )
    on_disk: list[str] = []
    if root().is_dir():
        on_disk = sorted(p.name for p in root().iterdir() if p.is_dir())
    unique = dict.fromkeys([*described, *on_disk])
    return [pid for pid in unique if ID.match(pid)]


@dataclass
class ProblemImport:
    id: str
    version: str | None = None
    details: bool = False
    hints: int = 0
    validated: bool = False  # arrived with a passing validation, so it is not asked for again
    hackOnly: bool = False
    live: bool = False  # published here because it was live where the zip was made
    warnings: list[str] = field(default_factory=list)


def import_problems(
    actor_id: str,
    zip_bytes: bytes,
    reason: str,
    problem_id: str | None = None,
    go_live: bool = False,
) -> list[dict[str, Any]]:
    """A bundle holds `problems/<id>/...`; anything else is a single problem."""
    files = read_zip(zip_bytes)
    dirs = bundle_dirs(files, "problems/")
    if not dirs:
        return [asdict(import_problem(actor_id, files, reason, problem_id, go_live))]
    # In a bundle the id comes from each folder, not from anything typed in the dialog.
    results = []
    for folder in dirs:
        result = import_problem(actor_id, subtree(files, folder), reason, None, go_live)
        results.append(asdict(result))
    return results


def import_problem(
    actor_id: str, files: dict[str, bytes], reason: str, problem_id: str | None, go_live: bool
) -> ProblemImport:
    """Import one problem's files.

    The package becomes a new unpublished version; the details are written if the
    zip carries them.
    """
    meta = _read_meta(files) or {}
    pid = (problem_id or meta.get("id") or "").strip()
    if not pid:
        raise errors.invalid("the zip has no id, give one, or export the problem from this app")
    if not ID.match(pid):
        raise errors.invalid("problem id: letters, digits, . _ - only")
    result = ProblemImport(id=pid)
    validation = _import_package(actor_id, files, reason, result)
    validated = bool(validation and validation.get("ok"))
    details = meta.get("details")
    if details:
        _import_details(actor_id, pid, details, validated, reason, result)
    else:
        result.warnings.append(
            "No contest details in the zip, add a title, statement and price"
            " before this can be auctioned."
        )
        with db.transaction() as conn:
            audit(
                conn,
                actor_id=actor_id,
                action="problem.import",
                target=pid,
                reason=reason,
                detail={"version": result.version, "hints": 0},
            )
    result.validated = validated
    was_live = go_live and bool(meta.get("exported_from", {}).get("was_live"))
    _maybe_go_live(actor_id, reason, was_live, result)
    return result


def _read_meta(files: dict[str, bytes]) -> dict[str, Any] | None:
    names = [n for n in files if n == "question.json" or n.endswith("/question.json")]
    if not names:
        return None
    meta = json.loads(files[names[0]])
    check_format(meta, FORMAT)
    return meta


def _import_package(
    actor_id: str, files: dict[str, bytes], reason: str, result: ProblemImport
) -> dict[str, Any] | None:
    """Upload the zip's judge package, returning any validation record that came with it."""
    prefix = "package/" if any(n.startswith("package/") for n in files) else ""
    package = {}
    for name, data in files.items():
        rel = name[len(prefix) :]
        if name.startswith(prefix) and rel not in ("", "question.json") and ".." not in name:
            package[rel] = data
    if not package:
        result.warnings.append(
            "No judge package in the zip. The details were imported, but nothing can be"
            " judged until one is uploaded."
        )
        return None
    if "problem.json" not in package:
        raise errors.invalid("the package has no problem.json at its root")
    result.version = upload_package(actor_id, result.id, write_zip(package), reason)
    with contextlib.suppress(ValueError):
        result.hackOnly = bool(json.loads(package["problem.json"]).get("hack_only"))
    # validation.json lives in the version directory, so it travelled with the package.
    return stamp_imported_validation(result.id, result.version)


def _import_details(
    actor_id: str,
    pid: str,
    details: dict[str, Any],
    validated: bool,
    reason: str,
    result: ProblemImport,
) -> None:
    difficulty = str(details.get("difficulty", "")).strip().lower().replace(" ", "_")
    if difficulty not in DIFFICULTIES:
        raise errors.invalid(f'unknown difficulty "{difficulty}"')
    hints = details.get("hints")
    if not isinstance(hints, list):
        hints = []
    with db.transaction() as conn:
        existing = conn.execute(
            sa.select(question.c.auction_order).where(question.c.id == pid)
        ).scalar()
        # A new problem goes to the end of this contest's running order rather than
        # claiming someone's slot.
        if existing is not None:
            order = existing
        else:
            count = conn.execute(sa.select(sa.func.count()).select_from(question)).scalar_one()
            order = count + 1
        values = {
            "title": str(details.get("title") or pid),
            "topic": str(details.get("topic") or ""),
            "difficulty": difficulty,
            "score": int(details.get("score") or 0),
            "base_price": int(details.get("base_price") or 0),
            "statement_md": str(details.get("statement_md") or ""),
            "sample_count": int(details.get("sample_count") or 0),
            "auction_order": order,
            "validated": validated,
        }
        write_question(conn, pid, values, hints)
        audit(
            conn,
            actor_id=actor_id,
            action="problem.import",
            target=pid,
            reason=reason,
            detail={"version": result.version, "hints": len(hints)},
        )
    result.details = True
    result.hints = len(hints)


def _maybe_go_live(actor_id: str, reason: str, was_live: bool, result: ProblemImport) -> None:
    """Restore what was live where the zip was made -- only in registration, and only if proven."""
    if result.version and was_live:
        with db.transaction() as conn:
            phase = get_contest(conn).phase
        if phase != "registration":
            result.warnings.append(
                f"Left unpublished: the contest is in {phase}, and publishing then rejudges."
                " Publish it yourself when you are ready."
            )
        elif not result.validated and not result.hackOnly:
            result.warnings.append(
                "Left unpublished: nothing in the zip says this package passed validation."
                " Validate it here, then publish."
            )
        else:
            publish_version(actor_id, result.id, result.version, reason, 0)
            result.live = True
    if result.version and not result.live:
        result.warnings.append(_unpublished_note(result))


def _unpublished_note(result: ProblemImport) -> str:
    if result.validated:
        return (
            f"Uploaded as {result.version}, already validated where it was exported."
            " Publish it when you are ready."
        )
    if result.hackOnly:
        return (
            f"Uploaded as {result.version}. A hacking package has no testcases to validate;"
            " publish it when its question is proven."
        )
    return (
        f"Uploaded as {result.version}. Validate it, then publish"
        ". Nothing was published by this import."
    )
