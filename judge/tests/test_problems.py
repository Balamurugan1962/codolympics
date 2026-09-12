"""Problem loading, testcase pairing and versioning (US-J1-06, US-J5-04)."""
from pathlib import Path

import pytest

from app.problems import ProblemNotFound, ProblemStore
from app.storage import LocalStorage
from tests.conftest import write_problem


def store_for(root: Path) -> ProblemStore:
    return ProblemStore(LocalStorage(root))


class TestLoading:
    def test_reads_config_and_testcases(self, problems_dir):
        problem = store_for(problems_dir).load("sum")
        assert problem.total == 3
        assert problem.time_limit_ms == 1000
        assert problem.compare == "tokens"
        assert problem.early_exit is True

    def test_unknown_problem_raises(self, problems_dir):
        with pytest.raises(ProblemNotFound):
            store_for(problems_dir).load("nope")

    def test_defaults_apply_when_config_is_sparse(self, tmp_path):
        root = tmp_path / "p"
        directory = root / "bare" / "tests"
        directory.mkdir(parents=True)
        (root / "bare" / "problem.json").write_text("{}")
        (directory / "00001.in").write_text("x")
        (directory / "00001.ans").write_text("x")

        problem = store_for(root).load("bare")
        assert problem.time_limit_ms == 1000
        assert problem.memory_limit_mb == 256
        assert problem.compare == "tokens"


class TestTestcaseOrdering:
    def test_ordered_by_filename(self, problems_dir):
        problem = store_for(problems_dir).load("sum")
        indexes = [t.index for t in problem.testcases]
        assert indexes == [0, 1, 2]
        assert problem.testcases[0].input_key.endswith("00001.in")
        assert problem.testcases[2].input_key.endswith("00003.in")

    def test_zero_padding_makes_lexical_order_numeric(self, tmp_path):
        # Without padding, "10" would sort before "2".
        root = tmp_path / "p"
        write_problem(root, "many", [(f"{i}\n", f"{i}\n") for i in range(1, 12)])
        problem = store_for(root).load("many")
        inputs = [t.input_key.split("/")[-1] for t in problem.testcases]
        assert inputs[1] == "00002.in"
        assert inputs[9] == "00010.in"

    def test_out_accepted_as_answer_suffix(self, tmp_path):
        root = tmp_path / "p"
        directory = root / "alt" / "tests"
        directory.mkdir(parents=True)
        (root / "alt" / "problem.json").write_text("{}")
        (directory / "00001.in").write_text("1")
        (directory / "00001.out").write_text("1")
        assert store_for(root).load("alt").total == 1


class TestOrphans:
    def test_input_without_answer_is_skipped_and_reported(self, problems_dir):
        (problems_dir / "sum" / "tests" / "00009.in").write_text("orphan")
        store = store_for(problems_dir)

        # Judging ignores it rather than failing a contestant's submission...
        assert store.load("sum").total == 3
        # ...but validation names it.
        assert store.unmatched_inputs("sum") == ["00009.in"]


class TestVersions:
    def test_current_symlink_selects_the_version(self, tmp_path):
        root = tmp_path / "p"
        write_problem(root, "v", [("1\n", "1\n")], version="v1")
        write_problem(root, "v", [("1\n", "1\n"), ("2\n", "2\n")], version="v2")

        problem = store_for(root).load("v")
        assert problem.version == "v2"
        assert problem.total == 2

    def test_explicit_version_reads_the_old_one(self, tmp_path):
        root = tmp_path / "p"
        write_problem(root, "v", [("1\n", "old\n")], version="v1")
        write_problem(root, "v", [("1\n", "new\n")], version="v2")

        store = store_for(root)
        old = store.load("v", version="v1")
        assert old.version == "v1"
        assert store.storage.read_text(old.testcases[0].answer_key) == "old\n"

    def test_unknown_version_raises(self, tmp_path):
        root = tmp_path / "p"
        write_problem(root, "v", [("1\n", "1\n")], version="v1")
        with pytest.raises(ProblemNotFound):
            store_for(root).load("v", version="v9")

    def test_unversioned_problem_reports_v1(self, problems_dir):
        assert store_for(problems_dir).load("sum").version == "v1"

    def test_repointing_current_does_not_disturb_a_loaded_problem(self, tmp_path):
        root = tmp_path / "p"
        write_problem(root, "v", [("1\n", "old\n")], version="v1")
        store = store_for(root)
        loaded = store.load("v")

        write_problem(root, "v", [("1\n", "new\n")], version="v2")

        # The already-loaded problem still points at v1 (US-J5-04).
        assert loaded.version == "v1"
        assert store.storage.read_text(loaded.testcases[0].answer_key) == "old\n"
        assert store.load("v").version == "v2"


class TestSafety:
    def test_traversal_outside_the_root_is_refused(self, problems_dir):
        storage = LocalStorage(problems_dir)
        assert storage.exists("../../etc/passwd") is False
