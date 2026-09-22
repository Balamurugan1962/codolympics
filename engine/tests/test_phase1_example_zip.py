"""The example set shipped in demo/ must import: it is what setters copy."""

from pathlib import Path

from engine.packages import phase1_zip

from conftest import add_user

EXAMPLE = Path(__file__).resolve().parents[2] / "demo" / "phase1-example.zip"


def test_the_shipped_example_set_imports() -> None:
    add_user("admin", "Admin", role="admin")
    out = phase1_zip.import_package("admin", EXAMPLE.read_bytes(), "example", {"hack-max-subarray"})
    assert out["skipped"] == []
    assert [c["section"] for c in out["created"]].count("puzzles") == 7
    assert [c["section"] for c in out["created"]].count("hacking") == 1
    # Nothing in a hand-written zip claims to be proven, so every one lands as a draft.
    assert out["verified"] == 0 and out["published"] == 0
    assert out["missingPackages"] == []
