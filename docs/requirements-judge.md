# Judge Service — Requirements

**Component:** `judge-api` + `go-judge`
**Status:** implemented — see `judge/` and `web/`; run `web/tests/e2e/smoke.ts` for the end-to-end proof
**Related:** [requirements-backend.md](requirements-backend.md) · [openapi.yaml](../judge/openapi.yaml)

---

## Scope

The judge answers exactly one question: **does this source code pass this problem?**

It knows nothing about auctions, virtual money, question ownership, hints, scoring
or participants. Those belong to the backend. This boundary is deliberate — it is
what makes the judge independently testable, independently deployable, and
releasable as open source.

**Primary consumer:** the backend service. No human uses this API directly.

### Out of scope

- Scoring, ranking, tiebreaks
- Who owns or paid for a question
- Authentication of participants (the backend authenticates; the judge trusts it)
- Problem authoring UI
- Storing submissions

### Personas

| | |
|---|---|
| **Backend** | the calling service; submits code and polls for verdicts |
| **Problem setter** | via the backend's admin UI; validates problems before the contest |
| **Operator** | deploys and monitors the service |

### Priority scale

`MUST` — contest cannot run without it · `SHOULD` — significant value, degradable ·
`COULD` — desirable, deferrable

---

## Epic J1 — Submitting and judging

### US-J1-01 · Submit a solution · MUST

**As** the backend
**I want** to submit source code against a problem and get a job handle immediately
**So that** no HTTP connection is held open for the duration of judging

**Acceptance criteria**

- GIVEN a valid problem, language and source
  WHEN the backend POSTs to `/submit`
  THEN it receives `202` with a `job_id` within 200 ms
  AND judging proceeds asynchronously

- GIVEN a language not offered by the service
  WHEN the backend submits
  THEN it receives `400` with `error: unknown_language`
  AND the message lists the available languages

- GIVEN a `problem_id` that does not exist
  WHEN the backend submits
  THEN it receives `404` with `error: problem_not_found`

- GIVEN source code larger than 256 KB
  WHEN the backend submits
  THEN it receives `400` with `error: source_too_large`

### US-J1-02 · Poll for a verdict · MUST

**As** the backend
**I want** to poll a job and see its progress
**So that** a participant sees "running test 34/87" rather than an indistinguishable spinner

**Acceptance criteria**

- GIVEN a job that is still running
  WHEN polled
  THEN `state` is `queued` or `running`
  AND `progress.done` and `progress.total` are present
  AND `result` is `null`

- GIVEN a job that has finished
  WHEN polled
  THEN `state` is `done`
  AND `result` contains the full judgement

- GIVEN a compile failure or any non-accepted outcome
  WHEN polled
  THEN `state` is still `done` — a failing verdict is a completed job, not an error
  AND the outcome is in `result.verdict`

- GIVEN a job whose TTL has expired, or the judge restarted
  WHEN polled
  THEN `404` with `error: job_not_found` is returned
  AND the backend may resubmit from its stored source

### US-J1-03 · Cancel a superseded job · SHOULD

**As** the backend
**I want** to cancel a participant's in-flight job when they resubmit
**So that** judging slots are not consumed producing verdicts nobody will read

**Acceptance criteria**

- GIVEN a queued or running job
  WHEN the backend DELETEs it
  THEN `204` is returned and no further testcases are executed

- GIVEN a job that already finished
  WHEN the backend DELETEs it
  THEN `204` is returned (no-op, not an error)

### US-J1-04 · Compile once, run many · MUST

**As** the operator
**I want** each submission compiled exactly once regardless of testcase count
**So that** judging cost scales with testcases, not with compilation

**Acceptance criteria**

- GIVEN a compiled language and a problem with N testcases
  WHEN the submission is judged
  THEN exactly one compile invocation occurs
  AND the compiled artefact is reused for all N runs

- GIVEN an interpreted language
  WHEN the submission is judged
  THEN the source is uploaded once and reused by reference

- GIVEN judging has finished, whatever the verdict
  THEN every cached artefact for that job is released

### US-J1-05 · Stop at the first failure · MUST

**As** the operator
**I want** judging to stop at the first failing testcase by default
**So that** wrong submissions — the majority — are cheap

**Acceptance criteria**

- GIVEN a problem with `early_exit` enabled and a solution failing at test 12
  WHEN judged
  THEN testcases after 12 are not executed
  AND `first_fail` is 12 and `passed` is 11

- GIVEN `early_exit` disabled
  WHEN judged
  THEN every testcase runs
  AND `first_fail` still reports the lowest-indexed failure

### US-J1-06 · Deterministic testcase ordering · MUST

**As** a problem setter
**I want** "test 12" to mean the same testcase on every run
**So that** verdict disputes and rejudges are resolvable

**Acceptance criteria**

- GIVEN a problem directory
  WHEN testcases are enumerated
  THEN they are ordered by filename, zero-padded so lexical order equals numeric order
  AND the same submission judged twice reports the same `first_fail`

---

## Epic J2 — Verdicts, limits and safety

### US-J2-01 · Accurate verdicts · MUST

**As** the backend
**I want** each outcome mapped to an unambiguous verdict
**So that** scoring and participant messaging are correct

**Acceptance criteria**

- GIVEN output matching the expected answer for every testcase, THEN `AC`
- GIVEN output differing from expected, THEN `WA`
- GIVEN a program exceeding the time limit, THEN `TLE`
- GIVEN a program exceeding the memory limit, THEN `MLE`
- GIVEN output exceeding the output limit, THEN `OLE`
- GIVEN a crash, signal, or non-zero exit, THEN `RE`
- GIVEN compilation failure, THEN `CE` with compiler output attached
- GIVEN a failure of the judge itself — a crashed checker, a sandbox fault — THEN `IE`

### US-J2-02 · Internal errors never harm the participant · MUST

**As** a participant
**I want** infrastructure failures kept distinct from my mistakes
**So that** I am never marked wrong because the judge broke

**Acceptance criteria**

- GIVEN a checker exiting with its failure code
  WHEN the testcase is evaluated
  THEN the verdict is `IE`, never `WA`
  AND the message identifies it as a checker fault

- GIVEN the sandbox is unreachable
  WHEN a submission is made
  THEN `503` with `error: sandbox_unavailable` is returned
  AND no verdict is recorded against the participant

### US-J2-03 · Enforce limits per testcase · MUST

**As** a problem setter
**I want** time and memory limits enforced on every individual testcase
**So that** limits mean what the statement says

**Acceptance criteria**

- GIVEN a 1 s limit and a program looping forever on test 3
  WHEN judged
  THEN test 3 is `TLE` and the limit applies to that testcase alone, not the whole run

- GIVEN the same time limit for every language
  WHEN a Python and a C++ submission are judged
  THEN both receive identical limits — there are no per-language multipliers

### US-J2-04 · Contain untrusted code · MUST

**As** the operator
**I want** submissions unable to affect the host or each other
**So that** a hostile submission cannot compromise the contest

**Acceptance criteria**

- GIVEN a submission attempting network access, THEN the attempt fails
- GIVEN a submission attempting to read outside its sandbox, THEN the attempt fails
- GIVEN a fork bomb, THEN it is contained by the process limit and the judge stays responsive
- GIVEN any submission, THEN the testcase directory is never mounted into its sandbox
- GIVEN two submissions judged in sequence, THEN neither can observe the other's files

### US-J2-05 · Consistent timing · MUST

**As** a participant
**I want** the same code to take the same measured time run to run
**So that** a time-based tiebreak is fair

**Acceptance criteria**

- GIVEN the sandbox pinned to a dedicated CPU set
  WHEN the same submission is judged repeatedly under load
  THEN measured CPU times vary by less than 10 %

- GIVEN concurrent judging
  THEN parallelism never exceeds the assigned core count

---

## Epic J3 — Comparing output

### US-J3-01 · Comparison without writing code · MUST

**As** a problem setter
**I want** common comparison modes available by name
**So that** most problems need no checker at all

**Acceptance criteria**

- GIVEN `compare: tokens`, THEN outputs differing only in whitespace are accepted
- GIVEN `compare: exact`, THEN only trailing whitespace differences are tolerated
- GIVEN `compare: float` with a tolerance, THEN numeric answers within tolerance are accepted
- GIVEN `compare: yesno`, THEN `YES`/`yes`/`Yes` are equivalent

### US-J3-02 · Python checkers · MUST

**As** a problem setter
**I want** to write checkers in Python
**So that** multi-answer problems are authorable without C++ or testlib

**Acceptance criteria**

- GIVEN `compare: checker` and a `checker.py` defining `check(inp, out, ans)`
  WHEN a testcase is evaluated
  THEN the checker decides the verdict

- GIVEN a checker that rejects with a message
  THEN the verdict is `WA` and the message is available to the jury

- GIVEN contestant output that is malformed, empty, or has extra tokens
  WHEN read through the reader API with bounds
  THEN the result is a clean `WA`, never a crashed checker

- GIVEN a checker that raises, hangs, or exceeds its own limits
  THEN the verdict is `IE`, never `WA`

- GIVEN a problem's checker
  THEN it is compiled or loaded once and reused for the whole contest

### US-J3-03 · Checkers are sandboxed · MUST

**As** the operator
**I want** checkers executed inside the sandbox
**So that** a buggy checker cannot hang or damage the judge

**Acceptance criteria**

- GIVEN any checker, THEN it runs in the sandbox with its own time and memory limits
- GIVEN a checker exceeding those limits, THEN the verdict is `IE` and judging continues

---

## Epic J4 — Problem validation

### US-J4-01 · Structural validation · MUST

**As** a problem setter
**I want** malformed problems detected before the contest
**So that** a question is never auctioned with broken data behind it

**Acceptance criteria**

- GIVEN an input file with no matching answer file
  WHEN the problem is validated
  THEN `ok` is false and the issue names the offending file

- GIVEN an unparseable problem configuration, THEN validation fails with a clear message
- GIVEN a checker that fails to compile or import, THEN validation fails and reports why

### US-J4-02 · Reference solution proves the answer files · MUST

**As** a problem setter
**I want** a known-correct solution run against every testcase
**So that** wrong answer files are found weeks before a contestant disputes one

**Acceptance criteria**

- GIVEN a reference solution and a problem
  WHEN validated
  THEN the solution is run against **every** testcase, ignoring `early_exit`
  AND the report gives its verdict and any first failing testcase

- GIVEN a reference solution failing at testcase 61
  THEN the report identifies 61, indicating that answer file or the solution is wrong

- GIVEN a reference solution whose slowest testcase approaches the time limit
  THEN the report surfaces the maximum time so the setter can judge whether the limit is safe

### US-J4-03 · Confirm testcases discriminate · SHOULD

**As** a problem setter
**I want** to check a known-wrong solution is rejected
**So that** I know my testcases actually catch a bad answer

**Acceptance criteria**

- GIVEN a deliberately incorrect solution
  WHEN validated
  THEN its verdict is reported
  AND `ok` is false if it was accepted, because a test set that passes everything is worthless

### US-J4-04 · Input validators · SHOULD

**As** a problem setter
**I want** to assert my input files obey the stated constraints
**So that** generator bugs do not produce tests contestants cannot debug

**Acceptance criteria**

- GIVEN an optional `validator.py`
  WHEN a problem is validated
  THEN every input file is checked against it

- GIVEN a validator asserting an aggregate constraint such as sum-of-n
  WHEN a file violates it
  THEN validation fails naming the file and the violated constraint

- GIVEN a file with trailing whitespace, CRLF endings, or trailing garbage
  THEN the validator can detect and reject it

---

## Epic J5 — Problems and testcases

### US-J5-01 · List problems · MUST

**As** an administrator
**I want** to see every problem with its counts, size, version and validation state
**So that** I can confirm the problem set is ready

**Acceptance criteria**

- GIVEN problems on disk
  WHEN listed
  THEN each entry gives id, testcase count, total bytes, version, limits, compare mode,
  validation state and last-modified time

### US-J5-02 · Problem metadata · MUST

**As** the backend
**I want** to confirm a problem exists before auctioning it
**So that** nobody buys a question with nothing behind it

**Acceptance criteria**

- GIVEN a problem id, WHEN requested, THEN its metadata and testcase count are returned
- GIVEN an unknown id, THEN `404` is returned

### US-J5-03 · Serve a testcase for jury inspection · SHOULD

**As** an administrator resolving a dispute
**I want** to read a specific testcase at the version a submission was judged against
**So that** I can answer "my code works" with evidence

**Acceptance criteria**

- GIVEN a problem, testcase index and version
  WHEN requested with a valid service token
  THEN the input and expected answer are returned

- GIVEN a version parameter
  THEN the testcase from **that** version is returned — not the current one, which
  may differ after a mid-contest correction

- GIVEN a testcase larger than the response cap of 1 MB
  THEN it is truncated and flagged as such

- GIVEN this endpoint
  THEN it is for administrators only. **Hidden testcases are never sold or shown to
  participants** — closing the exploit where a participant submits deliberately bad
  code, buys each revealed failing testcase in turn, and hardcodes answers instead of
  solving

### US-J5-04 · Versioned problems · MUST

**As** an administrator
**I want** every judgement to record which version of the problem it used
**So that** jury inspection matches the submission and rejudge disputes are resolvable

**Acceptance criteria**

- GIVEN any judgement, THEN `problem_version` identifies exactly what was judged
- GIVEN a problem edited mid-contest, THEN in-flight judgements are unaffected by the swap
- GIVEN a published update, THEN it becomes live atomically — never a half-written state

### US-J5-05 · Pluggable storage · SHOULD

**As** the operator
**I want** testcase storage behind a narrow interface
**So that** object storage can replace local disk without touching judging logic

**Acceptance criteria**

- GIVEN the storage interface, THEN it exposes only key-based read and prefix listing
- GIVEN local disk configured, THEN testcases are read directly with no network round trip
- GIVEN an S3-compatible backend configured, THEN fetched objects are cached locally
  so repeated judging of one problem does not re-fetch

---

## Epic J6 — Operations

### US-J6-01 · Authenticated access · MUST

**As** the operator
**I want** every endpoint except health to require a service token
**So that** only the backend can reach the judge

**Acceptance criteria**

- GIVEN a missing or wrong token, THEN `401` is returned
- GIVEN the sandbox service, THEN it publishes no ports and is reachable only from `judge-api`

### US-J6-02 · Health and capacity · MUST

**As** the operator
**I want** a health endpoint reporting sandbox reachability and load
**So that** I learn the contest is degraded before participants tell me

**Acceptance criteria**

- GIVEN a healthy service, THEN health reports `ok` with problem count, busy and capacity
- GIVEN an unreachable sandbox, THEN health reports `degraded`
- GIVEN this endpoint, THEN it requires no authentication and is usable as a container check

### US-J6-03 · Bounded concurrency · MUST

**As** the operator
**I want** concurrent judging capped
**So that** load cannot make measured times unreliable

**Acceptance criteria**

- GIVEN all judging slots occupied, THEN new submissions receive `429` with `Retry-After`
- GIVEN the cap, THEN it is configurable and defaults to no more than the assigned core count

### US-J6-04 · Statelessness across restarts · SHOULD

**As** the operator
**I want** a restart to lose nothing but in-flight jobs
**So that** the judge can be redeployed mid-contest if necessary

**Acceptance criteria**

- GIVEN a restart, THEN no durable state is lost, because none is kept
- GIVEN jobs in flight at restart, THEN polling them returns `404` and the backend resubmits

### US-J6-05 · Add a language without touching judging logic · SHOULD

**As** the operator
**I want** languages defined declaratively
**So that** adding one before the contest is low risk

**Acceptance criteria**

- GIVEN a new language, THEN adding it requires one definition entry plus its toolchain
- GIVEN the language list, THEN `/languages` reflects it so the UI cannot drift

---

## Epic J7 — Hacking support

Phase 1's Hacking section gives participants a problem and a solution to it, and asks
them to find a test case that makes the solution fail
([requirements-phase1.md](requirements-phase1.md), Epic P3).

Everything this needs already exists except one thing: every endpoint today runs a
submission against **stored** testcases. Hacking inverts that — a stored solution
against a **supplied** testcase.

### US-J7-01 · Judge one supplied input · MUST

**As** the backend
**I want** to run a solution against a single test input given in the request
**So that** hacking reuses this sandbox rather than adding a second execution path

**Acceptance criteria**

- GIVEN a problem, a solution and a test input, WHEN submitted
  THEN a job handle is returned and the result is polled like any other job
- GIVEN the problem has a validator, THEN the input is checked against it first
  AND an invalid input returns `valid_input: false` with the violated constraint named
  AND the solution is not run at all
- GIVEN a valid input, THEN the problem's stored reference solution is run to obtain
  the correct answer
- GIVEN a valid input, THEN the solution under test is run under the problem's time and
  memory limits
- GIVEN the solution under test producing a wrong answer, exceeding a limit, or
  crashing, THEN `hacked: true` with its verdict
- GIVEN the solution under test producing the correct answer, THEN `hacked: false`
- GIVEN the reference solution itself failing, THEN the result is `IE` and `hacked` is
  **not** reported — the problem is broken, and a participant must never be credited or
  penalised for that
- GIVEN a supplied input larger than **256 KB**, THEN `400` with a clear error — the
  same cap as source code, and enough for any hand-written test case

### US-J7-02 · Reference solutions are stored and never served · MUST

**As** an administrator
**I want** the correct solution held with the problem and unreachable
**So that** hacking cannot be short-circuited by reading the answer

**Acceptance criteria**

- GIVEN a problem package, THEN it may carry a reference solution and the language it
  is written in
- GIVEN the reference solution, THEN **no endpoint returns it**, to any caller, at any
  privilege level
- GIVEN a stored reference solution, THEN `POST /validate` uses it when no
  `reference_source` is supplied in the request
- GIVEN a hacking problem with no stored reference solution, THEN validation fails with
  a clear message — it cannot be used for hacking

### US-J7-03 · Score entries against a supplied validator · MUST

**As** the backend
**I want** to run a validator over a list of answers and learn which are valid
**So that** Phase 1's open-ended questions score themselves

**Acceptance criteria**

- GIVEN a validator and a list of entries, WHEN submitted
  THEN each entry is reported valid or invalid, in order
- GIVEN the validator, THEN it runs in the sandbox under its own time and memory
  limits — it is administrator-written, not participant-written, but a typo must not
  be able to hang the contest
- GIVEN a validator that crashes, hangs or exceeds its limits, THEN the result is `IE`
  and **no entry is reported invalid** — the caller must be able to tell "rejected"
  apart from "never checked"
- GIVEN one entry causing the validator to raise, THEN that entry is reported as an
  error and the remaining entries are still evaluated
- GIVEN the validator, THEN it uses the same reader API as checkers and input
  validators

> This and US-J7-01 are the only two capabilities Phase 1 needs. Both are variations
> on "run something in the sandbox against data supplied in the request", which is the
> one shape this service did not previously offer.

---

## Non-functional requirements

| ID | Requirement | Verification |
|---|---|---|
| NFR-J-01 | Submission acknowledged within 200 ms | load test |
| NFR-J-02 | Typical submission (30 testcases, fast solution) judged within 3 s | benchmark |
| NFR-J-03 | Sustains at least 240 submissions/hour at the configured limits | capacity test |
| NFR-J-04 | Supports at least 20 concurrent participants | concurrency test |
| NFR-J-05 | Repeated timing of identical submissions varies by under 10 % | timing test |
| NFR-J-06 | No sandbox escape under adversarial submissions | security test |
| NFR-J-07 | Handles problems of at least 500 testcases | scale test |
| NFR-J-08 | Deploys via a single compose file on Ubuntu with Docker | deployment test |
| NFR-J-09 | API conforms to the published OpenAPI specification | contract test |
| NFR-J-10 | Released under the MIT licence with no copyleft dependencies | licence audit |

## Assumptions

1. The backend is trusted; the judge does not authenticate participants.
2. Testcases are prepared and validated before the contest.
3. The host provides cgroup v2 and permits privileged containers.
4. The problem set lives on a volume the backend writes and the judge reads. The judge
   **never writes** to it; publishing a new version is the backend swapping the
   `current` symlink, which this service already treats as atomic.

## Open items

*None outstanding.*

## Settled defaults

- Job TTL: 10 minutes after completion
- Testcase response cap: 1 MB, truncated with a flag
- Supplied hack input cap: 256 KB, matching the source cap
- Python reader API for checkers and validators: implemented as `app/sandbox/runtime/checker_runtime.py`;
  `int(lo, hi)`, `float()`, `word()`, `line()`, `ints(n)`, `rest()`, `eof()`, with
  malformed contestant output producing `WA` and malformed jury data producing `IE`
