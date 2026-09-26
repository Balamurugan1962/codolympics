"""Hacking (US-J7-01, US-J7-02) and answer scoring (US-J7-03), against the fake sandbox."""
from tests.conftest import wait_for_job, write_problem

# Marker strings the fake sandbox matches against program source.
REFERENCE = "// REFERENCE: sum both numbers"
FLAWED = "// FLAWED: forgets negative numbers"


def correct(stdin: str) -> str:
    return str(sum(int(x) for x in stdin.split()))


def flawed(stdin: str) -> str:
    """Right on non-negative input, wrong when any number is negative."""
    nums = [int(x) for x in stdin.split()]
    return str(sum(abs(n) for n in nums))


def hackable_problem(problems_dir, validator: str | None = None):
    write_problem(
        problems_dir, "hackme", [],
        reference=("cpp", REFERENCE), hack_only=True, validator=validator,
    )


def hack(client, source: str, input_text: str, problem_id: str = "hackme") -> dict:
    response = client.post("/hack", json={
        "problem_id": problem_id, "language": "cpp",
        "source": source, "input": input_text, "submission_id": "h1",
    })
    assert response.status_code == 202, response.text
    return wait_for_job(client, response.json()["job_id"])["result"]


class TestHacking:
    def test_input_that_breaks_the_solution_is_a_hack(self, client, sandbox, problems_dir):
        hackable_problem(problems_dir)
        sandbox.programs = {REFERENCE: correct, FLAWED: flawed}

        result = hack(client, FLAWED, "-1 5\n")
        assert result["valid_input"] is True
        assert result["hacked"] is True
        assert result["verdict"] == "WA"

    def test_input_the_solution_handles_is_not_a_hack(self, client, sandbox, problems_dir):
        hackable_problem(problems_dir)
        sandbox.programs = {REFERENCE: correct, FLAWED: flawed}

        result = hack(client, FLAWED, "1 5\n")
        assert result["hacked"] is False
        assert result["verdict"] == "AC"

    def test_timeout_counts_as_a_hack(self, client, sandbox, problems_dir):
        hackable_problem(problems_dir)
        sandbox.programs = {REFERENCE: correct, FLAWED: "Time Limit Exceeded"}

        result = hack(client, FLAWED, "1 1\n")
        assert result["hacked"] is True
        assert result["verdict"] == "TLE"

    def test_invalid_input_is_rejected_before_anything_runs(self, client, sandbox, problems_dir):
        hackable_problem(problems_dir, validator="def validate(inp): pass")
        sandbox.programs = {REFERENCE: correct, FLAWED: flawed}
        sandbox.validator_accepts = lambda text: (False, "n must be at most 100")

        result = hack(client, FLAWED, "999 1\n")
        assert result["valid_input"] is False
        assert "at most 100" in result["invalid_reason"]
        assert result["hacked"] is None
        assert sandbox.runs == 0

    def test_problem_without_reference_cannot_be_hacked(self, client, problems_dir):
        write_problem(problems_dir, "plain", [("1\n", "1\n")])
        response = client.post("/hack", json={
            "problem_id": "plain", "language": "cpp", "source": FLAWED, "input": "1\n",
        })
        assert response.status_code == 400
        assert "reference" in response.json()["message"]

    def test_failing_reference_is_the_problems_fault(self, client, sandbox, problems_dir):
        hackable_problem(problems_dir)
        sandbox.programs = {REFERENCE: "Nonzero Exit Status", FLAWED: flawed}

        result = hack(client, FLAWED, "1 1\n")
        assert result["verdict"] == "IE"
        assert result["hacked"] is None          # neither credited nor penalised
        assert "broken" in result["message"]

    def test_given_solution_that_does_not_compile_is_ie(self, client, sandbox, problems_dir):
        hackable_problem(problems_dir)
        sandbox.programs = {REFERENCE: correct}
        sandbox.compile_fails = True

        result = hack(client, FLAWED, "1 1\n")
        assert result["verdict"] == "IE"
        assert result["hacked"] is None

    def test_oversized_input_rejected(self, client, problems_dir):
        hackable_problem(problems_dir)
        response = client.post("/hack", json={
            "problem_id": "hackme", "language": "cpp", "source": FLAWED, "input": "x" * 300_000,
        })
        assert response.status_code == 400
        assert response.json()["error"] == "input_too_large"

    def test_artefacts_are_kept_between_attempts_and_released_at_shutdown(self, client, sandbox, problems_dir):
        hackable_problem(problems_dir)
        sandbox.programs = {REFERENCE: correct, FLAWED: flawed}
        hack(client, FLAWED, "-1 5\n")
        assert sandbox.deleted == []          # kept for the next attempt (see test_compile_cache.py)
        client.app.state.services.judge.compiler.release_all()
        assert len(sandbox.deleted) == 2      # both programs given back


class TestReferenceInValidation:
    def test_stored_reference_used_when_none_supplied(self, client, sandbox, problems_dir):
        write_problem(problems_dir, "withref", [("2 3\n", "5\n")], reference=("cpp", REFERENCE))
        sandbox.programs = {REFERENCE: correct}

        report = client.post("/problems/withref/validate", json={}).json()
        assert report["ok"] is True
        assert report["reference"]["verdict"] == "AC"

    def test_hack_only_problem_needs_no_testcases(self, client, sandbox, problems_dir):
        hackable_problem(problems_dir)
        report = client.post("/problems/hackme/validate", json={}).json()
        assert report["ok"] is True
        assert report["testcases"] == 0

    def test_hack_only_problem_without_reference_fails_validation(self, client, problems_dir):
        write_problem(problems_dir, "noref", [], hack_only=True)
        report = client.post("/problems/noref/validate", json={}).json()
        assert report["ok"] is False
        assert any("reference" in issue for issue in report["issues"])

    def test_listing_reports_reference_and_hack_only(self, client, problems_dir):
        hackable_problem(problems_dir)
        info = client.get("/problems/hackme").json()
        assert info["has_reference"] is True
        assert info["hack_only"] is True


class TestAnswerScoring:
    def score(self, client, entries, validator="def check(e): return True"):
        response = client.post("/validate-answers", json={
            "validator": validator, "entries": entries, "submission_id": "a1",
        })
        assert response.status_code == 202, response.text
        return wait_for_job(client, response.json()["job_id"])["result"]

    def test_each_entry_reported_in_order(self, client, sandbox):
        sandbox.answer_check = lambda e: e.isdigit()
        result = self.score(client, ["1234", "abcd", "9"])
        assert result["status"] == "ok"
        assert [r["valid"] for r in result["results"]] == [True, False, True]

    def test_broken_validator_is_ie_with_no_results(self, client, sandbox):
        sandbox.answers_broken = True
        result = self.score(client, ["1234"])
        assert result["status"] == "IE"
        assert result["results"] == []            # nothing checked, not "all invalid"

    def test_oversized_entries_rejected(self, client):
        response = client.post("/validate-answers", json={
            "validator": "def check(e): return True", "entries": ["x" * 300_000],
        })
        assert response.status_code == 400
        assert response.json()["error"] == "input_too_large"
