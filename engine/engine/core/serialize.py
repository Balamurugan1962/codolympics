"""Turning database rows into JSON-ready dicts.

Most responses are built field by field. A few return a whole row, as the
original web API did, and those rows went out with camelCase keys; `camel_row`
keeps that shape so the frontend reads them unchanged.
"""

from __future__ import annotations

import json
from collections.abc import Mapping
from datetime import datetime
from typing import Any

from engine.core.clock import iso


def plain(value: Any) -> Any:
    if isinstance(value, datetime):
        return iso(value)
    return value


def to_camel(name: str) -> str:
    head, *rest = name.split("_")
    return head + "".join(part[:1].upper() + part[1:] for part in rest)


def camel_row(row: Mapping[str, Any]) -> dict[str, Any]:
    return {to_camel(key): plain(value) for key, value in row.items()}


def rows(result: Any) -> list[dict[str, Any]]:
    """Every row of a result as a camelCase dict."""
    return [camel_row(r) for r in result.mappings()]


def _default(value: Any) -> Any:
    if isinstance(value, datetime):
        return iso(value)
    if isinstance(value, (set, tuple)):
        return list(value)
    raise TypeError(f"not JSON serialisable: {type(value).__name__}")


def dumps(value: Any) -> str:
    return json.dumps(value, default=_default)
