"""Authoring Phase 1 questions: puzzles (Section A) and hacking questions (Section B).

`section` in every path is "puzzles" or "hacking". Evaluators write and self-test
questions; putting one in front of participants is the administrator's call.
"""

from __future__ import annotations

from typing import Annotated, Any, Literal

from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import JSONResponse, Response
from pydantic import Field

from engine.core import errors
from engine.packages import listing, phase1_zip
from engine.phase1 import authoring, self_tests

from ...auth import Admin, Staff
from ...common import ReasonBody, download, in_thread, read_upload
from .phase1_bodies import HackTrial, PuzzleTrial, question_fields

router = APIRouter(prefix="/api/admin/phase1")

MAX_IMPORT_BYTES = 8 * 1024 * 1024


class OrderBody(ReasonBody):
    ids: Annotated[list[int], Field(max_length=500)]


# Static paths first: /{section}/export and /{section}/import must not be read as a question id.


@router.get("/{section}/export")
def export_section(_: Staff, section: Literal["puzzles", "hacking", "all"]) -> Response:
    """A whole section as one zip; `all` takes both."""
    sections = ["puzzles", "hacking"] if section == "all" else [section]
    filename, content = phase1_zip.export_many(sections)
    return download(filename, content, "application/zip")


@router.post("/{section}/import")
async def import_section(
    viewer: Staff,
    section: Literal["puzzles", "hacking", "all"],
    package: Annotated[UploadFile | None, File()] = None,
    reason: Annotated[str, Form()] = "",
) -> dict[str, Any]:
    """Questions from a zip. Everything lands as a draft until someone here publishes it."""
    data = await read_upload(package, reason, MAX_IMPORT_BYTES)
    known_packages = listing.known_problem_ids()
    return await in_thread(
        phase1_zip.import_package, viewer.id, data, reason.strip(), known_packages
    )


@router.post("/{section}/publish-all")
def publish_all(viewer: Admin, section: str, body: ReasonBody) -> dict[str, Any]:
    authoring.table_for(section)
    return authoring.publish_all(viewer.id, section, body.reason)


@router.post("/{section}/order")
def reorder_questions(viewer: Staff, section: str, body: OrderBody) -> dict[str, bool]:
    authoring.reorder(viewer.id, section, body.ids, body.reason)
    return {"ok": True}


@router.get("/{section}")
def list_questions(_: Staff, section: str) -> dict[str, Any]:
    """All questions in a section, with their secrets."""
    return {"questions": authoring.list_section(section)}


@router.post("/{section}")
def create_question(viewer: Staff, section: str, body: dict[str, Any]) -> JSONResponse:
    values, reason = question_fields(section, body)
    question_id = authoring.create(viewer.id, section, values, reason)
    return JSONResponse({"id": question_id}, status_code=201)


@router.patch("/{section}/{question_id}")
def update_question(
    viewer: Staff, section: str, question_id: int, body: dict[str, Any]
) -> dict[str, bool]:
    values, reason = question_fields(section, body)
    authoring.update(viewer.id, section, question_id, values, reason)
    return {"ok": True}


@router.delete("/{section}/{question_id}")
def delete_question(
    viewer: Admin, section: str, question_id: int, body: ReasonBody
) -> dict[str, bool]:
    """Deleted if nobody has answered or attempted it; otherwise it is voided instead."""
    authoring.delete_question(viewer.id, section, question_id, body.reason)
    return {"ok": True}


@router.get("/{section}/{question_id}/export")
def export_question(_: Staff, section: Literal["puzzles", "hacking"], question_id: int) -> Response:
    filename, content = phase1_zip.export_one(section, question_id)
    return download(filename, content, "application/zip")


@router.post("/{section}/{question_id}/test")
def self_test(_: Staff, section: str, question_id: int, body: dict[str, Any]) -> dict[str, Any]:
    if section == "puzzles":
        trial = PuzzleTrial.model_validate(body)
        return self_tests.self_test_puzzle(
            question_id, trial.answer, trial.should_pass, trial.should_fail
        )
    if section == "hacking":
        trial = HackTrial.model_validate(body)
        return self_tests.self_test_hack(question_id, trial.solution_id, trial.breaking_input)
    raise errors.not_found("section")


@router.post("/{section}/{question_id}/publish")
def publish_question(
    viewer: Admin, section: str, question_id: int, body: ReasonBody
) -> dict[str, bool]:
    authoring.set_published(viewer.id, section, question_id, True, body.reason)
    return {"ok": True}


@router.post("/{section}/{question_id}/unpublish")
def unpublish_question(
    viewer: Admin, section: str, question_id: int, body: ReasonBody
) -> dict[str, bool]:
    authoring.set_published(viewer.id, section, question_id, False, body.reason)
    return {"ok": True}


@router.post("/{section}/{question_id}/void")
def void_question(
    viewer: Admin, section: str, question_id: int, body: ReasonBody
) -> dict[str, bool]:
    authoring.void(viewer.id, section, question_id, body.reason)
    return {"ok": True}
