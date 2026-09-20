"""Scores a list of answers with an administrator's validator, inside the sandbox.

Copied into the sandbox alongside checker_runtime.py, whose Reader it reuses.
Used by Phase 1's validator-scored questions -- "find as many valid passwords as
you can" -- where there is no fixed answer key (US-J7-03).

The validator is a Python file defining:

    def check(entry):
        d = entry.rest().strip()
        return len(d) == 4 and d.isdigit() and len(set(d)) == 4

`entry` is a Reader over one submitted answer. Return a truthy value to accept
it. Raising marks that one entry as an error and moves on to the next, so a
single odd entry cannot lose a participant their whole score.

Input:   entries.json  -- a JSON array of strings
Output:  a JSON array of {"valid": bool, "error": str | null}, one per entry
Exit 0 on success. Exit 3 if the validator itself cannot be loaded; the caller
must then treat every entry as unchecked, never as invalid.
"""
from __future__ import annotations

import json
import sys

from checker_runtime import Reader, ReadError, finish, load_function

EXIT_OK = 0
EXIT_IE = 3


def main() -> None:
    try:
        check = load_function("validator.py", "answer_validator", "check")
    except ImportError as exc:
        finish(EXIT_IE, f"validator failed to load: {exc}")

    with open("entries.json", encoding="utf-8") as handle:
        entries = json.load(handle)

    results = []
    for entry in entries:
        try:
            valid = bool(check(Reader(str(entry), "answer")))
            results.append({"valid": valid, "error": None})
        except ReadError as exc:
            # The entry did not have the shape the validator asked for. That is
            # an invalid entry, not a validator fault.
            results.append({"valid": False, "error": exc.message})
        except Exception as exc:
            results.append({"valid": False, "error": f"{type(exc).__name__}: {exc}"})

    json.dump(results, sys.stdout)
    sys.exit(EXIT_OK)


if __name__ == "__main__":
    main()
