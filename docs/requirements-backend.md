# Backend — Requirements

**Component:** contest backend (+ PostgreSQL, Redis)
**Status:** requirements agreed, not implemented
**Related:** [requirements-judge.md](requirements-judge.md) · [requirements-frontend.md](requirements-frontend.md)

---

## Scope

The backend owns everything that makes this contest what it is: the auction, virtual
money, **exclusive question ownership**, hints, scoring, and the tiebreak. It calls
the judge for verdicts and treats it as a black box.

**This is where the project's originality lives.** No existing contest system models
per-participant question ownership, which is precisely why the judge is a separate,
dumb service rather than an off-the-shelf platform.

### Out of scope

- Executing or judging code (the judge does this)
- Rendering the UI (the frontend does this)

### Personas

| | |
|---|---|
| **Participant** | registers, bids, owns questions, submits solutions, buys hints |
| **Administrator** | manages problems, controls contest phases, rejudges, resolves disputes |

### The load-bearing rule

> **Each question is owned by exactly one participant.**

Almost every requirement below follows from this. A rejudge harms only one person.
Nobody competes on the same question. Difficulty must be calibrated *across*
questions, since two people pay comparable amounts for different Hard problems.

### Priority scale

`MUST` · `SHOULD` · `COULD`

---

## Epic B1 — Accounts and access

### US-B1-01 · Participant self-registration · MUST

**As** a participant arriving in the hall
**I want** to register myself at my machine
**So that** I have an identity and a starting balance

**Acceptance criteria**

- GIVEN registration is open, WHEN a participant registers, THEN an account is created with the configured starting balance
- GIVEN every registered participant, THEN all start with an **identical** balance
- GIVEN a duplicate display name, THEN registration is rejected with a clear message
- GIVEN competitors, THEN they are **individuals** — one person, one account, one seat
- GIVEN an administrator, THEN they can **close registration**, and the first auction cannot open until it is closed — the roster must be final because starting balances are equal
- GIVEN twenty people registering at once, THEN an administrator can rename, reset the password of, or remove an account live
- GIVEN registration, THEN preferred programming language is captured so unsupported languages are discovered early
- GIVEN all virtual money, THEN it is an **integer** — no fractional coins, so refunds and adjustments are exact

### US-B1-02 · Administrator login · MUST

**As** an administrator
**I want** to sign in directly without registering
**So that** I can run the contest

**Acceptance criteria**

- GIVEN admin credentials, WHEN used, THEN an admin session is created
- GIVEN a participant session, THEN no admin route is reachable
- GIVEN any admin action, THEN it is recorded in an audit log with actor and timestamp

### US-B1-03 · Session survives a machine swap · MUST

**As** a participant whose machine failed mid-contest
**I want** to log in on a spare machine and continue
**So that** a hardware fault does not end my contest

**Acceptance criteria**

- GIVEN a participant logs in on a different machine, THEN balance, ownership, hints and submissions are intact
- GIVEN all participant state, THEN it is held server-side, never only in the browser
- GIVEN a participant signs in somewhere new, THEN their previous session is invalidated — **one active session per account**, which both closes the concurrent-submission loophole and makes machine recovery self-service

---

## Epic B2 — Contest phases

### US-B2-01 · Drive the contest through its phases · MUST

**As** an administrator
**I want** to move the contest between phases
**So that** auctions and coding rounds happen in order

**Acceptance criteria**

- GIVEN the contest, THEN it progresses: `registration → auction 1 → coding 1 → auction 2 → final round → ended`
- GIVEN a phase change, THEN every connected client reflects it without needing a refresh
- GIVEN a phase, THEN bidding is accepted only during an auction; **submitting and buying hints are permitted in every phase**
- GIVEN the first coding round, THEN it lasts 1 h 30 m by default and is configurable

### US-B2-02 · Authoritative clock · MUST

**As** a participant
**I want** the remaining time to come from the server
**So that** nobody gains from a wrong local clock

**Acceptance criteria**

- GIVEN any timing decision, THEN the server's clock decides
- GIVEN a submission arriving after a round closes, THEN it is rejected

### US-B2-03 · Extend a round · SHOULD

**As** an administrator
**I want** to extend the current round
**So that** an infrastructure failure does not cost participants their time

**Acceptance criteria**

- GIVEN an extension, THEN all clients see the new deadline immediately
- GIVEN an extension, THEN it is audit-logged with a reason

---

## Epic B3 — The auction

### US-B3-01 · Bid on a question · MUST

**As** a participant
**I want** to bid on a question
**So that** I can acquire the right to attempt it

**Acceptance criteria**

- GIVEN the auction, THEN questions are offered **one at a time, in sequence** — never several concurrently, so a participant's whole balance is always available for the question in front of them and no funds-reservation logic is required
- GIVEN the running order, THEN it is configured by an administrator and visible to participants **before** bidding begins
- GIVEN a question at auction, THEN bidding opens at its configured base price
- GIVEN a question at auction, THEN its difficulty and score are shown but its statement is not
- GIVEN a bid, THEN it must exceed the current highest by exactly the configured increment X
- GIVEN a bid exceeding my available balance, THEN it is rejected and my balance is unchanged
- GIVEN a bid, THEN it is validated **server-side**; a manipulated client cannot bid illegally
- GIVEN two bids arriving together, THEN exactly one is accepted and ordering is deterministic

### US-B3-02 · Live auction state · MUST

**As** a participant
**I want** to see the current highest bid as it changes
**So that** I can bid meaningfully

**Acceptance criteria**

- GIVEN a bid is accepted, THEN every participant sees the new highest within 1 s
- GIVEN concurrent bidding, THEN all participants see a consistent ordering

### US-B3-03 · Award a question · MUST

**As** an administrator
**I want** the highest bidder to receive the question when bidding closes
**So that** ownership and balances are settled

**Acceptance criteria**

- GIVEN a question opens, THEN it sits at its base price for a configurable **opening window**; if no bid arrives within it, the question is declared unsold and the auction advances automatically
- GIVEN the first bid, THEN a configurable countdown starts
- GIVEN any higher bid, THEN the countdown **restarts** — so a last-second bid cannot win by timing alone
- GIVEN the countdown expires with no new bid, THEN the question is sold
- GIVEN an administrator, THEN they may close bidding manually at any time, and may disable the countdown entirely for manual-only operation
- GIVEN bidding closes with at least one bid, THEN the highest bidder becomes **sole owner**
- GIVEN a question is awarded, THEN exactly the winning bid is deducted from that participant
- GIVEN a question is awarded, THEN no other participant may ever acquire or attempt it
- GIVEN bidding closes with no bids, THEN the question remains unsold and is re-offered in the second auction **at the same base price**
- GIVEN an awarded question, THEN the outcome is final and not reversible by a participant

### US-B3-04 · Second auction · MUST

**As** a participant
**I want** to spend remaining money on more questions or on hints
**So that** unspent balance stays useful

**Acceptance criteria**

- GIVEN the second auction, THEN unsold questions may be bid on under the same rules
- GIVEN the second auction, THEN hints for **owned** questions may be purchased
- GIVEN a hint purchase, THEN it applies only to a question I already own

### US-B3-05 · Money and questions are non-transferable · MUST

**As** an administrator
**I want** no transfers between participants
**So that** collusion cannot redistribute advantage

**Acceptance criteria**

- GIVEN any participant, THEN no API path transfers balance, questions or hints to another
- GIVEN a balance, THEN it changes only through winning a bid or buying a hint

---

## Epic B4 — Ownership and balance

### US-B4-01 · Only owners may attempt · MUST

**As** an administrator
**I want** submissions accepted only from the question's owner
**So that** the ownership rule is actually enforced

**Acceptance criteria**

- GIVEN a submission for a question I do not own, THEN it is rejected and never reaches the judge
- GIVEN the enforcement, THEN it is server-side; hiding the UI is not sufficient
- GIVEN a question I do not own, THEN its statement and testcases are not readable by me
- GIVEN no configured cap, THEN a participant may own any number of questions — balance is the only limit
- GIVEN an administrator has configured an ownership cap, THEN bids that would exceed it are rejected with a clear reason

### US-B4-03 · A participant may end up owning nothing · MUST

**As** an administrator
**I want** the case of a participant winning no questions handled openly
**So that** it is a known outcome with a remedy, not a surprise on the day

**Acceptance criteria**

- GIVEN a participant who loses every auction, THEN owning nothing is a **legitimate
  outcome of bidding** and the contest rules say so in advance
- GIVEN such a participant, THEN the administrator dashboard identifies them clearly —
  they have money, no question, and nothing to do
- GIVEN such a participant, THEN an administrator may **assign ownership of an unsold
  question** to them directly, at a price the administrator sets, with a recorded reason
- GIVEN an ownership cap, THEN setting one is the administrator's lever for preventing
  this before it happens, rather than repairing it afterwards
- GIVEN any such assignment, THEN it is audit-logged and the participant is notified

### US-B4-02 · Accurate balance at all times · MUST

**As** a participant
**I want** my balance to always reflect my purchases
**So that** I can bid with confidence

**Acceptance criteria**

- GIVEN any purchase, THEN balance is debited atomically with the award
- GIVEN concurrent operations, THEN balance can never go negative
- GIVEN my account, THEN a ledger of every debit is available to me and to admins

---

## Epic B5 — Submissions

### US-B5-01 · Submit a solution · MUST

**As** a participant
**I want** to submit code for a question I own
**So that** it can be judged

**Acceptance criteria**

- GIVEN a submission, THEN the source, language, question, participant and **server-side timestamp** are persisted before the judge is called
- GIVEN a submission, THEN the judge's `problem_version` is recorded with it
- GIVEN a language not offered, THEN the submission is rejected
- GIVEN a question already accepted, THEN further submissions are still permitted; the question stays solved and the recorded solve time is unchanged
- GIVEN any phase, THEN submissions are accepted — including during an auction. Phases govern when bidding happens, not when work is allowed

### US-B5-02 · Store every submission permanently · MUST

**As** an administrator
**I want** every submission's source retained
**So that** rejudging is simply replaying them

**Acceptance criteria**

- GIVEN any submission, THEN its source is retained for the contest's lifetime
- GIVEN a rejudge, THEN it requires no participant involvement

### US-B5-03 · One submission in flight, then a short cooldown · MUST

**As** an administrator
**I want** submissions bounded without adding a scoring penalty
**So that** load is controlled while the no-penalty rule stands

**Acceptance criteria**

- GIVEN a participant with a judgement in progress, THEN a further submission is rejected with a clear reason
- GIVEN the limit, THEN it is enforced **per participant account, server-side** — a second browser window or device must not grant a second concurrent submission
- GIVEN a job **ends for any reason**, completed or cancelled, THEN the 3 s cooldown starts — so cancel-and-resubmit cannot be used to bypass it
- GIVEN these limits, THEN they affect only timing, never score
- GIVEN a participant resubmits, THEN any superseded in-flight job is cancelled

### US-B5-04 · Track a judgement to completion · MUST

**As** the backend
**I want** to poll the judge and record the verdict
**So that** the participant sees a result and scoring can proceed

**Acceptance criteria**

- GIVEN a submitted job, THEN it is polled until done and the verdict stored
- GIVEN the judge returns `404` for a job, THEN the submission is automatically resubmitted from stored source
- GIVEN the judge is unreachable, THEN the submission is marked pending and retried — never silently failed
- GIVEN an `IE` verdict, THEN it is **not** treated as a wrong answer and is surfaced to administrators

### US-B5-05 · Control what a participant is told · MUST

**As** an administrator
**I want** feedback limited to verdict and testcase number
**So that** answers are not given away free when hints are sold

**Acceptance criteria**

- GIVEN any verdict, THEN the participant sees the verdict and, for a failure, the failing testcase **number**
- GIVEN a judgement, THEN `jury_detail` is **never** exposed to a participant — it contains the expected answer
- GIVEN a compile error, THEN the compiler output is shown, since it concerns their own code
- GIVEN hidden testcase content, THEN it is **never** exposed to a participant, for free or for payment — otherwise a participant could submit deliberately bad code, buy each revealed failing testcase in turn, and hardcode answers instead of solving
- GIVEN sample testcases, THEN they are always visible

---

## Epic B6 — Hints

### US-B6-01 · Buy a text hint · MUST

**As** a participant stuck on a question I own
**I want** to buy an author-written hint
**So that** money is useful even before I have working code

**Acceptance criteria**

- GIVEN a question I own with hints defined, THEN a single "Buy hint" action reveals the **next** hint in the author's order, with its price shown beforehand
- GIVEN hints, THEN they unlock sequentially — the second cannot be bought before the first
- GIVEN a purchase, THEN the hint is revealed and the price debited atomically
- GIVEN a hint already bought, THEN it stays visible and is never charged twice
- GIVEN a question I do not own, THEN its hints cannot be bought

### US-B6-02 · Hints are available whenever you own the question · MUST

**As** a participant stuck during a coding round
**I want** to buy a hint immediately rather than waiting for the second auction
**So that** I am not left with money I cannot use and nothing to do

**Acceptance criteria**

- GIVEN a question I own, THEN its hints are purchasable in **any** phase, including during a coding round
- GIVEN the second auction, THEN it remains the place to buy additional *questions*
- GIVEN hidden testcases, THEN they are **never** purchasable at any price — see US-B5-05

### US-B6-03 · Hint purchases are final · MUST

**As** an administrator
**I want** confirmed purchases to be irreversible
**So that** the rules are applied consistently

**Acceptance criteria**

- GIVEN a confirmed purchase, THEN it cannot be undone by the participant
- GIVEN a purchase, THEN it is audit-logged with participant, item and price

---

## Epic B7 — Scoring

### US-B7-01 · Score by question difficulty · MUST

**As** an administrator
**I want** each solved question to contribute its configured score
**So that** harder questions are worth more

**Acceptance criteria**

- GIVEN a question accepted by its owner, THEN its full score is added — solving is binary, with no partial credit
- GIVEN a question never accepted, THEN it contributes nothing
- GIVEN spent or remaining virtual money, THEN it does not affect score

### US-B7-02 · Break ties by total solve time · MUST

**As** an administrator
**I want** equal scores broken by total solve time
**So that** rankings are decisive and reward speed

**Acceptance criteria**

- GIVEN equal scores, THEN the participant with the **lower sum of solve times** ranks higher
- GIVEN a solved question, THEN its solve time is measured from **when the participant won it at auction** to their **first** accepted submission for it — so acquiring a question late in the contest carries no tiebreak penalty
- GIVEN wrong submissions, THEN they contribute nothing to solve time; there is no penalty component
- GIVEN a question already accepted, THEN a later wrong submission never un-solves it
- GIVEN further accepted submissions, THEN the recorded solve time remains that of the **first** accepted submission — always, including after a rejudge invalidated it and the participant re-solved
- GIVEN a rejudge changes a verdict, THEN standings and totals are recomputed from stored submissions
- GIVEN participants tied on both score and total solve time, THEN the better **Phase 1
  rank** ranks higher — Phase 1 contributes no points, but it separates an exact tie so
  a prize does not rest on joint first place
- GIVEN participants tied on score, solve time **and** Phase 1 rank, THEN they share a
  rank, and an administrator may break it explicitly with a recorded reason

### US-B7-03 · Leaderboard · SHOULD

**As** a participant
**I want** to see standings
**So that** I can gauge my position

**Acceptance criteria**

- GIVEN the leaderboard, THEN it shows score, and rank by the tiebreak rule
- GIVEN the leaderboard, THEN it never reveals another participant's question content or hints
- GIVEN administrators, THEN they can freeze or hide the leaderboard

---

## Epic B8 — Problem administration

### US-B8-01 · Upload a problem · MUST

**As** an administrator
**I want** to upload a problem package from the admin page
**So that** problems can be managed without shell access

**Acceptance criteria**

- GIVEN a problem package, THEN it is extracted to a new **version**, never over the live one
- GIVEN an upload, THEN it is validated before it can be published
- GIVEN validation failure, THEN the reason is shown and the live version is untouched
- GIVEN a successful publish, THEN it becomes live **atomically** — judging never sees a half-written problem

### US-B8-02 · Validate before the contest · MUST

**As** an administrator
**I want** to validate every problem
**So that** no question is auctioned with broken data behind it

**Acceptance criteria**

- GIVEN a problem, THEN validation reports structural issues, checker status, and the reference solution's result across all testcases
- GIVEN the problem list, THEN each problem's validation state is visible at a glance
- GIVEN an unvalidated problem, THEN publishing it warns the administrator

### US-B8-03 · Confirm the set before auctioning · MUST

**As** an administrator
**I want** every question confirmed to exist before the auction opens
**So that** nobody pays for a question with no testcases

**Acceptance criteria**

- GIVEN the auction is about to open, THEN each question is confirmed present with testcases
- GIVEN any missing or unvalidated question, THEN the administrator is warned before proceeding

---

## Epic B9 — Rejudging and recovery

### US-B9-01 · Edit a problem mid-contest with full rejudge · MUST

**As** an administrator
**I want** to fix a broken problem during the contest and rerun every submission for it
**So that** a defective question can be corrected rather than abandoned

**Acceptance criteria**

- GIVEN a mid-contest edit, THEN the administrator is shown how many submissions will be rejudged before confirming
- GIVEN a publish, THEN **all** submissions for that question are automatically rejudged
- GIVEN a rejudge, THEN verdicts and standings are recomputed
- GIVEN the question has exactly one owner, THEN only that participant is affected; they retain ownership and may re-attempt
- GIVEN a rejudge, THEN the administrator may additionally choose to **refund the owner, void the question, or let the verdict stand** — the choice is presented explicitly at rejudge time, not buried
- GIVEN such a choice, THEN it is recorded with a reason, because a discretionary decision without a record is what disputes feed on
- GIVEN a rejudge, THEN superseded verdicts are retained for audit
- GIVEN a rejudge, THEN the owner is notified that their verdict changed

### US-B9-02 · Void a question · SHOULD

**As** an administrator
**I want** to void an unusable question and refund its owner
**So that** an irreparable problem does not ruin someone's contest

**Acceptance criteria**

- GIVEN a voided question, THEN it contributes no score to anyone
- GIVEN a void, THEN the owner is refunded **both the question price and any hints bought for it** by default, since money spent on an unsolvable problem bought nothing
- GIVEN the void action, THEN an administrator may override what is refunded
- GIVEN a void, THEN it is audit-logged with a reason and announced

### US-B9-03 · Announce to everyone · SHOULD

**As** an administrator
**I want** to broadcast an announcement
**So that** participants learn about problems and corrections

**Acceptance criteria**

- GIVEN an announcement, THEN every connected participant receives it promptly
- GIVEN announcements, THEN they remain readable for the rest of the contest

### US-B9-04 · Administrators can override anything · MUST

**As** an administrator
**I want** authority over every automated outcome
**So that** no rule can trap the contest in a bad state

**Acceptance criteria**

- GIVEN any contest parameter — balances, base prices, increment, scores, timers, ownership cap, hint prices — THEN an administrator can change it
- GIVEN any automated outcome, THEN an administrator can override it: adjust a balance, reverse a purchase, correct ownership, close bidding by hand, disable a timer, force a phase change, rejudge, void, refund, or correct standings
- GIVEN any override, THEN it is recorded with actor, timestamp and reason — unlimited authority without a record is what disputes feed on
- GIVEN an override affecting a participant, THEN that participant is notified

---

## Epic B10 — Operations

### US-B10-01 · Monitor contest health · MUST

**As** an administrator
**I want** to see judge health and submission backlog
**So that** I can act before participants report a problem

**Acceptance criteria**

- GIVEN the judge is unreachable or degraded, THEN the admin dashboard shows it prominently
- GIVEN pending or retrying submissions, THEN their count is visible
- GIVEN judging failures, THEN they are logged with enough context to diagnose

### US-B10-02 · Survive a judge restart · MUST

**As** an administrator
**I want** the contest to continue through a judge restart
**So that** the judge can be redeployed if necessary

**Acceptance criteria**

- GIVEN a judge restart, THEN in-flight submissions are automatically resubmitted
- GIVEN a restart, THEN no submission is lost and no participant must resubmit manually

### US-B10-04 · Back up contest state · MUST

**As** an administrator
**I want** contest state backed up automatically during the contest
**So that** a server failure does not end the contest with nothing to recover

**Acceptance criteria**

- GIVEN the contest running, THEN the database is dumped automatically at a
  configurable interval, by default every 5 minutes
- GIVEN a dump, THEN it is written to storage **separate from the database's own disk**
- GIVEN the backups, THEN the most recent few are retained and older ones removed
- GIVEN a backup, THEN restoring it has been **tested before the contest** — an
  untested backup is not a backup
- GIVEN a failed backup, THEN it is shown on the admin dashboard rather than failing
  silently
- GIVEN a restore, THEN what is lost is bounded by the backup interval, and the
  administrator can see the timestamp of the state they recovered

> Every other recovery story here covers a *client* failing. This is the only one that
> covers the *server* failing, and without it a disk fault ends the contest outright.

### US-B10-05 · Survive losing the judge entirely · SHOULD

**As** an administrator
**I want** a second judge available
**So that** judging continues if one fails rather than halting the contest

**Acceptance criteria**

- GIVEN the judge is stateless, THEN more than one instance may run and the backend may
  use any of them
- GIVEN one judge becoming unreachable, THEN submissions are routed to another and
  none are lost
- GIVEN all judges unreachable, THEN submissions queue and retry, and the dashboard
  says so prominently
- GIVEN a spare, THEN it shares the read-only problems volume so both judge identically

### US-B10-03 · Export results · SHOULD

**As** an administrator
**I want** to export final standings and submission history
**So that** results can be published and the project documented

**Acceptance criteria**

- GIVEN the contest has ended, THEN standings, submissions, purchases and the audit log can be exported

---

## Non-functional requirements

| ID | Requirement | Verification |
|---|---|---|
| NFR-B-01 | Supports 20 concurrent participants with no degradation | load test |
| NFR-B-02 | Accepted bids visible to all participants within 1 s | latency test |
| NFR-B-03 | Balance never negative under concurrent bidding | concurrency test |
| NFR-B-04 | Question ownership is exclusive and enforced server-side | security test |
| NFR-B-05 | `jury_detail` is never present in any participant-facing response | contract test |
| NFR-B-06 | All contest state is durable; no participant state lives only in the browser | failover test |
| NFR-B-07 | Every balance change and admin action is audit-logged | audit review |
| NFR-B-08 | Server clock is authoritative for all timing | timing test |
| NFR-B-09 | Judge unavailability degrades gracefully, never loses submissions | chaos test |
| NFR-B-10 | Auction state — current question, highest bid, countdown — survives a backend restart | failover test |
| NFR-B-11 | Submissions retained for the whole contest and exportable afterwards | export test |
| NFR-B-12 | All virtual money is integer; no operation can produce a fractional balance | unit test |
| NFR-B-13 | Contest state is recoverable to within the backup interval after total server loss | restore drill |

## Assumptions

1. The judge is reachable over a trusted internal network.
2. Participants are in a proctored exam hall on controlled machines.
3. Problems are authored and validated before the contest.
4. 20 participants, 25 questions, one owner per question — so roughly 1.25 questions
   per participant, and the second auction is mostly a hint round with few leftovers.
5. The contest server is on the hall network only, with no internet exposure.
6. Leaderboard visibility (live / frozen / hidden) is an administrator setting,
   announced before the first auction since it changes bidding strategy.

## Open items

- Starting balance, base prices, bid increment X, hint prices, difficulty scores — the structure is fixed; the values will be set once the problem set exists and has been ranked by difficulty
- **Ordering dependency:** these values cannot be fixed until the number of participants advancing from Phase 1 is known. 25 questions among 20 people is a fundamentally different auction from 25 among 8 — base prices and starting balance follow from that ratio
- Default ownership cap, which is the lever against a participant owning nothing (US-B4-03)
- Bid countdown duration and opening-window duration
- Final round duration
- Auction running order (a per-contest configuration, decided before the auction)
