"""How a checker's exit code becomes a verdict.

This is the bug that would have broken every checker problem: a checker says
"wrong answer" by exiting 1, which go-judge reports as "Nonzero Exit Status".
Reading that as a sandbox failure turns every WA into an IE.
"""
from app.checker import SandboxedPython
from app.gojudge import Result


def interpret(status: str, exit_status: int, stderr: str = ""):
    return SandboxedPython._interpret(
        Result(status, exit_status, 1.0, 1.0, 1024, "", stderr, {})
    )


class TestNormalDecisions:
    def test_exit_zero_accepts(self):
        assert interpret("Accepted", 0).verdict == "AC"

    def test_exit_one_is_wrong_answer_not_internal_error(self):
        # go-judge reports a non-zero exit this way; it is the checker
        # reporting its decision, not a failure.
        result = interpret("Nonzero Exit Status", 1, "expected 3, got 4")
        assert result.verdict == "WA"
        assert result.detail == "expected 3, got 4"

    def test_wrong_answer_without_a_message_still_reads_sensibly(self):
        assert interpret("Nonzero Exit Status", 1).detail == "rejected by checker"


class TestCheckerFaults:
    """A broken checker is our fault and must never be scored as WA (US-J2-02)."""

    def test_exit_three_is_internal_error(self):
        result = interpret("Nonzero Exit Status", 3, "checker raised ValueError")
        assert result.verdict == "IE"
        assert "ValueError" in result.detail

    def test_unexpected_exit_code_is_internal_error(self):
        assert interpret("Nonzero Exit Status", 42).verdict == "IE"

    def test_checker_timeout_is_internal_error(self):
        result = interpret("Time Limit Exceeded", -1)
        assert result.verdict == "IE"
        assert "time limit exceeded" in result.detail

    def test_checker_out_of_memory_is_internal_error(self):
        assert interpret("Memory Limit Exceeded", -1).verdict == "IE"

    def test_killed_checker_is_internal_error(self):
        assert interpret("Signalled", 9).verdict == "IE"


class TestStderrNoise:
    """PyPy prints a cache warning on every run; it must not bury a real error."""

    def test_pypy_cache_warning_is_dropped(self):
        from app.judge import _clean_stderr

        noisy = ("Warning: cannot find your CPU L2 & L3 cache size in "
                 "/sys/devices/system/cpu/cpuX/cache\nTraceback: real error here")
        assert _clean_stderr(noisy) == "Traceback: real error here"

    def test_a_clean_error_is_untouched(self):
        from app.judge import _clean_stderr

        assert _clean_stderr("segmentation fault") == "segmentation fault"

    def test_only_noise_leaves_nothing(self):
        from app.judge import _clean_stderr

        assert _clean_stderr("Warning: cannot find your CPU L2 & L3 cache size in x") == ""
