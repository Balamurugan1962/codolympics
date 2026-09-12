"""The reader API problem setters write checkers against (US-J3-02).

The rule these tests pin down: malformed *contestant* output is a clean WA,
malformed *jury* data is an IE. A checker author gets that for free by simply
calling out.int() without defending against garbage.
"""
import pytest

from app.checker_runtime import CONTESTANT, ReadError, Reader


def contestant(text: str) -> Reader:
    return Reader(text, CONTESTANT)


def jury(text: str) -> Reader:
    return Reader(text, "answer")


class TestTokens:
    def test_reads_words_across_whitespace(self):
        reader = contestant("  alpha\n\t beta  ")
        assert reader.word() == "alpha"
        assert reader.word() == "beta"

    def test_reads_integers(self):
        reader = contestant("1 -2 300\n")
        assert reader.ints(3) == [1, -2, 300]

    def test_reads_floats(self):
        assert contestant("1.5\n").float() == 1.5

    def test_integer_rejects_a_word(self):
        with pytest.raises(ReadError, match="expected an integer"):
            contestant("hello").int()

    def test_integer_rejects_a_float(self):
        with pytest.raises(ReadError, match="expected an integer"):
            contestant("1.5").int()

    def test_nan_rejected(self):
        with pytest.raises(ReadError, match="NaN"):
            contestant("nan").float()

    def test_running_out_of_input_raises(self):
        with pytest.raises(ReadError, match="end of file"):
            contestant("1").ints(2)

    def test_empty_output_raises(self):
        with pytest.raises(ReadError, match="end of file"):
            contestant("").int()

    def test_whitespace_only_output_raises(self):
        with pytest.raises(ReadError, match="end of file"):
            contestant("   \n\n  ").int()


class TestBounds:
    def test_below_minimum_rejected(self):
        with pytest.raises(ReadError, match="below the minimum"):
            contestant("0").int(1, 10)

    def test_above_maximum_rejected(self):
        with pytest.raises(ReadError, match="above the maximum"):
            contestant("11").int(1, 10)

    def test_inside_bounds_accepted(self):
        assert contestant("5").int(1, 10) == 5

    def test_bounds_apply_to_floats(self):
        with pytest.raises(ReadError):
            contestant("2.5").float(0.0, 1.0)


class TestLines:
    def test_reads_a_line_without_its_newline(self):
        reader = contestant("first line\nsecond\n")
        assert reader.line() == "first line"
        assert reader.line() == "second"

    def test_strips_carriage_return(self):
        # A contestant on Windows should not fail for that reason alone.
        assert contestant("value\r\n").line() == "value"

    def test_rest_returns_everything_left(self):
        reader = contestant("a b c")
        reader.word()
        assert reader.rest().strip() == "b c"


class TestEof:
    def test_eof_passes_on_trailing_whitespace(self):
        reader = contestant("1\n\n  \n")
        reader.int()
        reader.eof()

    def test_eof_rejects_extra_output(self):
        reader = contestant("1 2")
        reader.int()
        with pytest.raises(ReadError, match="extra output"):
            reader.eof()

    def test_at_eof_does_not_raise(self):
        reader = contestant("1")
        reader.int()
        assert reader.at_eof() is True


class TestFaultAttribution:
    """Which side of the read failed decides WA versus IE (US-J2-02)."""

    def test_contestant_errors_are_attributed_to_the_contestant(self):
        with pytest.raises(ReadError) as caught:
            contestant("garbage").int()
        assert caught.value.source == CONTESTANT

    def test_jury_errors_are_attributed_to_the_jury(self):
        with pytest.raises(ReadError) as caught:
            jury("garbage").int()
        assert caught.value.source != CONTESTANT
