"""The HTTP contract, end to end against a fake sandbox."""
from tests.conftest import wait_for_job, write_problem

SOURCE = "int main(){}"


def submit(client, **overrides):
    body = {"problem_id": "sum", "language": "cpp", "source": SOURCE, "submission_id": "sub_1"}
    body.update(overrides)
    return client.post("/submit", json=body)


# --- authentication (US-J6-01) ---------------------------------------------


class TestAuth:
    def test_health_needs_no_token(self, client):
        client.headers.pop("Authorization")
        assert client.get("/health").status_code == 200

    def test_missing_token_rejected(self, client):
        client.headers.pop("Authorization")
        response = client.get("/problems")
        assert response.status_code == 401
        assert response.json()["error"] == "unauthorized"

    def test_wrong_token_rejected(self, client):
        client.headers.update({"Authorization": "Bearer wrong"})
        assert client.get("/problems").status_code == 401

    def test_every_judging_route_is_protected(self, client):
        client.headers.pop("Authorization")
        assert client.post("/submit", json={}).status_code == 401
        assert client.get("/jobs/whatever").status_code == 401
        assert client.delete("/jobs/whatever").status_code == 401
        assert client.get("/problems/sum/testcases/0").status_code == 401


# --- metadata --------------------------------------------------------------


class TestMetadata:
    def test_health_reports_capacity(self, client):
        body = client.get("/health").json()
        assert body["status"] == "ok"
        assert body["go_judge"] == "ok"
        assert body["problems"] == 1
        assert body["capacity"] >= 1

    def test_health_degraded_when_sandbox_is_down(self, client, sandbox):
        sandbox.up = False
        body = client.get("/health").json()
        assert body["status"] == "degraded"
        assert body["go_judge"] == "unreachable"

    def test_languages_includes_pypy(self, client):
        keys = {lang["key"] for lang in client.get("/languages").json()["languages"]}
        assert {"c", "cpp", "python", "pypy", "java", "javascript"} == keys

    def test_languages_mark_compiled(self, client):
        by_key = {lang["key"]: lang for lang in client.get("/languages").json()["languages"]}
        assert by_key["cpp"]["compiled"] is True
        assert by_key["python"]["compiled"] is False

    def test_list_problems(self, client):
        problems = client.get("/problems").json()["problems"]
        assert len(problems) == 1
        assert problems[0]["problem_id"] == "sum"
        assert problems[0]["testcases"] == 3
        assert problems[0]["validated"] is False
        assert problems[0]["bytes"] > 0

    def test_problem_metadata(self, client):
        body = client.get("/problems/sum").json()
        assert body["testcases"] == 3
        assert body["compare"] == "tokens"

    def test_unknown_problem_is_404(self, client):
        response = client.get("/problems/nope")
        assert response.status_code == 404
        assert response.json()["error"] == "problem_not_found"

    def test_path_traversal_is_404_not_a_read(self, client):
        assert client.get("/problems/..%2F..%2Fetc").status_code == 404


# --- submitting (US-J1-01) -------------------------------------------------


class TestSubmit:
    def test_returns_202_with_a_job_handle(self, client):
        response = submit(client)
        assert response.status_code == 202
        body = response.json()
        assert body["state"] == "queued"
        assert body["submission_id"] == "sub_1"
        assert body["job_id"].startswith("job_")

    def test_unknown_language_lists_the_available_ones(self, client):
        response = submit(client, language="rust")
        assert response.status_code == 400
        body = response.json()
        assert body["error"] == "unknown_language"
        assert "cpp" in body["message"]

    def test_unknown_problem_is_404(self, client):
        response = submit(client, problem_id="nope")
        assert response.status_code == 404
        assert response.json()["error"] == "problem_not_found"

    def test_oversized_source_rejected(self, client):
        response = submit(client, source="x" * 300_000)
        assert response.status_code == 400
        assert response.json()["error"] == "source_too_large"

    def test_sandbox_down_is_503_and_judges_nothing(self, client, sandbox):
        sandbox.up = False
        response = submit(client)
        assert response.status_code == 503
        assert response.json()["error"] == "sandbox_unavailable"
        assert sandbox.runs == 0

    def test_queue_full_is_429_with_retry_after(self, client, monkeypatch):
        monkeypatch.setattr(client.app.state.services.queue, "has_room", lambda pool="main": False)
        response = submit(client)
        assert response.status_code == 429
        assert response.json()["error"] == "busy"
        assert int(response.headers["Retry-After"]) > 0


# --- verdicts (US-J1-02, US-J2-01) -----------------------------------------


class TestVerdicts:
    def test_accepted(self, client, sandbox):
        sandbox.solve = lambda stdin: str(sum(int(x) for x in stdin.split()))
        job = wait_for_job(client, submit(client).json()["job_id"])

        assert job["state"] == "done"
        result = job["result"]
        assert result["verdict"] == "AC"
        assert result["passed"] == 3
        assert result["total"] == 3
        assert result["first_fail"] is None
        assert result["message"] == "all testcases passed"

    def test_wrong_answer_names_the_test_but_not_its_contents(self, client, sandbox):
        # Correct on test 0, wrong afterwards.
        sandbox.solve = lambda stdin: "5" if stdin.strip() == "2 3" else "0"
        job = wait_for_job(client, submit(client).json()["job_id"])

        result = job["result"]
        assert result["verdict"] == "WA"
        assert result["first_fail"] == 1
        assert result["passed"] == 1
        assert result["message"] == "wrong answer on test 1"
        # The expected value is jury-only; the contestant message must not leak it.
        assert "30" in result["jury_detail"]
        assert "30" not in result["message"]

    def test_compile_error_is_a_completed_job(self, client, sandbox):
        sandbox.compile_fails = True
        job = wait_for_job(client, submit(client).json()["job_id"])

        assert job["state"] == "done"          # not an error state
        result = job["result"]
        assert result["verdict"] == "CE"
        assert result["first_fail"] is None
        assert "expected ';'" in result["compile_output"]
        assert sandbox.runs == 0

    def test_time_limit_exceeded(self, client, sandbox):
        sandbox.run_status = "Time Limit Exceeded"
        result = wait_for_job(client, submit(client).json()["job_id"])["result"]
        assert result["verdict"] == "TLE"
        assert result["first_fail"] == 0

    def test_runtime_error(self, client, sandbox):
        sandbox.run_status = "Nonzero Exit Status"
        result = wait_for_job(client, submit(client).json()["job_id"])["result"]
        assert result["verdict"] == "RE"

    def test_output_limit_exceeded(self, client, sandbox):
        sandbox.run_status = "Output Limit Exceeded"
        result = wait_for_job(client, submit(client).json()["job_id"])["result"]
        assert result["verdict"] == "OLE"

    def test_judgement_records_the_problem_version(self, client, sandbox):
        sandbox.solve = lambda stdin: str(sum(int(x) for x in stdin.split()))
        result = wait_for_job(client, submit(client).json()["job_id"])["result"]
        assert result["problem_version"] == "v1"

    def test_timing_and_memory_reported(self, client, sandbox):
        sandbox.solve = lambda stdin: str(sum(int(x) for x in stdin.split()))
        result = wait_for_job(client, submit(client).json()["job_id"])["result"]
        assert result["max_time_ms"] > 0
        assert result["max_memory_kb"] > 0
        assert result["duration_ms"] >= 0


# --- compile once, run many (US-J1-04) -------------------------------------


class TestCompileOnce:
    def test_one_compile_for_every_testcase(self, client, sandbox):
        sandbox.solve = lambda stdin: str(sum(int(x) for x in stdin.split()))
        wait_for_job(client, submit(client).json()["job_id"])

        assert sandbox.compiles == 1
        assert sandbox.runs == 3

    def test_interpreted_language_uploads_source_once(self, client, sandbox):
        sandbox.solve = lambda stdin: str(sum(int(x) for x in stdin.split()))
        wait_for_job(client, submit(client, language="python").json()["job_id"])

        assert sandbox.compiles == 0
        assert len(sandbox.uploaded) == 1
        assert sandbox.runs == 3

    def test_artefact_released_after_judging(self, client, sandbox):
        sandbox.solve = lambda stdin: str(sum(int(x) for x in stdin.split()))
        wait_for_job(client, submit(client).json()["job_id"])
        assert len(sandbox.deleted) == 1

    def test_artefact_released_even_on_failure(self, client, sandbox):
        sandbox.run_status = "Nonzero Exit Status"
        wait_for_job(client, submit(client).json()["job_id"])
        assert len(sandbox.deleted) == 1


# --- early exit (US-J1-05) -------------------------------------------------


class TestEarlyExit:
    def test_stops_at_the_first_failure(self, client, sandbox):
        sandbox.solve = lambda stdin: "5" if stdin.strip() == "2 3" else "0"
        wait_for_job(client, submit(client).json()["job_id"])
        # Test 0 passes, test 1 fails, test 2 never runs.
        assert sandbox.runs == 2

    def test_disabled_runs_every_testcase(self, client, sandbox, problems_dir):
        write_problem(
            problems_dir, "all",
            [("2 3\n", "5\n"), ("10 20\n", "30\n"), ("1 1\n", "2\n")],
            early_exit=False,
        )
        sandbox.solve = lambda stdin: "0"
        job = wait_for_job(client, submit(client, problem_id="all").json()["job_id"])

        assert sandbox.runs == 3
        assert job["result"]["first_fail"] == 0     # still the lowest failure
        assert job["result"]["passed"] == 0


# --- polling and cancellation ----------------------------------------------


class TestJobs:
    def test_progress_reaches_the_total(self, client, sandbox):
        sandbox.solve = lambda stdin: str(sum(int(x) for x in stdin.split()))
        job = wait_for_job(client, submit(client).json()["job_id"])
        assert job["progress"] == {"done": 3, "total": 3}

    def test_poll_after_is_null_when_done(self, client, sandbox):
        sandbox.solve = lambda stdin: str(sum(int(x) for x in stdin.split()))
        job = wait_for_job(client, submit(client).json()["job_id"])
        assert job["poll_after_ms"] is None

    def test_unknown_job_is_404(self, client):
        response = client.get("/jobs/job_missing")
        assert response.status_code == 404
        assert response.json()["error"] == "job_not_found"

    def test_cancel_returns_204(self, client):
        job_id = submit(client).json()["job_id"]
        assert client.delete(f"/jobs/{job_id}").status_code == 204

    def test_cancelling_a_finished_job_is_a_no_op(self, client, sandbox):
        sandbox.solve = lambda stdin: str(sum(int(x) for x in stdin.split()))
        job_id = submit(client).json()["job_id"]
        wait_for_job(client, job_id)
        assert client.delete(f"/jobs/{job_id}").status_code == 204

    def test_cancelling_an_unknown_job_is_404(self, client):
        assert client.delete("/jobs/job_missing").status_code == 404

    def test_expired_job_is_forgotten(self, client, sandbox, monkeypatch):
        sandbox.solve = lambda stdin: str(sum(int(x) for x in stdin.split()))
        job_id = submit(client).json()["job_id"]
        wait_for_job(client, job_id)

        monkeypatch.setattr(client.app.state.services.queue, "ttl_s", -1)
        assert client.get(f"/jobs/{job_id}").status_code == 404


# --- jury testcase access (US-J5-03) ---------------------------------------


class TestValidateVersion:
    def test_an_unpublished_version_can_be_validated(self, client, problems_dir):
        write_problem(problems_dir, "ver", [("1\n", "1\n")], version="v1")
        # v2 exists on disk but `current` still points at v1.
        (problems_dir / "ver" / "v2" / "tests").mkdir(parents=True)
        (problems_dir / "ver" / "v2" / "problem.json").write_text("{}")
        (problems_dir / "ver" / "v2" / "tests" / "00001.in").write_text("2\n")
        (problems_dir / "ver" / "v2" / "tests" / "00001.ans").write_text("2\n")

        report = client.post("/problems/ver/validate?version=v2", json={}).json()
        assert report["version"] == "v2"
        assert report["ok"] is True


class TestTestcaseAccess:
    def test_returns_input_and_answer(self, client):
        body = client.get("/problems/sum/testcases/1").json()
        assert body["input"] == "10 20\n"
        assert body["answer"] == "30\n"
        assert body["truncated"] is False
        assert body["version"] == "v1"

    def test_out_of_range_index_is_404(self, client):
        assert client.get("/problems/sum/testcases/99").status_code == 404

    def test_negative_index_is_rejected(self, client):
        assert client.get("/problems/sum/testcases/-1").status_code == 400

    def test_version_selects_the_old_testcase(self, client, problems_dir):
        write_problem(problems_dir, "ver", [("1\n", "old\n")], version="v1")
        write_problem(problems_dir, "ver", [("1\n", "new\n")], version="v2")

        current = client.get("/problems/ver/testcases/0").json()
        assert current["answer"] == "new\n"

        historical = client.get("/problems/ver/testcases/0?version=v1").json()
        assert historical["answer"] == "old\n"
        assert historical["version"] == "v1"

    def test_large_testcase_is_truncated_and_flagged(self, client, problems_dir, monkeypatch):
        monkeypatch.setattr(client.app.state.services.settings, "testcase_response_bytes", 4)
        body = client.get("/problems/sum/testcases/1").json()
        assert body["truncated"] is True
        assert len(body["input"]) == 4
