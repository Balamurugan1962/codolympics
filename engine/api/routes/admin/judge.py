"""What the judge is doing, and submissions in full -- for staff resolving disputes."""

from __future__ import annotations

from typing import Any
from urllib.parse import unquote

from fastapi import APIRouter

from engine.admin import judge_activity, records

from ...auth import Staff

router = APIRouter(prefix="/api/admin")


@router.get("/judge/activity")
def read_judge_activity(_: Staff) -> dict[str, Any]:
    return judge_activity.overview()


@router.get("/judge/activity/{kind}/{ref}")
def read_judge_request(_: Staff, kind: str, ref: str) -> dict[str, Any]:
    return judge_activity.detail(kind, unquote(ref))


@router.get("/submissions")
def list_submissions(
    _: Staff, question: str | None = None, participant: str | None = None
) -> dict[str, Any]:
    return {"submissions": records.submissions(question, participant)}


@router.get("/submissions/{submission_id}")
def read_submission(_: Staff, submission_id: int) -> dict[str, Any]:
    """Source, every judgement kept across rejudges, and the failing testcase.

    The failing testcase is read at the version that was judged.
    """
    return records.submission_detail(submission_id)
