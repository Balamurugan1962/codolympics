"""Runs a problem setter's checker.py inside the sandbox.

This file is copied into the sandbox next to the setter's checker and executed
there. It must not import anything from the judge -- it only has the standard
library.

A checker is a Python file defining:

    def check(inp, out, ans):
        n = inp.int()
        got = out.int()
        want = ans.int()
        if got != want:
            return False, f"expected {want}, got {got}"
        return True

`inp`, `out` and `ans` are Readers over the test input, the contestant's
output and the expected answer. Return True to accept, False (optionally with
a message) to reject.

The rule that makes checkers safe to write:

  * malformed *contestant* output is a clean WA -- it is their mistake
  * malformed *jury* data is an IE -- it is ours, and must never be scored
    against the contestant (US-J2-02)

So a checker can call out.int() without defending against garbage; if the
contestant printed a word, the reader raises and the runner turns that into WA
automatically.

Exit codes (testlib convention, so Codeforces-style checkers port easily):
    0  accepted
    1  wrong answer
    3  internal error -- the checker or the jury data is broken
"""
from __future__ import annotations

import importlib.util
import sys

EXIT_AC = 0
EXIT_WA = 1
EXIT_IE = 3

CONTESTANT = "output"


class ReadError(Exception):
    """A reader could not get what the checker asked for."""

    def __init__(self, source: str, message: str):
        super().__init__(message)
        self.source = source
        self.message = message


class Reader:
    """Token-oriented reading over one of the three files.

    Whitespace is insignificant except where you explicitly ask for a line.
    """

    def __init__(self, text: str, source: str):
        self._text = text
        self._source = source
        self._pos = 0

    # --- tokens ------------------------------------------------------------

    def word(self) -> str:
        """The next whitespace-delimited token."""
        while self._pos < len(self._text) and self._text[self._pos].isspace():
            self._pos += 1
        if self._pos >= len(self._text):
            raise ReadError(self._source, "expected another value, found end of file")
        start = self._pos
        while self._pos < len(self._text) and not self._text[self._pos].isspace():
            self._pos += 1
        return self._text[start:self._pos]

    def int(self, low: int | None = None, high: int | None = None) -> int:
        token = self.word()
        try:
            value = int(token)
        except ValueError:
            raise ReadError(self._source, f"expected an integer, found {token!r}") from None
        self._check_range(value, low, high)
        return value

    def float(self, low: float | None = None, high: float | None = None) -> float:
        token = self.word()
        try:
            value = float(token)
        except ValueError:
            raise ReadError(self._source, f"expected a number, found {token!r}") from None
        if value != value:  # NaN
            raise ReadError(self._source, "expected a number, found NaN")
        self._check_range(value, low, high)
        return value

    def ints(self, count: int, low: int | None = None, high: int | None = None) -> list[int]:
        return [self.int(low, high) for _ in range(count)]

    def floats(self, count: int, low: float | None = None, high: float | None = None) -> list[float]:
        return [self.float(low, high) for _ in range(count)]

    # --- lines and the end -------------------------------------------------

    def line(self) -> str:
        """The rest of the current line, without its newline."""
        if self._pos >= len(self._text):
            raise ReadError(self._source, "expected another line, found end of file")
        end = self._text.find("\n", self._pos)
        if end == -1:
            end = len(self._text)
        text = self._text[self._pos:end]
        self._pos = end + 1
        return text.rstrip("\r")

    def rest(self) -> str:
        """Everything not yet read."""
        text = self._text[self._pos:]
        self._pos = len(self._text)
        return text

    def eof(self) -> None:
        """Assert nothing but whitespace remains.

        Call this at the end of a checker to reject output with extra tokens
        after an otherwise correct answer.
        """
        if self._text[self._pos:].strip():
            raise ReadError(self._source, "unexpected extra output after the answer")

    def at_eof(self) -> bool:
        """Whether only whitespace remains. Does not raise."""
        return not self._text[self._pos:].strip()

    # --- helpers -----------------------------------------------------------

    def _check_range(self, value, low, high) -> None:
        if low is not None and value < low:
            raise ReadError(self._source, f"{value} is below the minimum {low}")
        if high is not None and value > high:
            raise ReadError(self._source, f"{value} is above the maximum {high}")


def load_function(path: str, module_name: str, function: str):
    """The setter's `function` from the file at `path`, or an ImportError
    saying why it could not be had."""
    spec = importlib.util.spec_from_file_location(module_name, path)
    if spec is None or spec.loader is None:
        raise ImportError(f"cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(module)
    except Exception as exc:
        raise ImportError(f"{path} failed to load: {exc!r}") from exc
    if not hasattr(module, function):
        raise ImportError(f"{path} does not define {function}")
    return getattr(module, function)


def _read(path: str) -> str:
    with open(path, encoding="utf-8", errors="replace") as handle:
        return handle.read()


def finish(code: int, message: str) -> None:
    print(message, file=sys.stderr)
    sys.exit(code)


def _unpack(outcome) -> tuple[bool, str]:
    """Accept either `True` or `(True, "message")`."""
    if isinstance(outcome, tuple):
        return outcome[0], str(outcome[1]) if len(outcome) > 1 else ""
    return outcome, ""


def main() -> None:
    try:
        check = load_function("checker.py", "problem_checker", "check")
    except ImportError as exc:
        finish(EXIT_IE, f"checker failed to load: {exc}")
    inp = Reader(_read("input.txt"), "input")
    out = Reader(_read("output.txt"), CONTESTANT)
    ans = Reader(_read("answer.txt"), "answer")

    try:
        accepted, message = _unpack(check(inp, out, ans))
    except ReadError as exc:
        # Where the bad data came from decides whose fault it is.
        if exc.source == CONTESTANT:
            finish(EXIT_WA, exc.message)
        finish(EXIT_IE, f"jury data is malformed ({exc.source}): {exc.message}")
    except Exception as exc:
        finish(EXIT_IE, f"checker raised {type(exc).__name__}: {exc}")

    if accepted:
        finish(EXIT_AC, message or "accepted")
    finish(EXIT_WA, message or "rejected by checker")


if __name__ == "__main__":
    main()
