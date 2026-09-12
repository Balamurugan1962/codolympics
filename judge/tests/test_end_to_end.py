"""Real submissions against a real go-judge.

Skipped unless JUDGE_E2E_URL points at a running sandbox:

    docker run -d --name gj --privileged --cgroupns=host -p 5050:5050 fyp-judge-worker:1.0
    JUDGE_E2E_URL=http://localhost:5050 pytest tests/test_end_to_end.py -v

Everything else in the suite runs against a fake sandbox so it works anywhere.
This file is the one that proves the fake is telling the truth, and it is the
check to run on the contest machine before the contest.
"""
from __future__ import annotations

import os
from pathlib import Path

import pytest

from tests.conftest import TOKEN, wait_for_job, write_problem

E2E_URL = os.environ.get("JUDGE_E2E_URL")

pytestmark = pytest.mark.skipif(
    not E2E_URL, reason="set JUDGE_E2E_URL to a running go-judge to run these"
)

# a+b, read until EOF. One per language we offer.
SOLUTIONS = {
    "c": '#include <stdio.h>\nint main(){long long a,b;while(scanf("%lld %lld",&a,&b)==2)printf("%lld\\n",a+b);}',
    "cpp": "#include <iostream>\nint main(){long long a,b;while(std::cin>>a>>b)std::cout<<a+b<<'\\n';}",
    "python": "import sys\nfor line in sys.stdin:\n    a,b=map(int,line.split())\n    print(a+b)",
    "pypy": "import sys\nfor line in sys.stdin:\n    a,b=map(int,line.split())\n    print(a+b)",
    "java": "import java.util.*;\npublic class Main{public static void main(String[] a){Scanner s=new Scanner(System.in);while(s.hasNextLong()){long x=s.nextLong(),y=s.nextLong();System.out.println(x+y);}}}",
    "javascript": "const d=require('fs').readFileSync(0,'utf8').trim().split('\\n');for(const l of d){if(!l.trim())continue;const[a,b]=l.trim().split(/\\s+/).map(BigInt);console.log((a+b).toString());}",
}

CASES = [("2 3\n", "5\n"), ("10 20\n", "30\n"), ("-1 1\n", "0\n")]


@pytest.fixture
def e2e_client(tmp_path: Path, monkeypatch):
    from fastapi.testclient import TestClient

    from app import main
    from app.config import settings

    root = tmp_path / "problems"
    root.mkdir()
    write_problem(root, "sum", CASES)

    monkeypatch.setattr(settings, "problems_dir", str(root))
    monkeypatch.setattr(settings, "service_token", TOKEN)
    monkeypatch.setattr(settings, "go_judge_url", E2E_URL)

    with TestClient(main.app) as client:
        client.headers.update({"Authorization": f"Bearer {TOKEN}"})
        yield client, root


def judge(client, source: str, language: str, problem_id: str = "sum") -> dict:
    response = client.post("/submit", json={
        "problem_id": problem_id, "language": language,
        "source": source, "submission_id": f"e2e-{language}",
    })
    assert response.status_code == 202, response.text
    return wait_for_job(client, response.json()["job_id"], timeout_s=120)["result"]


class TestEveryLanguageCompilesAndRuns:
    @pytest.mark.parametrize("language", sorted(SOLUTIONS))
    def test_correct_solution_is_accepted(self, e2e_client, language):
        client, _ = e2e_client
        result = judge(client, SOLUTIONS[language], language)
        assert result["verdict"] == "AC", f"{language}: {result}"
        assert result["passed"] == 3
        assert result["max_time_ms"] > 0


class TestVerdicts:
    def test_wrong_answer(self, e2e_client):
        client, _ = e2e_client
        result = judge(client, "#include <iostream>\nint main(){std::cout<<0<<'\\n';}", "cpp")
        assert result["verdict"] == "WA"
        assert result["first_fail"] == 0

    def test_compile_error(self, e2e_client):
        client, _ = e2e_client
        result = judge(client, "int main(){ this is not c++ }", "cpp")
        assert result["verdict"] == "CE"
        assert result["compile_output"]

    def test_time_limit_exceeded(self, e2e_client):
        client, _ = e2e_client
        result = judge(client, "int main(){for(;;);}", "cpp")
        assert result["verdict"] == "TLE"

    def test_runtime_error(self, e2e_client):
        client, _ = e2e_client
        result = judge(client, "int main(){return 1;}", "cpp")
        assert result["verdict"] == "RE"

    def test_crash_is_a_runtime_error(self, e2e_client):
        client, _ = e2e_client
        result = judge(client, "int main(){int*p=0;*p=1;}", "cpp")
        assert result["verdict"] == "RE"

    def test_memory_limit_exceeded(self, e2e_client):
        client, _ = e2e_client
        # Allocate in large chunks so the memory limit is reached long before
        # the time limit -- a byte-at-a-time loop just times out instead.
        source = ("#include <vector>\n#include <cstdio>\nint main(){"
                  "std::vector<std::vector<char>> blocks;"
                  "for(;;){blocks.emplace_back(64*1024*1024, 1);"
                  "printf(\"%zu\\n\", blocks.size());}}")
        assert judge(client, source, "cpp")["verdict"] == "MLE"


class TestSandboxContainment:
    """US-J2-04. A hostile submission must not reach the host or the test data."""

    def test_network_is_unavailable(self, e2e_client):
        client, _ = e2e_client
        source = (
            "import socket, sys\n"
            "try:\n"
            "    socket.create_connection(('1.1.1.1', 53), timeout=3)\n"
            "    print('NETWORK')\n"
            "except Exception:\n"
            "    print('blocked')\n"
        )
        result = judge(client, source, "python")
        assert result["verdict"] != "AC"
        assert "NETWORK" not in result.get("jury_detail", "")

    def test_testcases_are_not_visible_from_the_sandbox(self, e2e_client):
        client, _ = e2e_client
        source = (
            "import os\n"
            "hits = []\n"
            "for root in ('/problems', '/srv', '/testcases'):\n"
            "    if os.path.isdir(root):\n"
            "        hits.append(root)\n"
            "print('FOUND' if hits else 'none')\n"
        )
        result = judge(client, source, "python")
        # It prints 'none', which is not the expected answer, so WA -- but the
        # point is that it never printed FOUND.
        assert "FOUND" not in result.get("jury_detail", "")

    def test_fork_bomb_is_contained_and_the_judge_survives(self, e2e_client):
        client, _ = e2e_client
        source = "#include <unistd.h>\nint main(){for(;;)fork();}"
        result = judge(client, source, "cpp")
        assert result["verdict"] in {"RE", "TLE", "MLE"}
        # The judge is still answering afterwards.
        assert client.get("/health").json()["status"] == "ok"

    def test_one_submission_cannot_see_another_s_files(self, e2e_client):
        client, _ = e2e_client
        writer = "with open('secret.txt','w') as f: f.write('leaked')\nprint('5')"
        judge(client, writer, "python")

        reader = (
            "import os\n"
            "print('LEAKED' if os.path.exists('secret.txt') else '5')\n"
        )
        result = judge(client, reader, "python")
        assert "LEAKED" not in result.get("jury_detail", "")


class TestCompileOnceForReal:
    def test_ten_testcases_compile_once(self, e2e_client):
        client, root = e2e_client
        write_problem(root, "many", [(f"{i} {i}\n", f"{i * 2}\n") for i in range(10)])
        result = judge(client, SOLUTIONS["cpp"], "cpp", problem_id="many")
        assert result["verdict"] == "AC"
        assert result["passed"] == 10


class TestChecker:
    def test_checker_accepts_any_valid_answer(self, e2e_client):
        client, root = e2e_client
        checker = (
            "def check(inp, out, ans):\n"
            "    target = inp.int()\n"
            "    got = out.int()\n"
            "    if got * got != target:\n"
            "        return False, f'{got}^2 != {target}'\n"
            "    return True\n"
        )
        # Either root is acceptable; the answer file lists only one.
        write_problem(root, "sqrt", [("9\n", "3\n")], compare="checker", checker=checker)

        source = "print(-3)"
        assert judge(client, source, "python", problem_id="sqrt")["verdict"] == "AC"

    def test_checker_rejects_a_wrong_answer(self, e2e_client):
        client, root = e2e_client
        checker = (
            "def check(inp, out, ans):\n"
            "    target = inp.int()\n"
            "    got = out.int()\n"
            "    return got * got == target\n"
        )
        write_problem(root, "sqrt2", [("9\n", "3\n")], compare="checker", checker=checker)
        assert judge(client, "print(4)", "python", problem_id="sqrt2")["verdict"] == "WA"

    def test_malformed_contestant_output_is_wa_not_ie(self, e2e_client):
        client, root = e2e_client
        checker = (
            "def check(inp, out, ans):\n"
            "    inp.int()\n"
            "    return out.int() == ans.int()\n"
        )
        write_problem(root, "sqrt3", [("9\n", "3\n")], compare="checker", checker=checker)
        # The checker calls out.int() with no defence; the reader turns the
        # contestant's garbage into a clean WA.
        assert judge(client, "print('banana')", "python", problem_id="sqrt3")["verdict"] == "WA"

    def test_a_crashing_checker_is_ie_not_wa(self, e2e_client):
        client, root = e2e_client
        write_problem(
            root, "broken", [("1\n", "1\n")],
            compare="checker", checker="def check(inp, out, ans):\n    raise RuntimeError('boom')\n",
        )
        result = judge(client, "print(1)", "python", problem_id="broken")
        assert result["verdict"] == "IE"
        assert "not your fault" in result["message"]


class TestValidation:
    def test_reference_solution_finds_a_bad_answer_file(self, e2e_client):
        client, root = e2e_client
        write_problem(root, "bad", [("2 3\n", "5\n"), ("10 20\n", "999\n")])

        report = client.post("/problems/bad/validate", json={
            "reference_source": SOLUTIONS["cpp"], "language": "cpp",
        }).json()

        assert report["ok"] is False
        assert report["reference"]["verdict"] == "WA"
        assert report["reference"]["first_fail"] == 1     # names the bad file

    def test_good_problem_validates(self, e2e_client):
        client, _ = e2e_client
        report = client.post("/problems/sum/validate", json={
            "reference_source": SOLUTIONS["cpp"], "language": "cpp",
        }).json()
        assert report["ok"] is True
        assert report["reference"]["verdict"] == "AC"

    def test_wrong_solution_that_passes_is_reported(self, e2e_client):
        client, root = e2e_client
        # Every answer is 0, so a solution that always prints 0 is "correct".
        write_problem(root, "weak", [("0 0\n", "0\n")])
        report = client.post("/problems/weak/validate", json={
            "reference_source": SOLUTIONS["cpp"], "language": "cpp",
            "wrong_source": "#include <iostream>\nint main(){std::cout<<0<<'\\n';}",
        }).json()

        assert report["ok"] is False
        assert report["wrong_solution"]["verdict"] == "AC"
        assert any("discriminate" in issue for issue in report["issues"])

    def test_missing_answer_file_is_reported_by_name(self, e2e_client):
        client, root = e2e_client
        write_problem(root, "orphan", [("1 1\n", "2\n")])
        (root / "orphan" / "tests" / "00099.in").write_text("5 5\n")

        report = client.post("/problems/orphan/validate", json={}).json()
        assert report["ok"] is False
        assert any("00099.in" in issue for issue in report["issues"])

    def test_input_validator_catches_a_constraint_violation(self, e2e_client):
        client, root = e2e_client
        validator = (
            "def validate(inp):\n"
            "    a = inp.int(0, 100)\n"
            "    b = inp.int(0, 100)\n"
            "    inp.eof()\n"
        )
        write_problem(root, "bounded", [("5 5\n", "10\n"), ("999 1\n", "1000\n")],
                      validator=validator)

        report = client.post("/problems/bounded/validate", json={}).json()
        assert report["ok"] is False
        assert any("00002.in" in issue for issue in report["issues"])
