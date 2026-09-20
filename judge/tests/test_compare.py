"""Comparison modes (US-J3-01). Pure comparators, no sandbox needed."""
from app.core import comparison


def ok(mode, output, answer, tolerance=1e-6):
    return comparison.for_mode(mode, tolerance).compare("", output, answer).ok


class TestTokens:
    def test_ignores_whitespace(self):
        assert ok("tokens", "1 2 3\n", "1  2\n3\n")

    def test_trailing_newline_optional(self):
        assert ok("tokens", "42", "42\n")

    def test_different_values_rejected(self):
        assert not ok("tokens", "1 2 4", "1 2 3")

    def test_missing_token_rejected(self):
        assert not ok("tokens", "1 2", "1 2 3")

    def test_extra_token_rejected(self):
        assert not ok("tokens", "1 2 3 4", "1 2 3")

    def test_empty_output_rejected(self):
        assert not ok("tokens", "", "1")

    def test_both_empty_accepted(self):
        assert ok("tokens", "", "")

    def test_detail_names_expected_value(self):
        detail = comparison.TokenComparator().compare("", "1 9 3", "1 2 3").detail
        assert "expected '2'" in detail and "got '9'" in detail


class TestExact:
    def test_tolerates_trailing_whitespace(self):
        assert ok("exact", "1 2 3\n\n", "1 2 3")

    def test_rejects_internal_whitespace_difference(self):
        assert not ok("exact", "1  2 3", "1 2 3")


class TestFloat:
    def test_within_tolerance(self):
        assert ok("float", "0.9999995", "1.0")

    def test_outside_tolerance(self):
        assert not ok("float", "0.99", "1.0")

    def test_relative_tolerance_for_large_numbers(self):
        # 1e9 cannot be expected to land within 1e-6 absolute.
        assert ok("float", "1000000000.0001", "1000000000.0")

    def test_integers_still_compare(self):
        assert ok("float", "3", "3.0")

    def test_non_numeric_must_match_exactly(self):
        assert not ok("float", "yes", "no")
        assert ok("float", "yes", "yes")

    def test_nan_never_accepted(self):
        assert not ok("float", "nan", "1.0")

    def test_length_mismatch_rejected(self):
        assert not ok("float", "1.0 2.0", "1.0")


class TestYesNo:
    def test_case_insensitive(self):
        assert ok("yesno", "YES", "Yes")
        assert ok("yesno", "no", "NO")

    def test_synonyms(self):
        assert ok("yesno", "Y", "yes")
        assert ok("yesno", "true", "YES")

    def test_opposite_rejected(self):
        assert not ok("yesno", "YES", "NO")

    def test_mixed_sequence(self):
        assert ok("yesno", "yes\nNO\nYes", "YES\nno\nyES")


class TestDispatch:
    def test_unknown_mode_falls_back_to_tokens(self):
        assert ok("something-else", "1 2", "1  2")
