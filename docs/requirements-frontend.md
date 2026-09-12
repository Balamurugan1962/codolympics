# Frontend — Requirements

**Component:** participant web client + administrator dashboard
**Status:** requirements agreed, not implemented
**Related:** [requirements-backend.md](requirements-backend.md) · [requirements-judge.md](requirements-judge.md)

---

## Scope

Everything a participant or administrator sees. It renders state the backend owns
and never decides anything itself — no scoring, no eligibility, no timing. A
manipulated client must not be able to gain an advantage.

Delivered as a **web application in a locked-down browser**, not a desktop app.
Participants sit at machines the organisers control, in a proctored exam hall, in a
kiosk session with no other application reachable and the network firewalled to the
contest server.

### Consequences of running in a kiosk

Participants **cannot use their own editor, compiler or local testing**. All code is
written in the browser and compiled server-side. This must be stated in the rules in
advance — a competitive programmer expecting their own templates will otherwise
discover the constraint mid-contest.

### Personas

| | |
|---|---|
| **Participant** | bids, reads owned questions, writes and submits code, buys hints |
| **Administrator** | manages problems, drives phases, monitors health, resolves incidents |

### Priority scale

`MUST` · `SHOULD` · `COULD`

---

## Epic F1 — Access

### US-F1-01 · Register and sign in · MUST

**As** a participant arriving in the hall
**I want** to register myself and sign in
**So that** the contest knows who I am

**Acceptance criteria**

- GIVEN registration is open, THEN a participant can register and state their preferred language
- GIVEN registration is closed, THEN this is explained rather than shown as a broken form
- GIVEN valid credentials, THEN the participant reaches their dashboard
- GIVEN invalid credentials, THEN a clear error is shown without revealing which field was wrong

### US-F1-02 · Continue on a different machine · MUST

**As** a participant whose machine failed
**I want** to sign in elsewhere and find everything as I left it
**So that** a hardware fault costs me minutes, not my contest

**Acceptance criteria**

- GIVEN a sign-in on another machine, THEN balance, owned questions, purchased hints and submission history are all present
- GIVEN a sign-in elsewhere, THEN the previous session ends and that window explains why, rather than failing silently
- GIVEN unsaved editor content, THEN the frontend must not be the only place it exists (see US-F5-03)

### US-F1-03 · Administrators sign in directly · MUST

**As** an administrator
**I want** to sign in without registering
**So that** I can run the contest

**Acceptance criteria**

- GIVEN admin credentials, THEN the admin dashboard is shown
- GIVEN a participant session, THEN no admin view is reachable, even by direct URL

---

## Epic F2 — The auction

### US-F2-01 · See what is up for bidding · MUST

**As** a participant
**I want** to see the question on offer and its current price
**So that** I can decide whether to bid

**Acceptance criteria**

- GIVEN the auction, THEN one question is up for bidding at a time, and the published running order is visible so participants can budget ahead
- GIVEN a question at auction, THEN its title, difficulty tier and score are shown
- GIVEN a question at auction, THEN its **statement is not** shown — that is what is being bought
- GIVEN bidding, THEN the current highest bid and its holder are visible
- GIVEN the first bid has been placed, THEN a server-driven countdown is shown
- GIVEN a new higher bid, THEN the countdown visibly **restarts**, making clear that bidding last does not win
- GIVEN no bid has yet been placed, THEN the opening window is shown, after which the question goes unsold

### US-F2-02 · Place a bid · MUST

**As** a participant
**I want** to bid with one clear action
**So that** I am not lost in a form while bidding moves

**Acceptance criteria**

- GIVEN the current highest bid, THEN the bid control offers exactly the next legal amount — current + increment X
- GIVEN a bid that would exceed my balance, THEN the control is disabled and the reason shown
- GIVEN I place a bid, THEN the result is reflected within 1 s
- GIVEN a rejected bid, THEN the reason is shown and my displayed balance is corrected
- GIVEN my own highest bid, THEN I cannot bid against myself

### US-F2-03 · Follow bidding live · MUST

**As** a participant
**I want** the auction to update without refreshing
**So that** I never act on stale information

**Acceptance criteria**

- GIVEN another participant bids, THEN my view updates within 1 s
- GIVEN a lost connection, THEN a clear indicator appears and the view reconciles on reconnect
- GIVEN reconnection, THEN state comes from the server, never from cached local state

### US-F2-04 · See the outcome · MUST

**As** a participant
**I want** to see who won and what my balance is now
**So that** I can plan my next bid

**Acceptance criteria**

- GIVEN bidding closes, THEN the winner and final price are shown
- GIVEN I won, THEN the question appears among my questions and my balance is updated
- GIVEN I lost, THEN my balance is unchanged

### US-F2-05 · Buy hints in the second auction · MUST

**As** a participant
**I want** to spend remaining money on hints for questions I own
**So that** leftover balance stays useful

**Acceptance criteria**

- GIVEN the second auction, THEN unsold questions are offered at their original base price
- GIVEN hints, THEN they are purchasable in every phase, not only here
- GIVEN hints, THEN prices are shown before purchase
- GIVEN a question I do not own, THEN its hints are not offered

---

## Epic F3 — Dashboard

### US-F3-01 · See my position at a glance · MUST

**As** a participant
**I want** my balance, my questions and the time remaining always visible
**So that** I can make decisions without hunting

**Acceptance criteria**

- GIVEN any contest screen, THEN balance, current phase and time remaining are visible
- GIVEN my questions, THEN each shows its status: unattempted, attempted, or solved
- GIVEN any phase, THEN I can read, code, submit and buy hints — the auction does not block working
- GIVEN the countdown, THEN it is driven by the server clock, not the browser's

### US-F3-02 · Only my questions · MUST

**As** a participant
**I want** to see only the questions I own
**So that** the ownership rule is evident and unbreakable

**Acceptance criteria**

- GIVEN questions I do not own, THEN they are not listed and their statements are unreachable by direct URL
- GIVEN a question I own, THEN I can open, read and attempt it

### US-F3-03 · Receive announcements · SHOULD

**As** a participant
**I want** to see administrator announcements promptly
**So that** I learn about corrections affecting my question

**Acceptance criteria**

- GIVEN an announcement, THEN it appears without a refresh and is visibly unread
- GIVEN a verdict of mine changed by a rejudge, THEN I am notified explicitly

---

## Epic F4 — Reading a question

### US-F4-01 · Read the statement · MUST

**As** a participant
**I want** the full statement with constraints and samples
**So that** I can solve the problem

**Acceptance criteria**

- GIVEN a question I own, THEN its statement renders with formatting, formulae and code blocks intact
- GIVEN the statement, THEN input format, output format and constraints are clearly delineated
- GIVEN the time and memory limits, THEN they are shown

### US-F4-02 · See sample testcases free · MUST

**As** a participant
**I want** sample input and output visible at no cost
**So that** I can confirm my output format without paying

**Acceptance criteria**

- GIVEN samples, THEN their input and expected output are shown in full
- GIVEN samples, THEN they are clearly distinguished from hidden testcases
- GIVEN a sample, THEN it can be copied in one action

### US-F4-03 · Hidden testcases are opaque · MUST

**As** an administrator
**I want** hidden testcase content unreachable unless purchased
**So that** the hint economy is not bypassed

**Acceptance criteria**

- GIVEN hidden testcases, THEN only their count is shown — their content is **never** available, for free or for payment
- GIVEN any API response reaching the browser, THEN it never contains hidden testcase content
- GIVEN a verdict, THEN `jury_detail` is never present in the client — it contains the expected answer

---

## Epic F5 — Writing and submitting code

### US-F5-01 · Write code in the browser · MUST

**As** a participant
**I want** a capable in-browser editor
**So that** I can work productively without local tools

**Acceptance criteria**

- GIVEN the editor, THEN it offers syntax highlighting for every supported language
- GIVEN the editor, THEN it supports indentation, bracket matching, undo/redo and find
- GIVEN the editor, THEN standard keyboard shortcuts work inside the kiosk
- GIVEN a language selector, THEN it is populated from the server's language list so the two cannot drift

### US-F5-02 · Submit · MUST

**As** a participant
**I want** to submit my solution and see it being judged
**So that** I know my work was received

**Acceptance criteria**

- GIVEN a submission, THEN progress is shown — queued, then running with testcase progress
- GIVEN a judgement in flight, THEN the submit control is disabled with the reason shown
- GIVEN a completed judgement, THEN a 3 s cooldown is shown counting down before resubmission is possible
- GIVEN a rejected submission, THEN the reason is shown and my code is never lost

### US-F5-03 · Never lose my code · MUST

**As** a participant
**I want** my editor content to survive a refresh or a machine swap
**So that** a crash does not destroy my work

**Acceptance criteria**

- GIVEN editor content, THEN it is persisted automatically as I work
- GIVEN a page refresh, THEN my code is restored
- GIVEN a sign-in on another machine, THEN my most recent draft is available
- GIVEN a persistence failure, THEN I am warned rather than silently losing work

### US-F5-04 · See my history · SHOULD

**As** a participant
**I want** my previous submissions for a question
**So that** I can compare attempts and go back

**Acceptance criteria**

- GIVEN a question I own, THEN my submissions are listed with verdict, language and time
- GIVEN a past submission, THEN its source can be viewed and restored into the editor

---

## Epic F6 — Verdicts

### US-F6-01 · Understand my verdict · MUST

**As** a participant
**I want** a verdict I can act on
**So that** I know whether the problem is my logic, my speed, or my format

**Acceptance criteria**

- GIVEN an accepted submission, THEN it is unambiguous that the question is solved, and that it stays solved whatever is submitted afterwards
- GIVEN a solved question, THEN the recorded solve time is shown and does not change on resubmission
- GIVEN a failure, THEN the verdict and the failing testcase **number** are shown
- GIVEN a failing sample testcase, THEN this is highlighted as a likely format misunderstanding
- GIVEN a compile error, THEN the compiler output is shown — it concerns my own code
- GIVEN `TLE`, `MLE` or `RE`, THEN each is explained plainly rather than as a bare code
- GIVEN an internal error, THEN I am told the judge failed and that it is not counted against me

### US-F6-02 · Answers are never leaked · MUST

**As** an administrator
**I want** the client incapable of showing expected output for free
**So that** hidden testcases stay hidden and hints cannot be short-circuited

**Acceptance criteria**

- GIVEN any verdict view, THEN no hidden testcase's expected output ever appears
- GIVEN network responses inspected in the browser, THEN they contain no hidden testcase data at all

---

## Epic F7 — Buying help

### US-F7-01 · Buy a hint · MUST

**As** a participant
**I want** to see available hints and their prices, and buy one
**So that** I can get unstuck

**Acceptance criteria**

- GIVEN a question I own, THEN a single "Buy hint" action reveals the next hint, with its price shown beforehand
- GIVEN hints, THEN they unlock in order, so the interface never offers a later hint before an earlier one
- GIVEN a purchase, THEN confirmation is required with the price stated, since purchases are final
- GIVEN insufficient balance, THEN the control is disabled with the reason shown
- GIVEN a purchased hint, THEN it stays visible for the rest of the contest

### US-F7-02 · Buy a hint while I am working · MUST

**As** a participant stuck mid-round
**I want** to buy a hint without waiting for the next auction
**So that** being stuck is a decision about money rather than dead time

**Acceptance criteria**

- GIVEN a question I own, THEN its hints are purchasable during a coding round, not only during an auction
- GIVEN a purchase, THEN the hint appears immediately and my balance updates
- GIVEN hidden testcases, THEN no purchase of any kind reveals them, and the interface never implies otherwise

---

## Epic F8 — Standings

### US-F8-01 · See the leaderboard · SHOULD

**As** a participant
**I want** to see standings
**So that** I know where I stand

**Acceptance criteria**

- GIVEN the leaderboard, THEN scores and ranks are shown
- GIVEN another participant, THEN their question content, hints and code are never revealed
- GIVEN a frozen or hidden leaderboard, THEN this is stated rather than shown as empty
- GIVEN leaderboard visibility is an administrator setting, THEN the current mode is evident to participants

---

## Epic F9 — Administrator dashboard

### US-F9-00 · Override anything, with a reason · MUST

**As** an administrator
**I want** to reach every parameter and override every automated outcome
**So that** no rule can trap the contest in a bad state

**Acceptance criteria**

- GIVEN any contest parameter — balances, prices, increment, scores, timers, ownership cap, hint prices — THEN it is editable from the dashboard
- GIVEN any outcome, THEN it can be overridden: adjust a balance, reverse a purchase, correct ownership, close bidding, disable a timer, force a phase change, rejudge, void, refund, correct standings
- GIVEN any override, THEN a reason is required before it is applied
- GIVEN the audit log, THEN every override is visible with actor, time and reason


### US-F9-01 · Manage problems · MUST

**As** an administrator
**I want** to see and manage all problems in one place
**So that** I can confirm the set is ready

**Acceptance criteria**

- GIVEN the problem list, THEN each shows testcase count, size, version, validation state and last modified
- GIVEN a problem, THEN a package can be uploaded to create a new version
- GIVEN an unvalidated or failing problem, THEN it is visually distinct from a ready one

### US-F9-02 · Validate a problem · MUST

**As** an administrator
**I want** a validate action with a readable report
**So that** I find broken testcases before the contest

**Acceptance criteria**

- GIVEN a validate action, THEN progress is shown and the report identifies the specific failing testcase
- GIVEN a reference solution failure at testcase 61, THEN 61 is named so the answer file can be fixed
- GIVEN validation passes, THEN the problem is marked ready

### US-F9-03 · Edit mid-contest with the consequences shown · MUST

**As** an administrator
**I want** to be told the blast radius before publishing a mid-contest change
**So that** I never rejudge blindly

**Acceptance criteria**

- GIVEN a publish during a contest, THEN the number of submissions to be rejudged is stated and confirmation required
- GIVEN a rejudge running, THEN its progress is visible
- GIVEN a verdict changed by a rejudge, THEN the affected participant is identified

### US-F9-04 · Drive the contest · MUST

**As** an administrator
**I want** to control phases and time
**So that** the contest runs to plan

**Acceptance criteria**

- GIVEN the current phase, THEN the next phase can be started with confirmation
- GIVEN a running round, THEN it can be extended and all clients update
- GIVEN an announcement, THEN it can be broadcast to all participants

### US-F9-05 · Monitor health · MUST

**As** an administrator
**I want** judge health and submission backlog visible
**So that** I see trouble before participants report it

**Acceptance criteria**

- GIVEN a degraded or unreachable judge, THEN it is shown prominently rather than buried
- GIVEN pending, retrying or failed submissions, THEN their counts are visible
- GIVEN an internal-error verdict, THEN it is surfaced for investigation

### US-F9-06 · Resolve a dispute · SHOULD

**As** an administrator
**I want** to inspect any submission with full jury detail
**So that** I can answer "my code works" credibly

**Acceptance criteria**

- GIVEN any submission, THEN its source, verdict, failing testcase, `problem_version` and jury detail are all visible to an administrator
- GIVEN a question, THEN it can be voided and its owner refunded, with a reason recorded

---

## Epic F10 — Running in the exam hall

### US-F10-01 · Work in a kiosk session · MUST

**As** an administrator
**I want** the client usable as the only application on screen
**So that** the locked-down machines work as intended

**Acceptance criteria**

- GIVEN a fullscreen kiosk browser with no address bar, THEN every function is reachable without one
- GIVEN no external network access, THEN the client loads no third-party resources — fonts, scripts and styles are all served locally
- GIVEN the screen sizes in the hall, THEN the layout is usable without horizontal scrolling

### US-F10-02 · Fail visibly, not silently · MUST

**As** a participant
**I want** to know when the client has lost the server
**So that** I raise my hand instead of typing into a void

**Acceptance criteria**

- GIVEN a lost connection, THEN a clear persistent indicator is shown
- GIVEN a failed submission, THEN it is reported as failed and never appears to have succeeded
- GIVEN reconnection, THEN state is reconciled from the server and any correction is visible

### US-F10-03 · Report focus loss · COULD

**As** an administrator
**I want** the client to report when it loses focus
**So that** there is a backstop if a kiosk setting is wrong on one machine

**Acceptance criteria**

- GIVEN the window losing focus or visibility, THEN an event is reported to the backend with a timestamp
- GIVEN such events, THEN they are advisory only and never automatically penalise a participant

---

## Non-functional requirements

| ID | Requirement | Verification |
|---|---|---|
| NFR-F-01 | Auction updates visible within 1 s of the server accepting a bid | latency test |
| NFR-F-02 | Editor remains responsive with files of at least 1,000 lines | performance test |
| NFR-F-03 | No client-side decision affects eligibility, balance or score | security review |
| NFR-F-04 | No hidden testcase content or jury detail ever reaches the browser | contract test |
| NFR-F-05 | Loads and runs with no internet access beyond the contest server | kiosk test |
| NFR-F-06 | Editor drafts survive refresh and machine swap | failover test |
| NFR-F-07 | Countdown derives from the server clock | timing test |
| NFR-F-08 | Usable at the hall's screen resolution without horizontal scroll | device test |

## Assumptions

1. Participants use organiser-controlled machines in a kiosk browser.
2. Local editors and compilers are unavailable by design.
3. The contest server is on the hall network only, with no internet exposure, so a
   phone on mobile data cannot reach it.
4. One proctor supervises; software checks are a backstop, not the control.

## Open items

- Which languages get full editor language support beyond syntax highlighting
- Visual design and branding

## Settled defaults

- Editor: **Monaco** — VS Code's editor, familiar to students, strong C++ and Python support
- Auction model: continuous bidding with a countdown that restarts on every bid
- Leaderboard: administrator setting (live / frozen / hidden)
