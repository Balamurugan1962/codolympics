"""Deciding whether a contestant's output matches the expected answer.

Four modes need no code from the problem setter (US-J3-01). Each is a
`Comparator`; the fifth, `checker`, is one too, but it runs a Python program in
the sandbox and so lives in the judging package.

Every comparator here is pure: no I/O, no sandbox, no configuration. That
makes the comparison rules testable on their own, which is where most subtle
judging bugs would otherwise hide.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Protocol

from app.core.verdict import Verdict

CompareMode = Literal["tokens", "exact", "float", "yesno", "checker"]
DEFAULT_MODE: CompareMode = "tokens"

# Only these spellings are treated as the same answer in `yesno` mode. Anything
# else falls through to an ordinary token comparison.
_YES = {"yes", "y", "true"}
_NO = {"no", "n", "false"}


@dataclass(frozen=True)
class Comparison:
    verdict: Verdict            # AC, WA, or IE when a checker could not decide
    # Shown to the jury only: it names the expected value, which would hand a
    # contestant the answer.
    detail: str = ""

    @property
    def ok(self) -> bool:
        return self.verdict == "AC"


def accepted(detail: str = "") -> Comparison:
    return Comparison("AC", detail)


def rejected(detail: str) -> Comparison:
    return Comparison("WA", detail)


class Comparator(Protocol):
    def compare(self, input_text: str, output: str, answer: str) -> Comparison:
        """Decide one testcase. `input_text` is there for checkers; the
        built-in modes only look at the output and the answer."""


class TokenComparator:
    """Whitespace-insensitive: "1 2 3\\n" equals "1  2\\n3"."""

    def compare(self, input_text: str, output: str, answer: str) -> Comparison:
        got, want = output.split(), answer.split()
        return accepted() if got == want else rejected(_describe(got, want))


class ExactComparator:
    """Byte-exact, except that trailing whitespace at the very end is ignored."""

    def compare(self, input_text: str, output: str, answer: str) -> Comparison:
        if output.rstrip() == answer.rstrip():
            return accepted()
        return rejected(_describe(output.split(), answer.split()))


class TokenwiseComparator:
    """Token by token, with a subclass deciding when two tokens match."""

    def matches(self, got: str, want: str) -> tuple[bool, str]:
        raise NotImplementedError

    def compare(self, input_text: str, output: str, answer: str) -> Comparison:
        got, want = output.split(), answer.split()
        if len(got) != len(want):
            return rejected(_describe(got, want))
        for index, (g, w) in enumerate(zip(got, want)):
            same, why = self.matches(g, w)
            if not same:
                return rejected(f"token {index}: expected {w!r}, got {g!r}{why}")
        return accepted()


class FloatComparator(TokenwiseComparator):
    """Numbers may differ by the tolerance, absolute or relative, whichever is
    kinder. Tokens that are not both numeric must match exactly, so a problem
    mixing words and numbers still behaves sensibly."""

    def __init__(self, tolerance: float):
        self.tolerance = tolerance

    def matches(self, got: str, want: str) -> tuple[bool, str]:
        if got == want:
            return True, ""
        g, w = _as_float(got), _as_float(want)
        if g is None or w is None:
            return False, ""
        # Relative matters because a correct answer of 1e9 cannot be expected
        # to land within 1e-6 absolute.
        difference = abs(g - w)
        close = difference <= self.tolerance or difference <= self.tolerance * abs(w)
        return close, f" (tolerance {self.tolerance})"


class YesNoComparator(TokenwiseComparator):
    """Case-insensitive YES/NO, so "Yes", "yes" and "YES" are one answer."""

    def matches(self, got: str, want: str) -> tuple[bool, str]:
        return _normalise_yesno(got) == _normalise_yesno(want), ""


def for_mode(mode: str, float_tolerance: float = 1e-6) -> Comparator:
    """The built-in comparator for a mode name. `tokens` is the default and
    the right answer for almost every problem, so an unknown name gets it."""
    if mode == "exact":
        return ExactComparator()
    if mode == "float":
        return FloatComparator(float_tolerance)
    if mode == "yesno":
        return YesNoComparator()
    return TokenComparator()


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
