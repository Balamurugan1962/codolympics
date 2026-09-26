"""The worker image precompiles <bits/stdc++.h> with the flags the judge compiles C++ with."""
from __future__ import annotations

from pathlib import Path

from app.core.languages import LANGUAGES

DOCKERFILE = Path(__file__).resolve().parents[2] / "worker" / "Dockerfile"


def test_the_precompiled_header_is_built_with_the_flags_the_judge_compiles_with() -> None:
    # GCC quietly ignores a precompiled header built with different flags, and every
    # compile is then slow again with nothing to say why. The flags that matter here
    # are the optimisation level and the language standard.
    flags = [a for a in LANGUAGES["cpp"].compile_args if a.startswith(("-O", "-std="))]
    assert flags, "cpp no longer sets an optimisation level or a standard: revisit the worker image"
    step = next(
        (part for part in DOCKERFILE.read_text().split("RUN ") if "-x c++-header" in part), None
    )
    assert step is not None, "worker/Dockerfile no longer precompiles <bits/stdc++.h>"
    for flag in flags:
        assert flag in step, f"the precompiled header is not built with {flag}, which the judge compiles with"
