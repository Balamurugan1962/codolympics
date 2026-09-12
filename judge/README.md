# Judge Service

Answers one question: **does this source code pass this problem?**

It knows nothing about auctions, virtual money, question ownership, hints or
scoring — all of that belongs to the backend. That boundary is what makes this
independently testable and releasable on its own.

- **Contract:** [openapi.yaml](openapi.yaml) — the backend builds against this
- **Requirements:** [../docs/requirements-judge.md](../docs/requirements-judge.md)
- **Why it is built this way:** [../docs/decisions.md](../docs/decisions.md)

## Running it

```bash
cp .env.example .env
openssl rand -hex 32          # put this in JUDGE_SERVICE_TOKEN
docker compose up -d --build
curl localhost:8000/health
```

`go-judge` publishes no ports. It runs untrusted code in a privileged
container and is reachable only from `judge-api` on the internal network.

## Submitting

```bash
TOKEN=...
curl -X POST localhost:8000/submit -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"problem_id":"sum","language":"cpp","source":"int main(){}"}'
# -> 202 {"job_id":"job_ab12cd34","state":"queued","poll_after_ms":500}

curl localhost:8000/jobs/job_ab12cd34 -H "Authorization: Bearer $TOKEN"
```

Poll until `state` is `done`. **A failing verdict is a completed job, not an
error** — `WA`, `TLE` and `CE` all come back as `200` with `state: done`.

## How a problem is laid out

Versioned — use this if the problem might ever be edited:

```
problems/hard-03/
  current -> v3          symlink; repointing it publishes atomically
  v3/
    problem.json
    tests/00001.in
    tests/00001.ans      (.out also accepted)
    checker.py           only for compare: checker
    validator.py         optional, run by POST /validate
```

Unversioned — fine for problems that will not change:

```
problems/easy-01/
  problem.json
  tests/...
```

`problem.json`:

```json
{
  "time_limit_ms": 1000,
  "memory_limit_mb": 256,
  "compare": "tokens",
  "early_exit": true,
  "float_tolerance": 1e-6
}
```

Testcase files must be **zero-padded** so lexical order equals numeric order.
`first_fail: 12` then means the same testcase on every run.

### Comparison modes

| `compare` | Behaviour |
|---|---|
| `tokens` | whitespace-insensitive (the default; right for most problems) |
| `exact` | byte-exact, trailing whitespace tolerated |
| `float` | numeric within `float_tolerance`, absolute or relative |
| `yesno` | case-insensitive YES/NO |
| `checker` | `checker.py` decides — for problems with more than one valid answer |

### Writing a checker

```python
def check(inp, out, ans):
    target = inp.int()
    got = out.int()
    if got * got != target:
        return False, f"{got}^2 != {target}"
    return True
```

`inp`, `out` and `ans` are readers over the test input, the contestant's output
and the expected answer: `.int(lo, hi)`, `.float()`, `.word()`, `.line()`,
`.ints(n)`, `.rest()`, `.eof()`.

**You do not need to defend against malformed contestant output.** If they
print a word where you called `out.int()`, the reader turns it into a clean
`WA`. The same failure reading `inp` or `ans` becomes `IE`, because broken jury
data is never the contestant's fault.

Checkers run inside the sandbox with their own limits. A checker that crashes,
hangs or exits unexpectedly gives `IE`, never `WA`.

### Writing a validator

```python
def validate(inp):
    t = inp.int(1, 100)
    total = 0
    for _ in range(t):
        total += inp.int(1, 10**5)
    assert total <= 10**6, "sum of n exceeds 10^6"
    inp.eof()
```

Run by `POST /problems/{id}/validate` over every input file.

## Before the contest

```bash
curl -X POST localhost:8000/problems/hard-03/validate \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"language":"cpp","reference_source":"...","wrong_source":"..."}'
```

The `reference_source` is the part that matters: it runs against **every**
testcase, ignoring `early_exit`. A `reference.first_fail` of 61 means testcase
61's answer file is wrong — found on a Tuesday rather than during the contest.

Do this for all 25 problems as the last deployment step.

## Adding a language

One entry in [app/languages.py](app/languages.py), plus its toolchain in
[../worker/Dockerfile](../worker/Dockerfile). Nothing in the judging logic
knows any language by name, and `/languages` is generated from the table so the
UI cannot drift.

## Tests

```bash
python3.12 -m venv .venv && .venv/bin/pip install -e ".[dev]"
.venv/bin/pytest                       # 119 tests, no Docker needed

docker run -d --name gj --privileged --cgroupns=host \
  --cpuset-cpus=0-3 -p 5050:5050 fyp-judge-worker:1.0
JUDGE_E2E_URL=http://localhost:5050 .venv/bin/pytest    # + 26 real ones
```

The end-to-end file is the one that runs real code in the real sandbox —
every language, every verdict, sandbox containment, checkers and validation.
**Run it on the contest machine before the contest.**

## The parts worth knowing

**Compile once, run many.** The compiled artefact is cached inside go-judge and
mounted into each run by `fileId`. One compile, N runs, and the artefact is
released in a `finally` whatever the outcome.

**Testcases run serially within a judgement**, and judgements run in parallel up
to `JUDGE_CONCURRENCY`. That caps total parallelism at the core count, which is
what keeps repeated timings comparable — measured spread goes from 27% to 6.6%
purely from pinning `cpuset`. If you change one thing about the deployment,
do not remove that pinning.

**`IE` is our fault, never theirs.** A broken checker, unreadable test data or a
sandbox failure all produce `IE`. Never score it against a participant.

**`jury_detail` leaks the answer.** It contains the expected output for the
failing test. Admin dashboard only — showing it to a contestant hands them what
they would otherwise have to buy as a hint.

**Nothing is persisted.** Jobs live in memory with a 10-minute TTL. A restart
loses in-flight jobs and polling returns `404`; the backend resubmits from its
own database. The problems volume is mounted read-only.

## Layout

| File | Responsibility |
|---|---|
| `app/main.py` | HTTP routes, auth, error shaping |
| `app/jobs.py` | queue, worker pool, job TTL |
| `app/judge.py` | compile once, run many, verdict decisions |
| `app/compare.py` | the four built-in comparison modes (pure functions) |
| `app/checker.py` | running checkers and validators in the sandbox |
| `app/checker_runtime.py` | the reader API — **runs inside the sandbox** |
| `app/validator_runtime.py` | validator harness — **runs inside the sandbox** |
| `app/validate.py` | problem validation |
| `app/problems.py` | problem loading, testcase pairing, versions |
| `app/storage.py` | key-based reads; swap `LocalStorage` for S3 here |
| `app/gojudge.py` | the sandbox client |
| `app/languages.py` | the language table |
| `app/config.py` | every tunable, all `JUDGE_`-prefixed env vars |

MIT licensed. go-judge is MIT, which is what makes that possible.
