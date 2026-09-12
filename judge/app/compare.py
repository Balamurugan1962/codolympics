"""Deciding whether a contestant's output matches the expected answer.

Four modes need no code from the problem setter (US-J3-01). The fifth,
`checker`, runs a Python program in the sandbox and lives in checker.py.

Every function here is pure: no I/O, no sandbox, no configuration. That makes
the comparison rules testable on their own, which is where most subtle judging
bugs would otherwise hide.
"""
from __future__ import annotations

from dataclasses import dataclass

# Only these spellings are treated as the same answer in `yesno` mode. Anything
# else falls through to an ordinary token comparison.
_YES = {"yes", "y", "true"}
_NO = {"no", "n", "false"}


@dataclass
class Comparison:
    ok: bool
    # Shown to the jury only -- it names the expected value, which would hand a
    # contestant the answer.
    detail: str = ""


def compare(mode: str, output: str, answer: str, float_tolerance: float = 1e-6) -> Comparison:
    """Dispatch to a comparison mode by name."""
    if mode == "exact":
        return compare_exact(output, answer)
    if mode == "float":
        return compare_float(output, answer, float_tolerance)
    if mode == "yesno":
        return compare_yesno(output, answer)
    # `tokens` is the default and the right answer for almost every problem.
    return compare_tokens(output, answer)


def compare_tokens(output: str, answer: str) -> Comparison:
    """Whitespace-insensitive: "1 2 3\\n" equals "1  2\\n3"."""
    got, want = output.split(), answer.split()
    if got == want:
        return Comparison(True)
    return Comparison(False, _describe(got, want))


def compare_exact(output: str, answer: str) -> Comparison:
    """Byte-exact, except that trailing whitespace at the very end is ignored."""
    if output.rstrip() == answer.rstrip():
        return Comparison(True)
    return Comparison(False, _describe(output.split(), answer.split()))


def compare_float(output: str, answer: str, tolerance: float) -> Comparison:
    """Token comparison where numbers are allowed to differ by `tolerance`.

    Tokens that are not both numeric must match exactly, so a problem mixing
    words and numbers still behaves sensibly.
    """
    got, want = output.split(), answer.split()
    if len(got) != len(want):
        return Comparison(False, _describe(got, want))

    for index, (g, w) in enumerate(zip(got, want)):
        if g == w:
            continue
        g_num, w_num = _as_float(g), _as_float(w)
        if g_num is None or w_num is None:
            return Comparison(False, f"token {index}: expected {w!r}, got {g!r}")
        if not _close_enough(g_num, w_num, tolerance):
            return Comparison(
                False, f"token {index}: expected {w!r}, got {g!r} (tolerance {tolerance})"
            )
    return Comparison(True)


def compare_yesno(output: str, answer: str) -> Comparison:
    """Case-insensitive YES/NO, so "Yes", "yes" and "YES" are one answer."""
    got, want = output.split(), answer.split()
    if len(got) != len(want):
        return Comparison(False, _describe(got, want))

    for index, (g, w) in enumerate(zip(got, want)):
        if _normalise_yesno(g) != _normalise_yesno(w):
            return Comparison(False, f"token {index}: expected {w!r}, got {g!r}")
    return Comparison(True)


# --- helpers ---------------------------------------------------------------


def _normalise_yesno(token: str) -> str:
    lowered = token.lower()
    if lowered in _YES:
        return "yes"
    if lowered in _NO:
        return "no"
    return lowered


def _as_float(token: str) -> float | None:
    try:
        value = float(token)
    except ValueError:
        return None
    # NaN never compares equal to anything, so reject it rather than letting it
    # silently pass or fail depending on comparison order.
    return None if value != value else value


def _close_enough(got: float, want: float, tolerance: float) -> bool:
    """Absolute or relative tolerance, whichever is kinder.

    Relative matters because a correct answer of 1e9 cannot be expected to land
    within 1e-6 absolute.
    """
    difference = abs(got - want)
    return difference <= tolerance or difference <= tolerance * abs(want)


def _describe(got: list[str], want: list[str], width: int = 60) -> str:
    """First point of difference, for the jury view."""
    for index, (g, w) in enumerate(zip(got, want)):
        if g != w:
            return f"token {index}: expected {w[:width]!r}, got {g[:width]!r}"
    if len(got) < len(want):
        return f"output too short: {len(got)} tokens, expected {len(want)}"
    if len(got) > len(want):
        return f"output too long: {len(got)} tokens, expected {len(want)}"
    return "outputs differ"
