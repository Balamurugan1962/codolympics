"""The organisers' problem list: every package, whether or not the judge can serve it yet.

The judge only knows the versions that are live, and the volume also holds uploads
that have not been published. Both are merged here by problem id.
"""

from __future__ import annotations

import contextlib
from typing import Any

from engine.judge import client as judge_client
from engine.judge.client import JudgeError
from engine.packages.validation import validation_of
from engine.packages.volume import current_version, packages_on_disk, versions_of


def listing() -> list[dict[str, Any]]:
    """Every package, whether or not the judge can serve it yet.

    The judge's entry wins where both know one.
    """
    by_id = {p["problem_id"]: p for p in packages_on_disk()}
    try:
        for live in judge_client.problems():
            by_id[live["problem_id"]] = live
    except JudgeError:
        pass
    out = []
    for pid in sorted(by_id):
        versions = versions_of(pid)
        current = current_version(pid)
        if current:
            newest = current
        elif versions:
            newest = versions[-1]
        else:
            newest = by_id[pid]["version"]
        out.append(
            {
                **by_id[pid],
                "versions": versions,
                "current": current,
                "last_validation": validation_of(pid, newest),
            }
        )
    return out


def known_problem_ids() -> set[str]:
    """Packages on the volume and on the judge: a hacking package is usually still unpublished."""
    known = {p["problem_id"] for p in packages_on_disk()}
    with contextlib.suppress(JudgeError):
        known |= {p["problem_id"] for p in judge_client.problems()}
    return known
