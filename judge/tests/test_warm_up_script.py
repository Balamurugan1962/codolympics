"""The pre-contest warm-up script covers every language the judge offers."""
from __future__ import annotations

import importlib.util
from pathlib import Path

from app.core.languages import LANGUAGES

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "warm_up.py"


def load():
    spec = importlib.util.spec_from_file_location("warm_up", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_every_language_the_judge_offers_has_a_warm_up_program() -> None:
    # A language added to the judge but not to the script would be neither warmed nor checked.
    assert set(load().SOURCES) == set(LANGUAGES)


def test_the_warm_up_programs_are_the_same_problem_and_the_answer_is_right_for_it() -> None:
    warm = load()
    values = sorted(set(map(int, warm.INPUT.split()[1:])))
    assert str(values[-2]) == warm.EXPECTED  # second largest distinct of 3 1 4 1 5


class _FakeJudge:
    """Stands in for the judge: every language is offered, and `broken` ones fail."""

    broken: set[str] = set()

    def __init__(self, url, token):
        pass

    def call(self, method, path, body=None):
        if path == "/health":
            return {"status": "ok"}
        if path == "/languages":
            return {"languages": [{"key": key} for key in LANGUAGES]}
        return {"problems": [{"problem_id": "any", "hack_only": False}]}

    def run(self, problem, language, source, timeout_s=180.0):
        return (language not in self.broken), 0.1, "" if language not in self.broken else "CE: nope"


def _run(monkeypatch, capsys, broken: set[str]) -> tuple[int, str]:
    warm = load()
    _FakeJudge.broken = broken
    monkeypatch.setattr(warm, "Judge", _FakeJudge)
    monkeypatch.setattr(warm, "_token", lambda: "t")
    monkeypatch.setattr("sys.argv", ["warm_up.py", "--rounds", "1"])
    return warm.main(), capsys.readouterr().out


def test_it_exits_zero_when_every_language_works(monkeypatch, capsys) -> None:
    code, out = _run(monkeypatch, capsys, set())
    assert code == 0 and "all languages ready" in out


def test_it_exits_non_zero_and_names_the_language_that_failed(monkeypatch, capsys) -> None:
    code, out = _run(monkeypatch, capsys, {"java"})
    assert code == 1
    assert "FAIL: CE: nope" in out and "do not start the contest" in out
