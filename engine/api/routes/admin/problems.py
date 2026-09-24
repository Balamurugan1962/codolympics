"""Problem packages: upload, validate, publish, preview samples, import and export.

Evaluators may prove and preview a package. Only an administrator makes one live,
because publishing mid-contest rejudges verdicts people are relying on.
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import JSONResponse, Response
from pydantic import Field

from engine.coding import rejudge
from engine.core import errors
from engine.packages import listing, problem_zip, publishing, validation, volume

from ...auth import Admin, Staff
from ...common import Body, ReasonBody, download, in_thread, read_upload

router = APIRouter(prefix="/api/admin/problems")

MAX_UPLOAD_BYTES = 200 * 1024 * 1024
MAX_IMPORT_BYTES = 64 * 1024 * 1024

Version = Annotated[str, Field(pattern=r"^v\d+$")]


class ValidateBody(Body):
    version: Version
    reference_source: str | None = None
    wrong_source: str | None = None
    language: str | None = None


class LimitsBody(ReasonBody):
    version: Version
    time_limit_ms: Annotated[int, Field(ge=100, le=30_000)]
    memory_limit_mb: Annotated[int, Field(ge=16, le=2048)]


class SamplesBody(Body):
    version: Version | None = None
    count: Annotated[int, Field(ge=0, le=20)]


class PublishBody(ReasonBody):
    version: Version
    confirmed_rejudge: Annotated[int, Field(ge=0)]


@router.get("")
def list_problems(_: Staff) -> dict[str, Any]:
    """Every package, whether or not the judge can serve it yet."""
    return {"problems": listing.listing()}


@router.post("")
async def upload_package(
    viewer: Staff,
    id: Annotated[str, Form()] = "",
    reason: Annotated[str, Form()] = "",
    package: Annotated[UploadFile | None, File()] = None,
) -> JSONResponse:
    """A package zip becomes the next version. The live one is untouched until published."""
    if not id.strip():
        raise errors.invalid("id, reason and a package file are required")
    data = await read_upload(package, reason, MAX_UPLOAD_BYTES)
    version = await in_thread(volume.upload_package, viewer.id, id.strip(), data, reason.strip())
    return JSONResponse({"version": version}, status_code=201)


@router.get("/export")
def export_all_problems(_: Staff) -> Response:
    filename, content = problem_zip.export_all_problems()
    return download(filename, content, "application/zip")


@router.post("/import")
async def import_problems(
    viewer: Staff,
    package: Annotated[UploadFile | None, File()] = None,
    reason: Annotated[str, Form()] = "",
    id: Annotated[str, Form()] = "",
) -> dict[str, Any]:
    """One problem or a bundle. Every package lands unpublished."""
    data = await read_upload(package, reason, MAX_IMPORT_BYTES)
    problem_id = id.strip() or None
    imported = await in_thread(
        problem_zip.import_problems, viewer.id, data, reason.strip(), problem_id
    )
    return {"imported": imported}


@router.post("/validate-all")
def validate_all(_: Staff) -> dict[str, Any]:
    return {"results": validation.validate_all()}


@router.get("/{problem_id}/export")
def export_problem(_: Staff, problem_id: str) -> Response:
    filename, content = problem_zip.export_problem(problem_id)
    return download(filename, content, "application/zip")


@router.post("/{problem_id}/validate")
def validate_version(_: Staff, problem_id: str, body: ValidateBody) -> dict[str, Any]:
    sources = body.model_dump(exclude_none=True, exclude={"version"})
    return validation.validate_and_record(problem_id, body.version, sources)


@router.post("/{problem_id}/limits")
def change_limits(viewer: Staff, problem_id: str, body: LimitsBody) -> dict[str, str]:
    """New limits become the next version, unpublished: validate it, then publish."""
    version = volume.copy_with_limits(
        viewer.id, problem_id, body.version, body.time_limit_ms, body.memory_limit_mb, body.reason
    )
    return {"version": version}


@router.post("/{problem_id}/blast-radius")
def read_blast_radius(_: Staff, problem_id: str) -> dict[str, int]:
    """How many submissions publishing would rejudge."""
    return {"submissions": rejudge.blast_radius(problem_id)}


@router.post("/{problem_id}/samples")
def preview_samples(_: Staff, problem_id: str, body: SamplesBody) -> dict[str, Any]:
    """The organiser's preview: the same first testcases an owner will see."""
    return {"samples": volume.samples_for(problem_id, body.count, body.version)}


@router.post("/{problem_id}/publish")
def publish_version(viewer: Admin, problem_id: str, body: PublishBody) -> dict[str, int]:
    return publishing.publish_version(
        viewer.id, problem_id, body.version, body.reason, body.confirmed_rejudge
    )
