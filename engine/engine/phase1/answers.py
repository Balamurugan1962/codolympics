"""Section A answers: normalising what a participant sent, and scoring it against the key.

Everything here is a pure function of the question row and the answer. Normalising
enforces the shape the client should already have checked; string conversion and
rounding deliberately follow JavaScript's String(x) and Math.round.
"""

from __future__ import annotations

import math
import re
from typing import Any

import sqlalchemy as sa

from engine.core import errors


def _as_list(raw: Any, message: str) -> list:
    if not isinstance(raw, list):
        raise errors.invalid(message)
    return raw


def _as_int(value: Any) -> int | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if number.is_integer():
        return int(number)
    return None


def _check_format(q: sa.Row, text: str) -> str:
    if q.format_regex and not re.search(q.format_regex, text):
        if q.format_hint:
            raise errors.invalid(f"expected: {q.format_hint}")
        raise errors.invalid("answer has the wrong format")
    return text


def _js_string(value: Any) -> str:
    """String(x) as JavaScript would write it, for answers that arrive as numbers or booleans."""
    if isinstance(value, bool):
        return "true" if value else "false"
    if value is None:
        return "null"
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def normalise_answer(q: sa.Row, raw: Any) -> Any:
    """Enforce the shape the client should already have checked.

    A manipulated client must not get past it.
    """
    cfg = q.config or {}
    kind = q.kind
    if kind == "mcq_single":
        n = _as_int(raw)
        if n is None or not 0 <= n < len(cfg.get("options") or []):
            raise errors.invalid("pick one option")
        return n
    if kind == "mcq_multi":
        picks = {_as_int(x) for x in _as_list(raw, "pick options")}
        option_count = len(cfg.get("options") or [])
        return sorted(n for n in picks if n is not None and 0 <= n < option_count)
    if kind == "fill_blank":
        return _check_format(q, _js_string(raw).strip()[:500])
    if kind == "numeric":
        return _normalise_numeric(q, raw)
    if kind == "sequence":
        return _normalise_sequence(cfg, raw)
    if kind == "set":
        raw_entries = _as_list(raw, "answer must be a list")[: q.max_entries]
        entries = [_js_string(x).strip() for x in raw_entries]
        return [_check_format(q, e) for e in entries if e]
    return _js_string(raw)[:20_000]  # long_text


def _normalise_numeric(q: sa.Row, raw: Any) -> str:
    text = _js_string(raw).strip()
    try:
        float(text)
    except ValueError:
        text = ""
    if not text:
        raise errors.invalid("enter a number")
    return _check_format(q, text)


def _normalise_sequence(cfg: dict[str, Any], raw: Any) -> list[int]:
    n = len(cfg.get("items") or [])
    order = [_as_int(x) for x in _as_list(raw, "order the items")]
    if len(order) != n or len(set(order)) != n or any(i is None or not 0 <= i < n for i in order):
        raise errors.invalid("every item must appear exactly once")
    return order


def _norm(text: str, case_sensitive: bool | None) -> str:
    collapsed = re.sub(r"\s+", " ", text.strip())
    return collapsed if case_sensitive else collapsed.lower()


def score_auto(q: sa.Row, answer: Any) -> int:
    """Score an `auto` answer against the key."""
    key = q.answer_key or {}
    cfg = q.config or {}
    kind = q.kind
    if kind == "mcq_single":
        return q.points if answer == key.get("option") else 0
    if kind == "mcq_multi":
        return _score_selection(
            q.points,
            set(key.get("options") or []),
            set(answer),
            cfg.get("partialCredit"),
        )
    if kind == "fill_blank":
        case_sensitive = cfg.get("caseSensitive")
        got = _norm(str(answer), case_sensitive)
        accepted = key.get("accepted") or []
        if any(_norm(a, case_sensitive) == got for a in accepted):
            return q.points
        return 0
    if kind == "numeric":
        return _score_numeric(q.points, answer, key.get("value"), cfg.get("tolerance") or 0)
    if kind == "sequence":
        return q.points if answer == (key.get("order") or []) else 0
    if kind == "set":
        case_sensitive = cfg.get("caseSensitive")
        want = {_norm(m, case_sensitive) for m in key.get("members") or []}
        got = {_norm(m, case_sensitive) for m in answer}
        return _score_selection(q.points, want, got, cfg.get("partialCredit"))
    return 0  # long_text is never auto-scored


def _score_selection(points: int, want: set, got: set, partial: bool | None) -> int:
    if not partial:
        return points if want == got else 0
    # Each correct pick earns its share; each wrong pick cancels one.
    correct = len(got & want)
    wrong = len(got) - correct
    if not want:
        return 0
    return max(0, _js_round(points * (correct - wrong) / len(want)))


def _js_round(x: float) -> int:
    """Math.round: halves go up, not to even."""
    return math.floor(x + 0.5)


def _score_numeric(points: int, answer: Any, want: float | None, tolerance: float) -> int:
    try:
        got = float(answer)
    except (TypeError, ValueError):
        return 0
    if want is None or math.isnan(got):
        return 0
    return points if abs(got - want) <= tolerance else 0


def distinct_entries(q: sa.Row, answer: Any) -> list[str]:
    """Distinct entries after normalising whitespace and (unless case-sensitive) case."""
    if isinstance(answer, list):
        raw = [_js_string(x) for x in answer]
    else:
        raw = str(answer or "").split("\n")
    seen: dict[str, str] = {}
    for entry in raw:
        text = entry.strip()
        if not text:
            continue
        normalised = _norm(text, (q.config or {}).get("caseSensitive"))
        if normalised not in seen:
            seen[normalised] = text
    return list(seen.values())[: q.max_entries]
