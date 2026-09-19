"""Phase 1 questions as portable zips.

    puzzle.zip     question.json, validator.py?
    hack.zip       question.json, given.<ext>
    a set          manifest.json, puzzles/<slug>/..., hacking/<slug>/...

Scripts are written out as real files so they can be diffed and edited. A
hacking question does not carry its judge package -- that moves with the
Problems export -- and importing one whose package is missing lands as a draft.
"""

from __future__ import annotations

import json
import re
from typing import Any

import sqlalchemy as sa

from engine.contest.rules import get_contest
from engine.core import clock, db, errors
from engine.packages.zips import json_bytes, read_zip, write_zip
from engine.phase1.authoring import create, set_published
from engine.phase1.self_tests import carry_verification
from engine.schema import P1_CATEGORIES, P1_GRADING, P1_KINDS, p1_hack_question, p1_question

FORMAT = 1

EXTENSION = {
    "cpp": "cpp",
    "c": "c",
    "python": "py",
    "pypy": "py",
    "java": "java",
    "javascript": "js",
    "typescript": "ts",
    "go": "go",
    "rust": "rs",
    "kotlin": "kt",
}


def _slug(title: str, question_id: int) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:40]
    return f"{question_id:03d}-{base or 'question'}"


def _puzzle_files(q: sa.Row) -> dict[str, bytes]:
    """A puzzle's question.json, and its validator as a file of its own.

    Readiness and live-ness travel: they are work, not circumstance. Both land
    marked as second-hand.
    """
    doc: dict[str, Any] = {
        "format": FORMAT,
        "type": "puzzle",
        "title": q.title,
        "body_md": q.body_md,
        "category": q.category,
        "kind": q.kind,
        "grading": q.grading,
        "points": q.points,
        "explain_points": q.explain_points,
        "config": q.config,
        "answer_key": q.answer_key,
        "model_answer": q.model_answer,
        "points_per_entry": q.points_per_entry,
        "max_entries": q.max_entries,
        "format_regex": q.format_regex,
        "format_hint": q.format_hint,
        "verified": q.ready,
        "was_published": q.published,
    }
    files: dict[str, bytes] = {}
    if q.validator_py:
        doc["validator_file"] = "validator.py"
        files["validator.py"] = q.validator_py.encode()
    files["question.json"] = json_bytes(doc)
    return files


def _hack_files(q: sa.Row) -> dict[str, bytes]:
    name = f"given.{EXTENSION.get(q.given_language, 'txt')}"
    doc = {
        "format": FORMAT,
        "type": "hack",
        "title": q.title,
        "statement_md": q.statement_md,
        "constraints_md": q.constraints_md,
        "problem_id": q.problem_id,
        "given_language": q.given_language,
        "given_file": name,
        "hack_points": q.hack_points,
        "fail_penalty": q.fail_penalty,
        "verified": q.ready,
        "was_published": q.published,
        # An answer: keep this zip as carefully as the answer keys already in it.
        "breaking_input": q.breaking_input,
    }
    return {"question.json": json_bytes(doc), name: q.given_source.encode()}


def export_one(section: str, question_id: int) -> tuple[str, bytes]:
    if section == "puzzles":
        table, pack = p1_question, _puzzle_files
    else:
        table, pack = p1_hack_question, _hack_files
    with db.transaction() as conn:
        q = conn.execute(sa.select(table).where(table.c.id == question_id)).one_or_none()
    if q is None:
        raise errors.not_found("question")
    return f"{_slug(q.title, q.id)}.zip", write_zip(pack(q))


def export_many(sections: list[str]) -> tuple[str, bytes]:
    files: dict[str, bytes] = {}
    manifest: dict[str, Any] = {
        "format": FORMAT,
        "exported_at": clock.iso(clock.now()),
        "puzzles": [],
        "hacking": [],
    }
    with db.transaction() as conn:
        for section in sections:
            if section == "puzzles":
                table, pack = p1_question, _puzzle_files
            else:
                table, pack = p1_hack_question, _hack_files
            for q in conn.execute(sa.select(table).order_by(table.c.order_index, table.c.id)):
                folder = f"{section}/{_slug(q.title, q.id)}"
                manifest[section].append(folder)
                for name, data in pack(q).items():
                    files[f"{folder}/{name}"] = data
    files["manifest.json"] = json_bytes(manifest)
    what = sections[0] if len(sections) == 1 else "phase1"
    return f"codolympics-{what}-{clock.now().date().isoformat()}.zip", write_zip(files)


def import_package(
    actor_id: str,
    zip_bytes: bytes,
    reason: str,
    known_problem_ids: set[str],
    go_live: bool = False,
) -> dict[str, Any]:
    """Import every question in a zip. Without go_live each lands as a draft, whatever it claims."""
    files = read_zip(zip_bytes)
    dirs = sorted(n[: -len("question.json")] for n in files if n.endswith("question.json"))
    if not dirs:
        raise errors.invalid(
            "no question.json in the zip, export one from this page to see the shape"
        )
    out: dict[str, Any] = {
        "created": [],
        "verified": 0,
        "unverified": [],
        "published": 0,
        "missingPackages": [],
        "skipped": [],
    }
    with db.transaction() as conn:
        # Restoring what was live is only safe before anyone is looking.
        go_live = go_live and get_contest(conn).phase == "registration"
    for folder in dirs:
        _import_one(actor_id, files, folder, reason, known_problem_ids, go_live, out)
    if not out["created"]:
        first = out["skipped"][0]["why"] if out["skipped"] else None
        message = f"nothing could be imported: {first}" if first else "nothing to import"
        raise errors.invalid(message)
    return out


def _import_one(
    actor_id: str,
    files: dict[str, bytes],
    folder: str,
    reason: str,
    known: set[str],
    go_live: bool,
    out: dict[str, Any],
) -> None:
    """Import the question in one folder, or record in `out` why it was skipped."""
    try:
        doc = json.loads(files[f"{folder}question.json"])
    except ValueError:
        out["skipped"].append({"path": f"{folder}question.json", "why": "not valid JSON"})
        return
    if isinstance(doc.get("format"), int) and doc["format"] > FORMAT:
        out["skipped"].append(
            {
                "path": folder or "question.json",
                "why": f"made by a newer version (format {doc['format']})",
            }
        )
        return
    try:
        if doc.get("type") == "hack":
            _import_hack(actor_id, files, folder, doc, reason, known, go_live, out)
        else:
            _import_puzzle(actor_id, files, folder, doc, reason, go_live, out)
    except errors.EngineError as err:
        out["skipped"].append({"path": folder or "question.json", "why": err.message})


def _import_hack(
    actor_id: str,
    files: dict[str, bytes],
    folder: str,
    doc: dict[str, Any],
    reason: str,
    known: set[str],
    go_live: bool,
    out: dict[str, Any],
) -> None:
    given_name = str(doc.get("given_file") or "")
    source = files.get(f"{folder}{given_name}") if given_name else None
    if source is None:
        raise errors.invalid(
            f"the given solution ({given_name or 'given_file'}) is missing from the zip"
        )
    problem_id = str(doc.get("problem_id") or "")
    title = str(doc.get("title") or "Untitled")
    fields = {
        "title": title,
        "statement_md": str(doc.get("statement_md") or ""),
        "constraints_md": str(doc.get("constraints_md") or ""),
        "problem_id": problem_id,
        "given_source": source.decode(),
        "given_language": str(doc.get("given_language") or "cpp"),
        "hack_points": int(doc.get("hack_points") or 0),
        "fail_penalty": int(doc.get("fail_penalty") or 0),
        "order_index": 0,
    }
    new_id = create(actor_id, "hacking", fields, reason)
    entry = {
        "section": "hacking",
        "id": new_id,
        "title": title,
        "verified": False,
        "published": False,
    }
    out["created"].append(entry)
    if not problem_id or problem_id not in known:
        # A proof is about a package; with none here, readiness cannot carry.
        out["missingPackages"].append({"title": title, "problem_id": problem_id})
    elif doc.get("verified") is True:
        breaking_input = doc.get("breaking_input")
        if breaking_input is not None:
            breaking_input = str(breaking_input)
        carry_verification("hacking", new_id, breaking_input)
        _mark_verified(actor_id, "hacking", new_id, doc, reason, go_live, entry, out)
    else:
        out["unverified"].append(title)


def _import_puzzle(
    actor_id: str,
    files: dict[str, bytes],
    folder: str,
    doc: dict[str, Any],
    reason: str,
    go_live: bool,
    out: dict[str, Any],
) -> None:
    validator_name = str(doc["validator_file"]) if doc.get("validator_file") else None
    validator = files.get(f"{folder}{validator_name}") if validator_name else None
    if validator_name and validator is None:
        raise errors.invalid(f"the validator ({validator_name}) is missing from the zip")
    choices = (("kind", P1_KINDS), ("category", P1_CATEGORIES), ("grading", P1_GRADING))
    for key, allowed in choices:
        if str(doc.get(key) or "") not in allowed:
            raise errors.invalid(f'unknown {key} "{doc.get(key) or ""}"')
    title = str(doc.get("title") or "Untitled")
    new_id = create(actor_id, "puzzles", _puzzle_fields(doc, title, validator), reason)
    entry = {
        "section": "puzzles",
        "id": new_id,
        "title": title,
        "verified": False,
        "published": False,
    }
    out["created"].append(entry)
    if doc.get("verified") is True:
        carry_verification("puzzles", new_id)
        _mark_verified(actor_id, "puzzles", new_id, doc, reason, go_live, entry, out)
    else:
        out["unverified"].append(title)


def _puzzle_fields(doc: dict[str, Any], title: str, validator: bytes | None) -> dict[str, Any]:
    def text_or_none(key: str) -> str | None:
        return None if doc.get(key) is None else str(doc[key])

    def int_or_none(key: str) -> int | None:
        return None if doc.get(key) is None else int(doc[key])

    return {
        "title": title,
        "body_md": str(doc.get("body_md") or ""),
        "category": doc["category"],
        "kind": doc["kind"],
        "grading": doc["grading"],
        "points": int(doc.get("points") or 0),
        "explain_points": int(doc.get("explain_points") or 0),
        "order_index": 0,
        "config": doc.get("config") or {},
        "answer_key": doc.get("answer_key"),
        "model_answer": text_or_none("model_answer"),
        "validator_py": validator.decode() if validator is not None else None,
        "points_per_entry": int_or_none("points_per_entry"),
        "max_entries": int(doc.get("max_entries") or 100),
        "format_regex": text_or_none("format_regex"),
        "format_hint": text_or_none("format_hint"),
    }


def _mark_verified(
    actor_id: str,
    section: str,
    new_id: int,
    doc: dict[str, Any],
    reason: str,
    go_live: bool,
    entry: dict[str, Any],
    out: dict[str, Any],
) -> None:
    """Count a question as verified; with go_live, publish it if it was published before."""
    entry["verified"] = True
    out["verified"] += 1
    if go_live and doc.get("was_published") is True:
        set_published(actor_id, section, new_id, True, reason)
        entry["published"] = True
        out["published"] += 1
