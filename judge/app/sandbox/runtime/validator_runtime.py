"""Runs a problem setter's validator.py inside the sandbox.

Copied into the sandbox alongside checker_runtime.py, whose Reader it reuses.

A validator is a Python file defining:

    def validate(inp):
        t = inp.int(1, 100)
        total = 0
        for _ in range(t):
            n = inp.int(1, 10**5)
            total += n
        assert total <= 10**6, "sum of n exceeds 10^6"
        inp.eof()

It is run once per input file. Raising anything -- an AssertionError, a
ReadError from a bounds check, or a plain exception -- means the file violates
the stated constraints (US-J4-04).

Exit codes:
    0  the input file is valid
    1  the input file is invalid; stderr says why
"""
from __future__ import annotations

import sys

from checker_runtime import Reader, ReadError, finish, load_function

EXIT_VALID = 0
EXIT_INVALID = 1


def _invalid(message: str) -> None:
    finish(EXIT_INVALID, message)


def _read_input() -> str:
    # errors="strict" so a non-UTF-8 byte is itself reported as invalid input,
    # rather than being silently replaced.
    try:
        with open("input.txt", encoding="utf-8") as handle:
            return handle.read()
    except UnicodeDecodeError as exc:
        _invalid(f"input is not valid UTF-8: {exc}")
        raise


def main() -> None:
    try:
        validate = load_function("validator.py", "problem_validator", "validate")
    except ImportError as exc:
        _invalid(f"validator failed to load: {exc}")
    text = _read_input()
    try:
        validate(Reader(text, "input"))
    except ReadError as exc:
        _invalid(exc.message)
    except AssertionError as exc:
        _invalid(str(exc) or "assertion failed")
    except Exception as exc:
        _invalid(f"validator raised {type(exc).__name__}: {exc}")
    sys.exit(EXIT_VALID)


if __name__ == "__main__":
    main()
