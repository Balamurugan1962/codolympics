"""What every route module shares: request bodies, file uploads and downloads.

Every body is strict: a number must be a number and a string a string, as the
web app's own validation required. Unknown fields are ignored.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Annotated, Any

from fastapi import UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, Field
from starlette.concurrency import run_in_threadpool

from engine.core import errors


class Body(BaseModel):
    model_config = ConfigDict(strict=True, extra="ignore")


Reason = Annotated[str, Field(min_length=3)]
ProblemId = Annotated[str, Field(pattern=r"^[A-Za-z0-9._-]+$")]


class ReasonBody(Body):
    reason: Reason


def fields(model: BaseModel, *, exclude: tuple[str, ...] = ("reason",)) -> dict[str, Any]:
    """The fields the caller actually sent, minus the reason, for passing on to the engine."""
    return model.model_dump(exclude_unset=True, exclude=set(exclude))


async def read_upload(upload: UploadFile | None, reason: str, max_bytes: int) -> bytes:
    """A multipart zip upload with its reason, size-checked."""
    if upload is None:
        raise errors.invalid("attach the zip as `package`")
    if len(reason.strip()) < 3:
        raise errors.invalid("a reason is required")
    data = await upload.read()
    if len(data) > max_bytes:
        raise errors.invalid(f"that zip is larger than {max_bytes // (1024 * 1024)} MB")
    return data


async def in_thread(fn: Callable[..., Any], *args: Any) -> Any:
    """Uploads are read asynchronously; the engine call itself is ordinary blocking code."""
    return await run_in_threadpool(fn, *args)


def download(filename: str, content: bytes, media_type: str) -> Response:
    headers = {
        "content-disposition": f'attachment; filename="{filename}"',
        "cache-control": "no-store",
    }
    return Response(content=content, media_type=media_type, headers=headers)
