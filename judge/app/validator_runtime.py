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

import importlib.util
import sys

from checker_runtime import ReadError, Reader

EXIT_VALID = 0
EXIT_INVALID = 1


def _load(path: str, module_name: str):
    spec = importlib.util.spec_from_file_location(module_name, path)
    if spec is None or spec.loader is None:
        raise ImportError(f"cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main() -> None:
    try:
        validator = _load("validator.py", "problem_validator")
    except Exception as exc:
        print(f"validator failed to load: {exc!r}", file=sys.stderr)
        sys.exit(EXIT_INVALID)

    if not hasattr(validator, "validate"):
        print("validator.py does not define validate(inp)", file=sys.stderr)
        sys.exit(EXIT_INVALID)

    # errors="strict" so a non-UTF-8 byte is itself reported as invalid input,
    # rather than being silently replaced.
    try:
        with open("input.txt", encoding="utf-8") as handle:
            text = handle.read()
    except UnicodeDecodeError as exc:
        print(f"input is not valid UTF-8: {exc}", file=sys.stderr)
        sys.exit(EXIT_INVALID)

    try:
        validator.validate(Reader(text, "input"))
    except ReadError as exc:
        print(exc.message, file=sys.stderr)
        sys.exit(EXIT_INVALID)
    except AssertionError as exc:
        print(str(exc) or "assertion failed", file=sys.stderr)
        sys.exit(EXIT_INVALID)
    except Exception as exc:
        print(f"validator raised {type(exc).__name__}: {exc}", file=sys.stderr)
        sys.exit(EXIT_INVALID)

    sys.exit(EXIT_VALID)


if __name__ == "__main__":
    main()
