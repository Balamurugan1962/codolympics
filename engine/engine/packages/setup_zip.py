"""The whole contest setup as one zip -- and deliberately none of what happened when it ran.

    contest.json      the settings, and the order everything is offered in
    staff.json        administrators and evaluators, with password hashes
    problems/<id>/    each Phase 2 problem: details, hints and judge package
    phase1/...        puzzles and hacking questions

Participants, balances, bids, submissions and the audit log are results, not
setup, and are never carried. An import is additive: nothing here is deleted,
and an existing login is never overwritten.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from typing import Any

import sqlalchemy as sa

from engine.accounts.credentials import generate_id
from engine.accounts.viewer import naive_utc_now
from engine.contest.phases import publish_phase
from engine.contest.rules import get_contest
from engine.core import clock, db, errors
from engine.core.audit import audit
from engine.core.serialize import to_camel
from engine.packages.phase1_zip import export_many as export_phase1
from engine.packages.phase1_zip import import_package as import_phase1
from engine.packages.problem_zip import all_problem_ids, import_problem, problems_bundle
from engine.packages.zips import bundle_dirs, check_format, json_bytes, read_zip, subtree, write_zip
from engine.schema import account, contest, p1_hack_question, p1_question, question, user

FORMAT = 1

SETTINGS = (
    "starting_balance",
    "bid_increment",
    "countdown_seconds",
    "opening_window_seconds",
    "ownership_cap",
    "coding1_minutes",
    "final_minutes",
    "p1_puzzles_minutes",
    "p1_hacking_minutes",
    "p1_selection_basis",
    "p1_leaderboard_mode",
    "leaderboard_mode",
)

# The zip format predates the engine and names settings in camelCase.
CAMEL = {name: to_camel(name) for name in SETTINGS}


def export_setup(include_staff: bool) -> tuple[str, bytes]:
    ids = all_problem_ids()
    files = problems_bundle(ids)
    _, phase1_bytes = export_phase1(["puzzles", "hacking"])
    for name, data in read_zip(phase1_bytes).items():
        if name != "manifest.json":
            files[f"phase1/{name}"] = data
    with db.transaction() as conn:
        files["contest.json"] = json_bytes(_contest_doc(conn, ids))
        if include_staff:
            files["staff.json"] = json_bytes(_staff_doc(conn))
    return f"codolympics-setup-{clock.now().date().isoformat()}.zip", write_zip(files)


def _contest_doc(conn: sa.Connection, ids: list[str]) -> dict[str, Any]:
    c = get_contest(conn)
    questions_query = sa.select(question.c.id).order_by(question.c.auction_order, question.c.id)
    puzzles_query = sa.select(p1_question.c.title).order_by(
        p1_question.c.order_index, p1_question.c.id
    )
    hacks_query = sa.select(p1_hack_question.c.title).order_by(
        p1_hack_question.c.order_index, p1_hack_question.c.id
    )
    questions = conn.execute(questions_query).scalars().all()
    puzzles = conn.execute(puzzles_query).scalars().all()
    hacks = conn.execute(hacks_query).scalars().all()
    return {
        "format": FORMAT,
        "type": "setup",
        "exported_at": clock.iso(clock.now()),
        "settings": {CAMEL[k]: getattr(c, k) for k in SETTINGS},
        "auction_order": list(questions),
        "phase1_order": {"puzzles": list(puzzles), "hacking": list(hacks)},
        "contains": {"problems": len(ids), "puzzles": len(puzzles), "hacks": len(hacks)},
    }


def _staff_doc(conn: sa.Connection) -> dict[str, Any]:
    found = conn.execute(
        sa.select(user, account.c.password, account.c.provider_id)
        .outerjoin(account, account.c.user_id == user.c.id)
        .where(user.c.role.in_(("admin", "evaluator")))
        .order_by(user.c.role, user.c.name)
    ).all()
    return {
        "format": FORMAT,
        "warning": "This file contains password hashes. Treat the zip as a credential file.",
        "staff": [
            {
                "name": r.name,
                "username": r.username,
                "display_username": r.display_username,
                "email": r.email,
                "role": r.role,
                "provider_id": r.provider_id or "credential",
                "password_hash": r.password,
            }
            for r in found
        ],
    }


@dataclass
class SetupSummary:
    settings: bool = False
    staff: int = 0
    problems: int = 0
    puzzles: int = 0
    hacks: int = 0
    verified: int = 0
    published: int = 0
    unverified: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def import_setup(actor_id: str, zip_bytes: bytes, reason: str) -> dict[str, Any]:
    files = read_zip(zip_bytes)
    meta_names = [n for n in files if n == "contest.json" or n.endswith("/contest.json")]
    if not meta_names:
        raise errors.invalid("no contest.json — that is not a setup zip")
    meta_name = meta_names[0]
    prefix = meta_name[: -len("contest.json")]
    meta = json.loads(files[meta_name])
    check_format(meta, FORMAT)
    with db.transaction() as conn:
        phase = get_contest(conn).phase
    summary = SetupSummary()
    if phase != "registration":
        summary.warnings.append(
            f"The contest is in {phase}. Imported content is added, but nothing that has"
            " already happened is touched."
        )
    _import_settings(meta.get("settings"), summary)
    _import_staff(files.get(f"{prefix}staff.json"), summary)
    imported = _import_problems(actor_id, files, prefix, reason, summary)
    _restore_auction_order(meta.get("auction_order"))
    _import_phase1(actor_id, files, prefix, reason, imported, summary)
    _closing_warnings(phase, summary)
    with db.transaction() as conn:
        counted = ("settings", "staff", "problems", "puzzles", "hacks", "verified", "published")
        detail = {k: getattr(summary, k) for k in counted}
        audit(conn, actor_id=actor_id, action="setup.import", reason=reason, detail=detail)
    publish_phase()
    return asdict(summary)


def _import_settings(settings: dict[str, Any] | None, summary: SetupSummary) -> None:
    patch = {}
    if settings:
        for name in SETTINGS:
            if CAMEL[name] in settings:
                patch[name] = settings[CAMEL[name]]
    if not patch:
        return
    with db.transaction() as conn:
        conn.execute(sa.update(contest).values(**patch))
    summary.settings = True


def _import_staff(raw: bytes | None, summary: SetupSummary) -> None:
    if not raw:
        return
    for person in json.loads(raw).get("staff") or []:
        username = str(person.get("username") or "").lower()
        if not username:
            continue
        if not person.get("password_hash"):
            summary.warnings.append(f'Skipped "{username}" — the zip carries no password for it.')
        elif _create_staff_login(person, username):
            summary.staff += 1
        else:
            summary.warnings.append(
                f'Kept the existing account "{username}" — an import never overwrites a login.'
            )


def _create_staff_login(person: dict[str, Any], username: str) -> bool:
    """False if the username is already taken here."""
    with db.transaction() as conn:
        if conn.execute(sa.select(user.c.id).where(user.c.username == username)).first():
            return False
        user_id = generate_id()
        now = naive_utc_now()
        display_username = person.get("display_username") or person.get("name") or username
        conn.execute(
            sa.insert(user).values(
                id=user_id,
                name=str(person.get("name") or username),
                email=str(person.get("email") or f"{username}@contest.local"),
                email_verified=True,
                created_at=now,
                updated_at=now,
                username=username,
                display_username=str(display_username),
                role="admin" if person.get("role") == "admin" else "evaluator",
            )
        )
        # Better Auth finds a credential account by account_id == user id, so it must be the new id.
        conn.execute(
            sa.insert(account).values(
                id=generate_id(),
                account_id=user_id,
                provider_id=str(person.get("provider_id") or "credential"),
                user_id=user_id,
                password=str(person["password_hash"]),
                created_at=now,
                updated_at=now,
            )
        )
    return True


def _import_problems(
    actor_id: str, files: dict[str, bytes], prefix: str, reason: str, summary: SetupSummary
) -> set[str]:
    root = f"{prefix}problems/"
    imported: set[str] = set()
    for folder in bundle_dirs(files, root):
        try:
            result = import_problem(actor_id, subtree(files, folder), reason, None, go_live=True)
        except errors.EngineError as err:
            problem_dir = folder[len(root) :].rstrip("/")
            summary.warnings.append(f"{problem_dir}: {err.message}")
            continue
        imported.add(result.id)
        summary.problems += 1
        # A hacking package is proven by its question's breaking input, never by validation.
        if result.validated:
            summary.verified += 1
        elif not result.hackOnly:
            summary.unverified.append(result.id)
        summary.published += int(result.live)
    return imported


def _restore_auction_order(order: Any) -> None:
    if not isinstance(order, list):
        return
    with db.transaction() as conn:
        for position, question_id in enumerate(order, start=1):
            conn.execute(
                sa.update(question)
                .where(question.c.id == str(question_id))
                .values(auction_order=position)
            )


def _import_phase1(
    actor_id: str,
    files: dict[str, bytes],
    prefix: str,
    reason: str,
    imported: set[str],
    summary: SetupSummary,
) -> None:
    phase1 = subtree(files, f"{prefix}phase1/")
    if not phase1:
        return
    try:
        result = import_phase1(actor_id, write_zip(phase1), reason, imported, go_live=True)
    except errors.EngineError as err:
        summary.warnings.append(f"Phase 1: {err.message}")
        return
    created = result["created"]
    summary.puzzles = sum(1 for q in created if q["section"] == "puzzles")
    summary.hacks = sum(1 for q in created if q["section"] == "hacking")
    summary.verified += result["verified"]
    summary.published += result["published"]
    summary.unverified += result["unverified"]
    for missing in result["missingPackages"]:
        summary.warnings.append(
            f'"{missing["title"]}" needs the judge package {missing["problem_id"]}.'
        )
    for skipped in result["skipped"]:
        summary.warnings.append(f"{skipped['path']}: {skipped['why']}")


def _closing_warnings(phase: str, summary: SetupSummary) -> None:
    if summary.unverified:
        never_proven = ", ".join(summary.unverified)
        summary.warnings.append(
            f"Never proven anywhere: {never_proven}. Validate or self-test each of these"
            " here before publishing it."
        )
    if phase != "registration":
        summary.warnings.append(
            "Nothing was published, because the contest is already running — publishing now"
            " would change what participants can see."
        )
    elif summary.published == 0 and summary.problems + summary.puzzles + summary.hacks > 0:
        summary.warnings.append(
            "Nothing in the zip was live when it was exported, so nothing was published here."
        )
