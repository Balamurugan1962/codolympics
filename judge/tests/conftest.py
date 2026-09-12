"""Shared fixtures: a problem set on disk and a sandbox that does not exist.

The fake sandbox lets the API and judging logic be tested without Docker, so
`pytest` runs anywhere. It is deliberately literal -- it recognises a compile
command, hands back a fileId, and lets the test say what a run prints.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.gojudge import Result

TOKEN = "test-token"


# --- a problem on disk -----------------------------------------------------


def write_problem(
    root: Path,
    problem_id: str,
    cases: list[tuple[str, str]],
    *,
    version: str | None = None,
    compare: str = "tokens",
    early_exit: bool = True,
    checker: str | None = None,
    validator: str | None = None,
    time_limit_ms: int = 1000,
    reference: tuple[str, str] | None = None,   # (language, source)
    hack_only: bool = False,
) -> Path:
    """Create a problem directory. With `version`, use the versioned layout."""
    base = root / problem_id
    directory = base / version if version else base
    (directory / "tests").mkdir(parents=True, exist_ok=True)

    config = {
        "time_limit_ms": time_limit_ms,
        "memory_limit_mb": 256,
        "compare": compare,
        "early_exit": early_exit,
        "hack_only": hack_only,
    }
    if reference:
        language, source = reference
        ext = {"cpp": "cpp", "c": "c", "python": "py", "pypy": "py", "java": "java", "javascript": "js"}[language]
        (directory / f"solution.{ext}").write_text(source)
        config["reference"] = {"language": language, "file": f"solution.{ext}"}
    (directory / "problem.json").write_text(json.dumps(config))

    for index, (input_text, answer_text) in enumerate(cases, start=1):
        stem = directory / "tests" / f"{index:05d}"
        stem.with_suffix(".in").write_text(input_text)
        stem.with_suffix(".ans").write_text(answer_text)

    if checker is not None:
        (directory / "checker.py").write_text(checker)
    if validator is not None:
        (directory / "validator.py").write_text(validator)

    if version:
        pointer = base / "current"
        if pointer.is_symlink() or pointer.exists():
            pointer.unlink()
        pointer.symlink_to(version)

    return directory


@pytest.fixture
def problems_dir(tmp_path: Path) -> Path:
    root = tmp_path / "problems"
    root.mkdir()
    write_problem(root, "sum", [("2 3\n", "5\n"), ("10 20\n", "30\n"), ("1 1\n", "2\n")])
    return root


# --- a sandbox that never runs anything ------------------------------------


class FakeSandbox:
    """Stands in for go-judge.

    `solve` decides what a run prints, given its stdin. Set `up = False` to
    simulate the sandbox being down, or `compile_fails = True` for a CE.

    For hacking tests, `programs` maps a marker found in a program's source to
    what that program does: a callable from stdin to stdout, or a go-judge
    status string such as "Time Limit Exceeded". This lets one test hold a
    correct reference and a flawed solution at the same time.

    `validator_accepts` decides what validator_runtime.py says about an input,
    and `answer_check` what answers_runtime.py says about each entry.
    """

    def __init__(self, url: str = "http://fake-sandbox"):
        self.url = url
        self.up = True
        self.compile_fails = False
        self.run_status = "Accepted"
        self.solve = lambda stdin: stdin.strip()
        self.programs: dict[str, object] = {}
        self.validator_accepts = lambda text: (True, "")
        self.answer_check = lambda entry: True
        self.answers_broken = False
        self.runs = 0
        self.compiles = 0
        self.uploaded: list[str] = []
        self.deleted: list[str] = []
        self._next_id = 0
        self._sources: dict[str, str] = {}      # fileId -> program source

    # the GoJudge interface ------------------------------------------------

    def reachable(self) -> bool:
        return self.up

    def close(self) -> None:
        pass

    def upload(self, content) -> str:
        self._next_id += 1
        file_id = f"file-{self._next_id}"
        self.uploaded.append(file_id)
        self._sources[file_id] = content if isinstance(content, str) else content.decode()
        return file_id

    def delete(self, file_id: str) -> None:
        self.deleted.append(file_id)

    def run(self, commands: list[dict]) -> list[Result]:
        command = commands[0]
        script = command["args"][-1]
        if script == "validator_runtime.py":
            return [self._validator(command)]
        if script == "answers_runtime.py":
            return [self._answers(command)]
        if command.get("copyOutCached"):
            return [self._compile(command)]
        return [self._run(command)]

    def _validator(self, command: dict) -> Result:
        text = command["copyIn"]["input.txt"]["content"]
        ok, reason = self.validator_accepts(text)
        return Result("Accepted" if ok else "Nonzero Exit Status", 0 if ok else 1,
                      5.0, 5.0, 1024, "", reason, {})

    def _answers(self, command: dict) -> Result:
        import json
        if self.answers_broken:
            return Result("Nonzero Exit Status", 3, 5.0, 5.0, 1024, "",
                          "validator failed to load: SyntaxError", {})
        entries = json.loads(command["copyIn"]["entries.json"]["content"])
        out = [{"valid": bool(self.answer_check(e)), "error": None} for e in entries]
        return Result("Accepted", 0, 5.0, 5.0, 1024, json.dumps(out), "", {})

    def _program_for(self, command: dict):
        """The behaviour registered for whichever program this run mounts."""
        for entry in command.get("copyIn", {}).values():
            source = self._sources.get(entry.get("fileId", ""), "")
            for marker, behaviour in self.programs.items():
                if marker in source:
                    return behaviour
        return None

    # internals -------------------------------------------------------------

    def _compile(self, command: dict) -> Result:
        self.compiles += 1
        if self.compile_fails:
            return Result("Nonzero Exit Status", 1, 10.0, 10.0, 1024,
                          "", "main.cpp:1:1: error: expected ';'", {})
        source = next(iter(command["copyIn"].values()))["content"]
        file_ids = {}
        for name in command["copyOutCached"]:
            self._next_id += 1
            file_ids[name] = f"file-{self._next_id}"
            self._sources[file_ids[name]] = source
        return Result("Accepted", 0, 120.0, 130.0, 4096, "", "", file_ids)

    def _run(self, command: dict) -> Result:
        self.runs += 1
        stdin = command["files"][0]["content"]
        behaviour = self._program_for(command)
        if isinstance(behaviour, str):                       # a status, e.g. TLE
            return Result(behaviour, -1, 1000.0, 1000.0, 2048, "", "boom", {})
        if self.run_status != "Accepted":
            return Result(self.run_status, -1, 1000.0, 1000.0, 2048, "", "boom", {})
        solve = behaviour if callable(behaviour) else self.solve
        return Result("Accepted", 0, 12.5, 13.0, 2048, solve(stdin), "", {})


@pytest.fixture
def sandbox() -> FakeSandbox:
    return FakeSandbox()


# --- the app wired to both -------------------------------------------------


@pytest.fixture
def client(problems_dir: Path, sandbox: FakeSandbox, monkeypatch):
    from fastapi.testclient import TestClient

    from app import main
    from app.config import settings

    monkeypatch.setattr(settings, "problems_dir", str(problems_dir))
    monkeypatch.setattr(settings, "service_token", TOKEN)
    monkeypatch.setattr(main, "GoJudge", lambda *a, **k: sandbox)

    with TestClient(main.app) as test_client:
        test_client.headers.update({"Authorization": f"Bearer {TOKEN}"})
        yield test_client


def wait_for_job(client, job_id: str, timeout_s: float = 10.0) -> dict:
    """Poll until the job is done, the way the backend would."""
    import time

    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        body = client.get(f"/jobs/{job_id}").json()
        if body["state"] == "done":
            return body
        time.sleep(0.02)
    raise AssertionError(f"job {job_id} did not finish within {timeout_s}s")
