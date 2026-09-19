"""The whole contest setup as one zip, out and back in.

Administrators only: it carries staff credentials.
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import Response

from engine.packages import setup_zip

from ...auth import Admin
from ...common import download, in_thread, read_upload

router = APIRouter(prefix="/api/admin/setup")

MAX_SETUP_BYTES = 128 * 1024 * 1024


@router.get("")
def export_setup(_: Admin, staff: str = "1") -> Response:
    filename, content = setup_zip.export_setup(include_staff=staff != "0")
    return download(filename, content, "application/zip")


@router.post("")
async def import_setup(
    viewer: Admin,
    package: Annotated[UploadFile | None, File()] = None,
    reason: Annotated[str, Form()] = "",
) -> dict[str, Any]:
    data = await read_upload(package, reason, MAX_SETUP_BYTES)
    return await in_thread(setup_zip.import_setup, viewer.id, data, reason.strip())
