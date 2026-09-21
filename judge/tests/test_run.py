"""Practice runs (/run): the participant's code on inputs they can see."""
from tests.conftest import wait_for_job, write_problem

CORRECT = "// CORRECT: sums the numbers"
FLAWED = "// FLAWED: forgets negative numbers"


def correct(stdin: str) -> str:
    return str(sum(int(x) for x in stdin.split()))


def flawed(stdin: str) -> str:
    return str(sum(abs(int(x)) for x in stdin.split()))


def run(client, source: str, inputs: list[dict], problem_id: str = "sum", samples: int = 0) -> dict:
    response = client.post("/run", json={
        "problem_id": problem_id, "language": "cpp", "source": source,
        "samples": samples, "inputs": inputs, "submission_id": "r1",
    })
    assert response.status_code == 202, response.text
    return wait_for_job(client, response.json()["job_id"])["result"]


class TestRun:
    def test_samples_are_compared_and_custom_input_is_not(self, client, sandbox, problems_dir):
        write_problem(problems_dir, "sum", [("1 2\n", "3\n")])
        sandbox.programs = {FLAWED: flawed}

        result = run(client, FLAWED, [
            {"input": "1 2\n", "answer": "3\n"},
            {"input": "-1 2\n", "answer": "1\n"},
            {"input": "-5 -5\n"},
        ])
        assert [o["verdict"] for o in result["outputs"]] == ["AC", "WA", "AC"]
        assert [o["stdout"] for o in result["outputs"]] == ["3", "3", "10"]
        assert result["verdict"] == "WA"
        assert result["message"] == "1 of 3 failed"
        assert result["submission_id"] == "r1"

    def test_all_passing(self, client, sandbox, problems_dir):
        write_problem(problems_dir, "sum", [("1 2\n", "3\n")])
        sandbox.programs = {CORRECT: correct}

        result = run(client, CORRECT, [{"input": "1 2\n", "answer": "3\n"}, {"input": "-1 2\n", "answer": "1\n"}])
        assert result["verdict"] == "AC"
        assert result["message"] == "2 of 2 ran"

    def test_compile_error_reports_the_compiler_output(self, client, sandbox, problems_dir):
        write_problem(problems_dir, "sum", [("1 2\n", "3\n")])
        sandbox.compile_fails = True

        result = run(client, "int main( {", [{"input": "1 2\n"}])
        assert result["verdict"] == "CE"
        assert result["outputs"] == []
        assert "error" in result["compile_output"]

    def test_a_crash_keeps_its_stderr(self, client, sandbox, problems_dir):
        write_problem(problems_dir, "sum", [("1 2\n", "3\n")])
        sandbox.programs = {FLAWED: "Nonzero Exit Status"}

        result = run(client, FLAWED, [{"input": "1 2\n"}])
        assert result["verdict"] == "RE"
        assert result["outputs"][0]["stderr"] == "boom"

    def test_compiles_once_for_all_inputs(self, client, sandbox, problems_dir):
        write_problem(problems_dir, "sum", [("1 2\n", "3\n")])
        sandbox.programs = {CORRECT: correct}

        run(client, CORRECT, [{"input": "1\n"}, {"input": "2\n"}, {"input": "3\n"}])
        assert sandbox.compiles == 1
        assert sandbox.runs == 3

    def test_samples_are_read_from_the_problem(self, client, sandbox, problems_dir):
        write_problem(problems_dir, "sum", [("1 2\n", "3\n"), ("-1 2\n", "1\n"), ("9 9\n", "18\n")])
        sandbox.programs = {FLAWED: flawed}

        result = run(client, FLAWED, [{"input": "5\n"}], samples=2)
        # Two samples compared against their stored answers, then the custom input.
        assert [o["verdict"] for o in result["outputs"]] == ["AC", "WA", "AC"]
        assert sandbox.runs == 3

    def test_nothing_to_run_is_rejected(self, client, problems_dir):
        write_problem(problems_dir, "sum", [("1 2\n", "3\n")])
        response = client.post("/run", json={"problem_id": "sum", "language": "cpp", "source": CORRECT, "inputs": []})
        assert response.status_code == 400

    def test_too_many_inputs_rejected(self, client, problems_dir):
        write_problem(problems_dir, "sum", [("1 2\n", "3\n")])
        response = client.post("/run", json={
            "problem_id": "sum", "language": "cpp", "source": CORRECT,
            "inputs": [{"input": "1\n"}] * 11,
        })
        assert response.status_code == 422
