# Phase 1 — Requirements

**Component:** qualifying round — Logical Puzzles and Hacking
**Status:** implemented — see `judge/` and `web/`; run `web/tests/e2e/smoke.ts` for the end-to-end proof
**Related:** [requirements-backend.md](requirements-backend.md) · [requirements-judge.md](requirements-judge.md) · [lld.md](lld.md)

---

## Where this sits

```
registration → PHASE 1 → review → PHASE 2 → ended
               ├ Section A: Logical Puzzles
               └ Section B: Hacking
                                  ├ Auction 1 → Coding Round 1
                                  └ Auction 2 → Final Round
```

**Phase 1** qualifies participants for Phase 2. It has **two sections, run strictly in
sequence, each with its own fixed time limit**:

- **Section A — Logical Puzzles.** MCQ and short-answer questions. Pattern and
  observation, detective and mystery, constraint puzzles.
- **Section B — Hacking.** Participants are given a problem and a solution to it, and
  must find a test case that makes the solution fail.

**Phase 2** is the auction coding contest in
[requirements-backend.md](requirements-backend.md). Its `Auction 1 / Coding Round 1 /
Auction 2 / Final Round` steps are **rounds inside Phase 2**, not peers of Phase 1.
Where older documents say "Coding Round 1", they mean Phase 2's first coding round.

Between the phases, a `review` step: evaluators grade short answers, then an
administrator selects who advances.

### Phase 1 does execute code

Section B runs participant-supplied test inputs against a given solution in the
judge's sandbox. Phase 1 is therefore **not** independent of the judge — it needs one
endpoint the judge does not yet have (US-P3-04, and US-J7-01 in
[requirements-judge.md](requirements-judge.md)).

Section A executes nothing **unless** a question is scored by a validator
(US-P2-05) — in which case that validator runs in the same sandbox, at scoring time.

### Out of scope

- Auctions, virtual money, question ownership — all Phase 2
- Contributing to the Phase 2 score (US-P8-02)

---

## Roles

Three roles, each with a distinct job.

| Role | Can |
|---|---|
| **Participant** | answer Section A, submit hacks in Section B, see their own results |
| **Evaluator** | grade short answers and any manual item; see submissions and model answers. **Cannot** change contest state, scores of auto-graded items, phases, or who advances |
| **Administrator** | everything, including overrides, phases, advancement and disqualification |

### US-P1-01 · Roles are enforced server-side · MUST

**As** an administrator
**I want** each role limited to its own actions
**So that** an evaluator cannot alter the contest and a participant cannot reach either

**Acceptance criteria**

- GIVEN a participant session, THEN no evaluator or administrator route is reachable,
  including by direct URL
- GIVEN an evaluator session, THEN grading routes are reachable and contest-control
  routes are not
- GIVEN an evaluator, THEN they cannot see or alter who advances
- GIVEN any evaluator or administrator action, THEN it is audit-logged with the actor,
  the time and — for overrides — a reason
- GIVEN accounts, THEN an administrator creates evaluator accounts; evaluators do not
  self-register
- GIVEN an account, THEN it holds exactly one role — an evaluator or administrator
  cannot also compete, which removes the question of anyone grading their own work
- GIVEN the one-session-per-account rule, THEN it applies to **participants only**;
  evaluators and administrators may be signed in on more than one machine, since
  grading and running the contest happen side by side

---

## Epic P2 — Authoring Section A

### US-P2-01 · Create a puzzle question · MUST

**As** an administrator
**I want** to write a puzzle question in an editor
**So that** the question set is built without touching the database

**Acceptance criteria**

- GIVEN the editor, THEN a question has a title, a body in Markdown, a category
  (pattern · detective · constraint), a points value and a position in the set
- GIVEN the body, THEN it renders tables, formatting and code blocks — timetables and
  grids are central to these puzzles
- GIVEN a question, THEN it can be saved as a draft and published separately
- GIVEN an edit after Section A has opened, THEN it is audit-logged with a reason

### US-P2-02 · Choose the answer type · MUST

**As** an administrator
**I want** to pick how an answer is given and scored
**So that** most questions need no human to mark them

**Acceptance criteria**

- GIVEN the answer types, THEN these are offered:

  | Type | What the participant does | Typical use |
  |---|---|---|
  | `mcq_single` | picks one option | Who took the laptop |
  | `mcq_multi` | picks several options | Who could have been in the room |
  | `fill_blank` | types a short answer | Missing grid → `41` |
  | `numeric` | types a number | Minimum river crossings |
  | `sequence` | puts items in order | Event schedule, Monday to Friday |
  | `set` | adds several entries | All possible schedules |
  | `long_text` | writes freely | Find as many valid passwords as you can |

- GIVEN any type, THEN the administrator chooses its **grading mode**:

  | Mode | How it scores | Grading effort |
  |---|---|---|
  | `auto` | matched against an answer key the administrator supplies | none |
  | `validator` | a Python validator scores each entry the participant submits | none |
  | `manual` | read and scored by an evaluator | high |

- GIVEN `auto` on `fill_blank`, THEN several accepted spellings may be listed, and
  comparison ignores case and surrounding whitespace
- GIVEN `auto` on `numeric`, THEN an optional tolerance is configurable
- GIVEN `auto` on `mcq_multi` or `set`, THEN all-or-nothing or per-item partial credit
  is selectable
- GIVEN `manual`, THEN no answer key is required and the question joins the grading
  queue
- GIVEN any type, THEN the administrator may supply a **format specification** — a
  pattern and a plain-English hint such as "four digits, no spaces" — used by the
  client to reject malformed entries before they are ever submitted

### US-P2-03 · Short answers are judged on the explanation · MUST

**As** an administrator
**I want** short-answer questions marked on the reasoning, not just the result
**So that** understanding is what earns the points

**Acceptance criteria**

- GIVEN a short-answer question, THEN the participant writes an explanation and it is
  graded by an evaluator on the correctness of the logic
- GIVEN any question of any type, THEN an explanation box can additionally be enabled,
  carrying its own points set separately from the answer's
- GIVEN a question, THEN it may be explanation-only
- GIVEN explanation points, THEN they are awarded by an evaluator, never automatically

### US-P2-05 · Validator-scored questions · MUST

**As** an administrator
**I want** to upload a validator that decides whether each submitted entry is correct
**So that** "find as many as you can" puzzles score themselves

**Acceptance criteria**

- GIVEN a question in `validator` mode, THEN the administrator uploads a Python
  validator deciding whether one entry is correct
- GIVEN that validator, THEN it is written against the **same reader API** as Phase 2
  checkers and Section B validators — one interface, not three
- GIVEN a participant's entries, THEN the score is the number of **valid, distinct**
  entries multiplied by the configured points per entry
- GIVEN duplicate or near-duplicate entries, THEN they count once
- GIVEN a configured maximum, THEN no more than that many entries are counted, so a
  single question cannot dominate the section. It defaults to **100**
- GIVEN entries, THEN "distinct" means distinct after normalising — surrounding
  whitespace trimmed, internal runs of whitespace collapsed, and case ignored — unless
  the administrator marks the question case-sensitive
- GIVEN a total submission larger than **256 KB**, THEN it is rejected; entries are
  short by nature and this bounds what the validator must process
- GIVEN the validator, THEN it runs **in the judge's sandbox** with its own time and
  memory limits — an administrator's typo must not hang the contest
- GIVEN a validator that crashes, hangs or exceeds its limits, THEN the affected
  answers are flagged for administrator attention and **never silently scored zero**
- GIVEN the validator, THEN it is never served to a participant

### US-P2-06 · Format is checked in the browser, correctness is not · MUST

**As** an administrator
**I want** malformed entries rejected as they are typed, and correctness withheld
**So that** nobody wastes entries on typos, and nobody brute-forces the validator

**Acceptance criteria**

- GIVEN a format specification, THEN the client rejects a malformed entry immediately
  and explains the expected shape
- GIVEN format checking, THEN it is **also** enforced server-side — a manipulated
  client must not be able to submit malformed entries
- GIVEN a well-formed entry, THEN the participant is **not** told whether it is correct
  while the section is open
- GIVEN the section closing, THEN every entry is scored by the validator and results
  become visible according to the leaderboard setting

### US-P2-04 · Prove a question works before publishing · MUST

**As** an administrator
**I want** to test a question against my own intended answer
**So that** a contradictory puzzle is found in advance

**Acceptance criteria**

- GIVEN an `auto` question, THEN a trial answer can be submitted and the score it would
  receive is shown
- GIVEN the intended answer scoring less than full marks, THEN the question is marked
  **not ready** and publishing warns
- GIVEN a `validator` question, THEN the administrator supplies entries that should
  pass and entries that should fail, and the report shows how each was scored
- GIVEN a validator accepting an entry that should fail, or rejecting one that should
  pass, THEN the question is marked **not ready**
- GIVEN a `manual` question, THEN the administrator is prompted to record a model
  answer before publishing
- GIVEN the question list, THEN each question's ready state is visible at a glance

> Why this matters: a draft tiebreak puzzle was found to have **no valid answer at
> all** — its constraints were mutually contradictory. Entering the intended answer
> and seeing it score zero is what catches that, before the contest rather than during.

---

## Epic P3 — Authoring Section B (Hacking)

### US-P3-01 · Create a hacking question · MUST

**As** an administrator
**I want** to publish a problem together with a solution that is subtly wrong
**So that** participants can hunt for the input that breaks it

**Acceptance criteria**

- GIVEN a hacking question, THEN it carries a statement, input and output format,
  **constraints**, time and memory limits, and the **given solution** in a supported
  language
- GIVEN the given solution, THEN it is shown to participants in full — reading it is
  the task
- GIVEN the question, THEN it carries a **reference solution** that is correct, and
  that reference is **never shown to a participant** at any point
- GIVEN the question, THEN it carries a **validator** defining what a legal test input
  is, expressed with the same validator API as Phase 2 problems
- GIVEN points, THEN the administrator sets the points awarded for a successful hack
- GIVEN a failed attempt, THEN the administrator sets its penalty, **defaulting to 0**

### US-P3-02 · Prove the solution is actually breakable · MUST

**As** an administrator
**I want** to confirm my own breaking input works before publishing
**So that** an unbreakable question does not waste the section

**Acceptance criteria**

- GIVEN a hacking question, THEN the administrator supplies a known breaking input and
  the report confirms it is valid and that the given solution fails on it
- GIVEN that input failing to break the solution, THEN the question is marked **not
  ready** and publishing warns
- GIVEN the reference solution, THEN it is confirmed to succeed on that same input —
  otherwise the reference is wrong, not the given solution

### US-P3-03 · Submit a hack · MUST

**As** a participant
**I want** to submit a test case against a given solution
**So that** I can prove it is wrong

**Acceptance criteria**

- GIVEN a hacking question, THEN a participant submits a **test input** only — never
  code
- GIVEN an input violating the stated constraints, THEN it is rejected as invalid, the
  attempt does not count as a hack, and the reason names the violated constraint
- GIVEN a valid input on which the given solution produces a wrong answer, exceeds the
  time or memory limit, or crashes, THEN the hack **succeeds**
- GIVEN a valid input the given solution handles correctly, THEN the hack fails
- GIVEN the **first** successful hack on a given solution, THEN its points are awarded
- GIVEN any further successful hack on the **same** solution, THEN it is reported as
  successful but scores nothing — finding the flaw is the achievement, and scoring each
  variation would reward farming one bug with near-identical inputs
- GIVEN a solution already hacked, THEN the interface says so, so nobody wastes the
  section re-breaking it
- GIVEN a failed attempt, THEN the configured penalty applies, which is 0 unless the
  administrator changed it
- GIVEN attempts, THEN one is in flight per participant at a time, with a cooldown
  after each, as in Phase 2

### US-P3-04 · Judging a hack · MUST

**As** the backend
**I want** the judge to evaluate one supplied input against one given solution
**So that** hacking reuses the sandbox rather than adding a second execution path

**Acceptance criteria**

- GIVEN a hack, THEN the judge validates the input, runs the reference solution to
  obtain the correct answer, and runs the given solution under the question's limits
- GIVEN this, THEN it requires a judge endpoint that accepts an **ad-hoc input** rather
  than stored testcases (US-J7-01)
- GIVEN the reference solution, THEN it is stored with the problem and never returned
  by any endpoint
- GIVEN the judge being unreachable, THEN the attempt is marked pending and retried; it
  is never recorded as a failed hack

### US-P3-05 · What a participant is told · MUST

**As** an administrator
**I want** hack feedback limited to what is needed
**So that** the judge cannot be used to probe the solution's behaviour

**Acceptance criteria**

- GIVEN an attempt, THEN the participant is told whether the input was **valid**, and
  if valid whether the hack **succeeded**
- GIVEN an invalid input, THEN they are told which constraint it violated, since
  otherwise a malformed input is indistinguishable from a correct solution
- GIVEN a successful or failed hack, THEN the specific verdict — wrong answer, time
  limit, crash — is **not** disclosed to the participant
- GIVEN any attempt, THEN the reference solution's output is never disclosed
- GIVEN evaluators and administrators, THEN they see the full detail

---

## Epic P4 — Running the round

### US-P4-01 · Two sections, in sequence · MUST

**As** an administrator
**I want** each section opened in turn with its own deadline
**So that** the round runs as the rules describe it

**Acceptance criteria**

- GIVEN Phase 1, THEN Section A runs first and closes, then Section B opens
- GIVEN each section, THEN it has its own configurable time limit
- GIVEN a section that has not opened, THEN none of its content is reachable by any
  participant, by any route
- GIVEN a section that has closed, THEN submissions to it are rejected server-side
- GIVEN the deadline, THEN it comes from the server clock and every client shows the
  same remaining time
- GIVEN an administrator, THEN a section can be extended and all clients update
- GIVEN Section B opening, THEN it is triggered by an administrator, leaving room for a
  break or a fix between sections

### US-P4-02 · Answer in any order, revise until the section closes · MUST

**As** a participant
**I want** to move between questions and change my mind
**So that** I can start with what I see quickly and come back

**Acceptance criteria**

- GIVEN the open section, THEN its questions may be answered in any order
- GIVEN a Section A answer, THEN it may be changed freely until that section closes
- GIVEN a Section B hack, THEN it is final once submitted — it has already been judged
- GIVEN my progress, THEN which questions I have answered is visible to me
- GIVEN an explicit **finish** action, THEN it records my submission time and closes my
  participation in that section early

### US-P4-03 · Never lose an answer · MUST

**As** a participant
**I want** my answers saved as I work
**So that** a refresh or a machine failure costs me nothing

**Acceptance criteria**

- GIVEN an answer or explanation being typed, THEN it is persisted automatically
- GIVEN a page refresh or sign-in on another machine, THEN every answer is restored
- GIVEN a save failure, THEN I am warned rather than silently losing work
- GIVEN all answers, THEN they are held server-side, never only in the browser

---

## Epic P5 — Scoring and evaluation

### US-P5-01 · Objective answers score themselves · MUST

**Acceptance criteria**

- GIVEN a question in `auto` or `validator` mode, THEN it is scored without human input
- GIVEN partial credit configured, THEN each correct member earns its share
- GIVEN a wrong answer, THEN it scores zero — there is **no negative marking** in
  Section A
- GIVEN an unanswered question, THEN it scores zero and is distinguishable from a wrong
  answer in the evaluator's view

### US-P5-02 · One grading queue · MUST

**As** an evaluator
**I want** every manually graded item in one place
**So that** grading is a single pass

**Acceptance criteria**

- GIVEN manual answers and explanations, THEN both appear in the same queue
- GIVEN the queue, THEN it groups by question so one question is graded consistently
  across every participant
- GIVEN the queue, THEN the participant's identity can be hidden while grading
- GIVEN the queue, THEN the number of ungraded items is always visible
- GIVEN a graded item, THEN its score and any comment are recorded with the grader and
  the time
- GIVEN ungraded items, THEN advancement is not blocked; affected totals are marked
  provisional

### US-P5-03 · Phase 1 leaderboard · MUST

**Acceptance criteria**

- GIVEN the leaderboard, THEN it ranks by total points across both sections
- GIVEN equal totals, THEN the **earlier submission time ranks higher**
- GIVEN a participant, THEN their per-question breakdown is visible to evaluators and
  administrators
- GIVEN ungraded items, THEN affected totals are marked provisional
- GIVEN visibility of the **leaderboard** to participants, THEN it is an administrator
  setting — live, frozen or hidden
- GIVEN a section that has closed, THEN a participant can always see **their own**
  score and per-question breakdown, whatever the leaderboard setting — it is their own
  work, and withholding it only generates questions for the organisers

---

## Epic P6 — Advancing, and authority

### US-P6-01 · The administrator selects who advances · MUST

**Acceptance criteria**

- GIVEN the Phase 1 leaderboard, THEN an administrator selects any set of participants
  to advance — there is **no automatic top-N rule**
- GIVEN the basis for selection, THEN it is announced to participants **before** Phase 1
  begins, even if it is discretionary
- GIVEN a selection, THEN it is confirmed, audit-logged and a reason recorded
- GIVEN the selection, THEN it can be revised until Phase 2 opens
- GIVEN a participant not selected, THEN they are told clearly and Phase 2 routes are
  unreachable to them
- GIVEN an evaluator, THEN they cannot make or alter this selection

### US-P6-02 · Phase 1 is a selector, not a score · MUST

**Acceptance criteria**

- GIVEN Phase 2 standings, THEN Phase 1 points contribute **no score**
- GIVEN two participants tied on both Phase 2 score and total solve time, THEN the
  better Phase 1 rank ranks higher — it separates an exact tie without ever adding
  points
- GIVEN every advancing participant, THEN they begin Phase 2 with an **identical**
  balance regardless of Phase 1 performance — US-B1-01 is unchanged
- GIVEN Phase 1 results, THEN they remain viewable and exportable for the record

### US-P6-03 · Disqualification for malpractice · MUST

**As** an administrator
**I want** to disqualify a participant
**So that** the rule against malpractice can be applied

**Acceptance criteria**

- GIVEN a disqualification, THEN the participant is removed from the leaderboard and
  cannot advance
- GIVEN it, THEN a reason is required and it is audit-logged with actor and time
- GIVEN it, THEN their answers and submissions are retained for the record
- GIVEN it, THEN it is reversible by an administrator, also with a reason
- GIVEN an evaluator, THEN they may flag a participant for review but not disqualify

### US-P6-04 · Override any Phase 1 outcome · MUST

**Acceptance criteria**

- GIVEN any question, THEN it can be voided so it scores for nobody
- GIVEN any participant's score on a question, THEN an administrator can adjust it
- GIVEN a question found flawed mid-section, THEN it can be withdrawn and every total
  recomputed
- GIVEN any override, THEN a reason is required and it is audit-logged

---

## Non-functional requirements

| ID | Requirement | Verification |
|---|---|---|
| NFR-P-01 | 20 participants answering concurrently with no degradation | load test |
| NFR-P-02 | An answer is persisted within 2 s of being typed | failover test |
| NFR-P-03 | No answer key, validator, model answer, reference solution or grading note ever reaches the browser | contract test |
| NFR-P-04 | Section deadlines derive from the server clock on every client | timing test |
| NFR-P-05 | A hack attempt returns a result within 10 s at the configured limits | benchmark |
| NFR-P-06 | Judge unavailability never records a failed hack, and never scores a validator question zero | chaos test |
| NFR-P-07 | Phase 1 results are durable and exportable after the contest | export test |
| NFR-P-08 | Role boundaries hold against direct URL access | security test |

## Assumptions

1. Participants are the same accounts used in Phase 2; registration precedes Phase 1.
2. The hall, machines and kiosk constraints are those of
   [requirements-frontend.md](requirements-frontend.md).
3. Questions, given solutions, reference solutions and validators are authored and
   proved ready before the contest.
4. All code execution — Section A validators and Section B hacks alike — happens in
   the judge's sandbox. Neither section runs anything in the application process.

## Settled defaults

- Two sections, strictly sequential, each with its own time limit; Section B opened by
  an administrator
- Section A answers revisable until the section closes; Section B hacks final on submit
- No negative marking in Section A
- Open-ended Section A questions may be scored by an uploaded validator; format is
  checked in the browser, correctness only at scoring time
- Hacking scores on the **first** successful hack of each given solution; later hacks
  on the same solution score nothing. Failed attempts carry an administrator-set
  penalty, **default 0**
- Validator-scored questions count at most **100** distinct entries by default;
  distinctness is normalised for whitespace and case
- Hack inputs and answer submissions are capped at **256 KB**
- One account, one role — evaluators and administrators do not compete
- A participant can always see their own score once a section closes
- Short answers are graded on the correctness of the logical explanation
- Ties broken by earlier submission time
- Phase 1 rank is retained after the phase ends, because it breaks an exact tie in the
  **final** Phase 2 standings (US-B7-02)
- Advancement is an administrator's selection from the leaderboard, announced in
  advance as to basis
- Phase 1 points do not carry into Phase 2 standings or starting balance
- One session per account applies to participants only

## Open items

- Section A and Section B durations
- Points per question, per explanation and per successful hack; size of each set
- **These depend on how many participants advance** — see US-P6-01. Phase 2's starting
  balance and prices cannot be fixed until that number is known, because 25 questions
  among 20 people is a different auction from 25 among 8
- Points per valid entry for validator-scored questions
