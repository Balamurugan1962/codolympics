#!/usr/bin/env python3
"""Warm the judge before the contest, and prove every language works.

The first compile or run of each language after the sandbox starts is the slowest
one, because nothing is cached yet: the compiler and the runtime are read from
disk, and a standard header or a JVM is loaded cold. Run this a few minutes before
the contest opens and the first participant's submission is as fast as the
hundredth. It runs a tiny program in every language the judge offers, checks that
the answer is right, and exits non-zero if any language fails, so it is also a
last check that nothing was broken by a restart, an update or a rebuilt image.

Nothing is stored anywhere: it talks to the judge's /run endpoint, which judges
nothing and scores nothing. A real problem is only borrowed for its limits.

Usage (standard library only, no install):

    # development, judge on the host
    python3 judge/scripts/warm_up.py --url http://127.0.0.1:8001

    # the Docker stack: the judge publishes no port, so run it inside the container
    docker compose exec -T judge-api python - < judge/scripts/warm_up.py

The service token comes from JUDGE_SERVICE_TOKEN in the environment, or from a
.env file in the repository (the container already has it in its environment).
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

# Every one of these reads "n" then n numbers and prints the second largest
# distinct one. Each is deliberately typical of what a participant writes, and
# the C++ one includes <bits/stdc++.h>, which is what loads the precompiled header.
_PY = "import sys\nd = sorted(set(map(int, sys.stdin.read().split()[1:])))\nprint(d[-2] if len(d) > 1 else 'NONE')\n"
SOURCES = {
    "c": (
        '#include <stdio.h>\n#include <stdlib.h>\n'
        "int cmp(const void*a,const void*b){long long x=*(long long*)a,y=*(long long*)b;return (x>y)-(x<y);}\n"
        'int main(){int n;scanf("%d",&n);long long*a=malloc(n*sizeof(long long));'
        'for(int i=0;i<n;i++)scanf("%lld",&a[i]);qsort(a,n,sizeof(long long),cmp);'
        'int k=n-1;while(k>=0&&a[k]==a[n-1])k--;if(k<0)puts("NONE");else printf("%lld\\n",a[k]);return 0;}\n'
    ),
    "cpp": (
        "#include <bits/stdc++.h>\n"
        'int main(){int n;scanf("%d",&n);std::set<long long> s;for(int i=0;i<n;i++){long long x;scanf("%lld",&x);s.insert(x);}'
        'if(s.size()<2){puts("NONE");return 0;}auto it=s.rbegin();++it;printf("%lld\\n",*it);}\n'
    ),
    "python": _PY,
    "pypy": _PY,
    "java": (
        "import java.util.*;\n"
        "public class Main{public static void main(String[] x){Scanner s=new Scanner(System.in);int n=s.nextInt();"
        "TreeSet<Long> t=new TreeSet<>();for(int i=0;i<n;i++)t.add(s.nextLong());"
        'if(t.size()<2){System.out.println("NONE");return;}t.pollLast();System.out.println(t.last());}}\n'
    ),
    "javascript": (
        "const d=require('fs').readFileSync(0,'utf8').split(/\\s+/).filter(Boolean).map(Number).slice(1);"
        "const u=[...new Set(d)].sort((a,b)=>a-b);console.log(u.length>1?u[u.length-2]:'NONE');\n"
    ),
}
INPUT, EXPECTED = "5\n3 1 4 1 5\n", "4"


def _token() -> str:
    if os.environ.get("JUDGE_SERVICE_TOKEN"):
        return os.environ["JUDGE_SERVICE_TOKEN"]
    here = Path(__file__).resolve().parents[2] if "__file__" in globals() else Path.cwd()
    for candidate in (here / ".env", here / "web" / ".env"):
        if candidate.is_file():
            for line in candidate.read_text().splitlines():
                if line.startswith("JUDGE_SERVICE_TOKEN="):
                    return line.split("=", 1)[1].strip().strip('"')
    sys.exit("no JUDGE_SERVICE_TOKEN: set it in the environment or in a .env file")


class Judge:
    def __init__(self, url: str, token: str):
        self.url, self.headers = url.rstrip("/"), {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    def call(self, method: str, path: str, body: dict | None = None):
        request = urllib.request.Request(
            self.url + path, method=method, headers=self.headers, data=json.dumps(body).encode() if body else None
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return json.loads(response.read() or "null")
        except urllib.error.HTTPError as err:
            sys.exit(f"the judge refused {method} {path}: {err.code} {err.read().decode()[:200]}")
        except OSError as err:
            sys.exit(f"cannot reach the judge at {self.url}: {err}. Check --url, or run this inside the container")

    def run(self, problem: str, language: str, source: str, timeout_s: float = 180.0) -> tuple[bool, float, str]:
        """(passed, seconds, what went wrong)"""
        started = time.monotonic()
        job = self.call("POST", "/run", {"problem_id": problem, "language": language, "source": source, "inputs": [{"input": INPUT}]})
        while time.monotonic() - started < timeout_s:
            state = self.call("GET", f"/jobs/{job['job_id']}")
            if state["state"] == "done":
                result, took = state["result"], time.monotonic() - started
                if result["verdict"] != "AC":
                    detail = (result.get("compile_output") or result.get("message") or "").strip()
                    return False, took, f"{result['verdict']}: {detail[:160]}"
                out = (result["outputs"][0]["stdout"] if result.get("outputs") else "").strip()
                return (out == EXPECTED), took, "" if out == EXPECTED else f"printed {out!r}, expected {EXPECTED!r}"
            time.sleep(0.2)
        return False, time.monotonic() - started, "timed out"


def main() -> int:
    parser = argparse.ArgumentParser(description="Warm the judge and check every language works.")
    parser.add_argument("--url", default=os.environ.get("JUDGE_URL", "http://127.0.0.1:8000"))
    parser.add_argument("--rounds", type=int, default=2, help="times each language is run; the last shows the warm speed")
    parser.add_argument("--languages", help="comma-separated subset, e.g. cpp,java")
    args = parser.parse_args()

    judge = Judge(args.url, _token())
    health = judge.call("GET", "/health")
    if health.get("status") != "ok":
        sys.exit(f"the judge is not healthy: {health}")
    offered = [language["key"] for language in judge.call("GET", "/languages")["languages"]]
    wanted = args.languages.split(",") if args.languages else offered
    unknown = [k for k in offered if k not in SOURCES]
    if unknown:
        print(f"note: no warm-up program for {', '.join(unknown)}; they are not warmed or checked")
    problems = [p for p in judge.call("GET", "/problems")["problems"] if not p.get("hack_only")]
    if not problems:
        sys.exit("the judge has no ordinary problem to borrow limits from: import one first")
    problem = problems[0]["problem_id"]

    print(f"warming {args.url} with {problem}'s limits, {args.rounds} round(s) per language")
    print(f"{'language':<12} {'first':>8} {'warm':>8}   result")
    failed = 0
    for language in (k for k in wanted if k in SOURCES):
        if language not in offered:
            print(f"{language:<12} {'':>8} {'':>8}   FAIL: the judge does not offer this language")
            failed += 1
            continue
        times, problem_seen = [], ""
        for _ in range(max(1, args.rounds)):
            ok, took, why = judge.run(problem, language, SOURCES[language])
            times.append(took)
            if not ok:
                problem_seen = why
                break
        print(f"{language:<12} {times[0]:7.1f}s {times[-1]:7.1f}s   {'ok' if not problem_seen else 'FAIL: ' + problem_seen}")
        failed += bool(problem_seen)
    print("\nall languages ready" if not failed else f"\n{failed} language(s) FAILED: do not start the contest until this is fixed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
