# Low-Level Design — Backend and Frontend

**Status:** design agreed, not implemented
**Related:** [requirements-backend.md](requirements-backend.md) · [requirements-frontend.md](requirements-frontend.md) · [decisions.md](decisions.md)

This document is the step between the requirements and the code. It answers *how*,
where the requirements answer *what*. Anything marked **OPEN** needs a decision
before that part is built.

---

## 1. What owns what

```
┌─────────────────────────────────┐          ┌───────────┐
│         Next.js  (one app)      │   HTTP   │ judge-api │
│  browser UI  +  route handlers  │─────────▶│           │
└────────────────┬────────────────┘          └─────┬─────┘
                 │                                 │
            ┌────▼─────┐                    ┌──────▼──────┐
            │ Postgres │                    │  go-judge   │
            └──────────┘                    └─────────────┘
                 │                                 │
                 └───────── /problems volume ──────┘
                      Next.js writes, judge reads
```

**Four services, not six.** Frontend and backend are one Next.js deployable, and
Redis is gone — sessions live in Postgres via Better Auth, the submission queue is a
database poller, and SSE fanout is in-process. This amends decision 5, and removes
two containers that could fail on contest day.

The judge knows nothing about auctions, money, ownership, hints or scoring. It is
already built and tested; **nothing in this document changes it.**

| Concern | Owner |
|---|---|
| Testcases, limits, verdicts, `problem_version` | judge |
| Statement, samples, hints, difficulty, base price, score | backend |
| Balance, ownership, bids, standings | backend |
| Rendering only — decides nothing | frontend |

---

## 2. Three gaps found while reading the requirements

These are not design preferences. They are places where the requirements as written
cannot be implemented without a decision.

### 2.1 The judge has no concept of a sample testcase

US-F4-02 (MUST) requires sample input and output shown free and *clearly
distinguished* from hidden testcases. US-F6-01 requires a failing **sample** to be
highlighted as a likely format misunderstanding.

The judge's `problem.json` has no `samples` field. It cannot acquire one without
teaching the judge a contest concept, which breaks the boundary that makes it
open-sourceable.

**Decided:** samples are the **first K testcases** of the package. The administrator
types **K** when setting up the question; the sample **text is read from the package's
first K testcase files**, never retyped. `problem.json` stays untouched, the judge
never learns the word "sample", and a displayed sample cannot drift out of step with
what is actually judged. A judgement with `first_fail < sample_count` is a sample
failure (US-F6-01).

### 2.2 Problem upload requires a shared filesystem

US-B8-01 (MUST) requires an administrator to upload a package from the admin page,
extracted to a new version and published atomically. The judge exposes **no upload
endpoint** — `openapi.yaml` is read-only over problems — yet
`requirements-judge.md` assumption 4 states *"nothing assumes a shared filesystem
with the backend"*.

Both cannot hold. Adding an upload API to the judge would put contest-authoring
concerns inside it.

**Decided:** one Docker volume, **Next.js read-write, judge read-only**. The app
writes `problems/<id>/v4/`, validates it through the judge, then swaps the `current`
symlink. That is the atomic publish the judge already supports and tests.
Assumption 4 in `requirements-judge.md` is amended: the judge needs only *read*
access to the problem set and never writes to it.

### 2.3 Solve time after a rejudge is self-contradictory

US-B7-02 says the recorded solve time is that of the **first** accepted submission
"always, including after a rejudge invalidated it and the participant re-solved",
and *also* that "standings and totals are recomputed from stored submissions".

If the first AC is invalidated, its timestamp cannot both survive and be recomputed.

**Design:** solve time is **derived, never stored**:

```sql
solve_time = MIN(submission.created_at WHERE current verdict = 'AC') - ownership.awarded_at
```

Later ACs never move it, because `MIN` ignores them — that is "first AC only counts".
After a rejudge it recomputes naturally, because the set of AC submissions changed.
No mutable `first_ac_at` column exists to go stale. **Confirmed 2026-09-12** — this
is the rule; `requirements-backend.md` US-B7-02 should be reworded to match.

---

## 3. Data model

All money is a plain `integer` — no cents, no decimals anywhere (NFR-B-12).

```sql
-- Identity is owned by Better Auth: user, session, account, verification.
-- Contest state hangs off it rather than living inside it, so auction money
-- never sits in a table the auth library migrates.

-- Three roles: participant, evaluator, administrator. The role lives on the
-- Better Auth user; `participant` exists only for those who compete.

participant
  user_id          text pk → user(id)
  balance          integer not null check (balance >= 0)   -- NFR-B-03
  preferred_language text
  registered_at    timestamptz not null

contest                       -- exactly one row
  id               int pk default 1 check (id = 1)
  phase            text not null    -- registration|auction1|coding1|auction2|final|ended
  phase_ends_at    timestamptz
  registration_open boolean not null
  leaderboard_mode text not null    -- live|frozen|hidden
  leaderboard_frozen_at timestamptz
  starting_balance integer not null
  bid_increment    integer not null
  countdown_seconds int not null
  opening_window_seconds int not null
  ownership_cap    int                -- null = uncapped (US-B4-01)

question
  id               text pk           -- matches the judge's problem_id
  title            text not null
  difficulty       text not null     -- easy|medium|hard
  score            integer not null
  base_price       integer not null
  statement_md     text not null
  sample_count     int not null default 0
  auction_order    int not null      -- published in advance (decision 53i)
  status           text not null     -- unsold|sold|void
  problem_version  text              -- current published version
  validated        boolean not null default false

sample                          -- shown free (US-F4-02)
  question_id      text → question
  idx              int
  input            text
  output           text
  primary key (question_id, idx)

hint                            -- author-written text only (decision 49)
  question_id      text → question
  idx              int           -- unlocks in order
  price            integer not null
  body_md          text not null
  primary key (question_id, idx)

-- === auction ==============================================================

lot                             -- one question offered once
  id               bigserial pk
  question_id      text → question
  round            int not null      -- 1 or 2
  state            text not null     -- pending|open|closed|unsold
  opened_at        timestamptz
  no_bid_deadline  timestamptz       -- opening window; null once first bid lands
  bidding_ends_at  timestamptz       -- restarts on every bid
  current_bid      integer
  current_bidder   text → participant
  unique (question_id, round)

bid
  id               bigserial pk
  lot_id           bigint → lot
  participant_id   text → participant
  amount           integer not null
  created_at       timestamptz not null default now()

ownership                       -- exactly one row per sold question
  question_id      text pk → question     -- PK enforces sole ownership (US-B3-03)
  participant_id   text → participant
  price_paid       integer not null
  awarded_at       timestamptz not null   -- solve time is measured from here
  voided_at        timestamptz

hint_purchase
  question_id      text
  hint_idx         int
  participant_id   text → participant
  price_paid       integer not null
  purchased_at     timestamptz not null
  primary key (question_id, hint_idx, participant_id)

ledger                          -- every balance change (US-B4-02)
  id               bigserial pk
  participant_id   text → participant
  delta            integer not null       -- negative debit, positive refund
  balance_after    integer not null
  reason           text not null          -- bid_won|hint|refund|admin_adjust
  ref              text
  created_at       timestamptz not null

-- === submissions ==========================================================

submission
  id               bigserial pk
  participant_id   text → participant
  question_id      text → question
  language         text not null
  source           text not null          -- retained for the contest (US-B5-02)
  created_at       timestamptz not null   -- server clock, always (US-B2-02)

judgement                       -- many per submission; history is kept
  id               bigserial pk
  submission_id    bigint → submission
  state            text not null   -- pending|queued|running|done|failed
  job_id           text
  verdict          text            -- AC|WA|TLE|MLE|OLE|RE|CE|IE
  passed           int
  total            int
  first_fail       int
  max_time_ms      numeric
  compile_output   text
  jury_detail      text            -- NEVER leaves the server for a participant
  problem_version  text
  attempt          int not null default 1
  superseded_at    timestamptz     -- set when a rejudge replaces it
  created_at       timestamptz not null

-- === phase 1 (logic puzzles) ============================================

p1_question                     -- Section A only
  id               bigserial pk
  title            text not null
  body_md          text not null
  category         text not null    -- pattern|detective|constraint
  kind             text not null    -- mcq_single|mcq_multi|fill_blank|numeric
                                    -- |sequence|set|long_text
  grading          text not null    -- auto|validator|manual
  points           integer not null
  explain_points   integer not null default 0   -- 0 = no explanation asked
  order_index      int not null
  published        boolean not null default false
  voided           boolean not null default false
  config           jsonb not null   -- options, accepted answers, tolerance, credit mode
  answer_key       jsonb            -- auto only. NEVER reaches a participant (NFR-P-03)
  model_answer     text             -- manual only; a grading aid, also never sent
  validator_py     text             -- validator mode only; never sent
  points_per_entry integer          -- validator mode: score = valid distinct x this
  max_entries      int              -- validator mode: cap on counted entries
  format_regex     text             -- client-side shape check; safe to send
  format_hint      text             -- "four digits, no spaces"; safe to send
  ready            boolean not null default false

p1_answer
  participant_id   text → participant
  question_id      bigint → p1_question
  answer           jsonb            -- shape follows kind
  explanation      text
  auto_score       integer          -- auto questions; null until scored
  manual_score     integer          -- manual questions; administrator-awarded
  explain_score    integer          -- administrator-awarded
  graded_by        text
  graded_at        timestamptz
  updated_at       timestamptz not null
  primary key (participant_id, question_id)

p1_hack_question                -- Section B
  id               bigserial pk
  title            text not null
  statement_md     text not null
  constraints_md   text not null
  given_source     text not null    -- SHOWN to participants; reading it is the task
  given_language   text not null
  reference_source text not null    -- NEVER served to anyone (US-J7-02)
  reference_language text not null
  validator_py     text not null    -- defines a legal test input
  time_limit_ms    integer not null
  memory_limit_mb  integer not null
  hack_points      integer not null
  fail_penalty     integer not null default 0   -- administrator-set, 0 by default
  published        boolean not null default false
  voided           boolean not null default false
  ready            boolean not null default false  -- a known breaking input was proven

p1_hack_attempt
  id               bigserial pk
  participant_id   text → participant
  question_id      bigint → p1_hack_question
  input            text not null
  state            text not null    -- pending|judging|done|failed
  valid_input      boolean          -- passed the validator
  invalid_reason   text             -- which constraint; shown to the participant
  hacked           boolean
  verdict          text             -- WA|TLE|MLE|RE — evaluators and admins only
  points_awarded   integer not null default 0
  created_at       timestamptz not null

p1_advancement
  participant_id   text pk → participant
  advanced         boolean not null
  decided_by       text not null
  decided_at       timestamptz not null
  reason           text not null

draft                           -- editor content (US-F5-03)
  participant_id   text
  question_id      text
  source           text not null
  language         text not null
  updated_at       timestamptz not null
  primary key (participant_id, question_id)

announcement
  id bigserial pk, body_md text, created_at timestamptz

audit_log                       -- US-B1-02, US-B9-04, decision 53r
  id               bigserial pk
  actor_id         text
  action           text not null
  target           text
  reason           text not null   -- required, never optional
  detail           jsonb
  created_at       timestamptz not null
```

**Why `judgement` is a separate table.** US-B9-01 requires superseded verdicts
retained for audit. Mutating a verdict in place loses that. The current verdict is
the row with `superseded_at IS NULL`; a rejudge inserts a new one and stamps the old.

**Why `ownership` uses `question_id` as the primary key.** Exclusive ownership
(US-B3-03, NFR-B-04) becomes a database constraint rather than application logic.
Two concurrent awards cannot both succeed.

---

## 4. Money: the one transaction that must be right

Everything about bidding hinges on this. NFR-B-03 says balance can never go
negative under concurrent bidding; US-B3-01 says two simultaneous bids produce
exactly one winner, deterministically.

**Balance is not debited when bidding.** It is debited only when the lot is awarded
(US-B3-03). Because lots are offered **one at a time** (US-B3-01), a participant's
whole balance is always available for the question in front of them, and no
funds-reservation logic is needed. That is a deliberate simplification the
requirements grant explicitly — do not add reservations.

### Placing a bid

```sql
BEGIN;
  -- Serialise on the lot. Every bid for this question queues here, which is
  -- what makes ordering deterministic.
  SELECT * FROM lot WHERE id = $lot FOR UPDATE;
  SELECT balance FROM participant WHERE user_id = $me FOR UPDATE;

  -- Reject, in this order, with a distinct reason for each:
  --   lot.state <> 'open'                  -> bidding_closed
  --   lot.current_bidder = $me             -> already_highest   (US-F2-02)
  --   $amount <> COALESCE(lot.current_bid, lot.base_price - increment) + increment
  --                                        -> wrong_increment
  --   $amount > balance                    -> insufficient_balance
  --   ownership_cap reached                -> ownership_cap_reached

  INSERT INTO bid (lot_id, participant_id, amount) VALUES (...);
  UPDATE lot SET current_bid = $amount,
                 current_bidder = $me,
                 no_bid_deadline = NULL,
                 bidding_ends_at = now() + (countdown_seconds || ' seconds')::interval;
COMMIT;
```

Lock order is **always lot → participant**. A consistent order is what stops
deadlock; there is no second ordering anywhere in the codebase.

### Awarding

```sql
BEGIN;
  SELECT * FROM lot WHERE id = $lot FOR UPDATE;
  SELECT balance FROM participant WHERE user_id = $winner FOR UPDATE;

  UPDATE participant SET balance = balance - $amount WHERE user_id = $winner;
  -- The CHECK (balance >= 0) is the backstop if logic above ever fails.
  INSERT INTO ownership (question_id, participant_id, price_paid, awarded_at) ...;
  INSERT INTO ledger (...) VALUES (..., -$amount, 'bid_won', ...);
  UPDATE lot SET state = 'closed';
  UPDATE question SET status = 'sold';
COMMIT;
```

### Buying a hint

Same shape: lock participant, check the previous hint index is owned, check balance,
insert `hint_purchase` + `ledger`, debit. The `hint_purchase` primary key makes
double-charging impossible (US-B6-01) even under a double-click.

---

## 5. The auction clock must survive a restart

NFR-B-10 requires the current question, highest bid and countdown to survive a
backend restart. **An in-memory `setTimeout` cannot do that.**

**Design: the deadline lives in the database; the timer is derived.**

- `lot.bidding_ends_at` and `lot.no_bid_deadline` are absolute timestamps.
- One scheduler ticks every 250 ms:

```
every 250ms:
  for each lot where state = 'open':
     if no_bid_deadline passed and no bids   -> mark unsold, advance
     if bidding_ends_at passed               -> award to current_bidder, advance
```

A restart loses nothing — the loop rereads the deadlines and carries on. A bid just
pushes `bidding_ends_at` forward, which is how "the countdown restarts on every bid"
(US-B3-03) is implemented: one column update, no timer to cancel.

Admin controls fall out of the same model: **close now** sets `bidding_ends_at =
now()`; **disable the countdown** sets it to `NULL` so only a manual close ends the
lot (US-B3-03).

**Auction 2 reuses all of this unchanged.** Unsold questions are re-offered one lot
at a time, at the same base price, with the same opening window and countdown. That
is why `lot` carries a `round` column rather than the auction being a separate
mechanism — and it keeps the "whole balance always available" reasoning true, so no
funds reservation is ever needed.

### Phase machine

```
registration → p1_puzzles → p1_hacking → review → auction1 → coding1 → auction2 → final → ended
               └─────── Phase 1 ───────┘          └─────────────── Phase 2 ──────────────┘
```

**Phase 1 has two sections**, strictly sequential, each with its own deadline:
`p1_puzzles` (MCQ and short answer) then `p1_hacking` (find a test case that breaks a
given solution). Section B is opened by an administrator rather than automatically,
leaving room for a break or a fix between the two.

**Naming.** *Phase 1* is the qualifying round
([requirements-phase1.md](requirements-phase1.md)). *Phase 2* is the auction coding
contest, and its `auction1 / coding1 / auction2 / final` steps are **rounds inside
Phase 2**, not peers of Phase 1. Older documents saying "Coding Round 1" mean Phase
2's first coding round.

`review` is where an administrator grades explanations and selects who advances
(US-P4-01). It is a real phase, not a gap: Phase 1 answering is closed, Phase 2 is
not yet open, and the selection can still be revised.

`final` is **a second coding round** — same behaviour as `coding1`, kept as its own
phase so its duration is configured separately and the end of the contest is an
unambiguous moment.

Only an administrator advances phases, always with confirmation (US-F9-04).
Registration must be closed before `auction1` (US-B1-01).

**Phases gate bidding and registration only.** Submitting and buying hints are
permitted in *every* phase (US-B2-01, US-B6-02) — a participant with money and a
question should never be idle.

---

### Phase 1 notes

**Phase 1 executes code, in two places.** An earlier draft of this document claimed it
had no dependency on the judge; that is false. Section B runs hacks, and Section A
runs validators for open-ended questions. Both need the judge, and both need the one
shape it did not previously offer — *run something in the sandbox against data supplied
in the request*, rather than against stored testcases:

| Need | Endpoint |
|---|---|
| Hack: stored solution vs. supplied input | `POST /hack` (US-J7-01) |
| Score entries against a supplied validator | `POST /validate-answers` (US-J7-03) |

Nothing else in Phase 1 executes anything.

**Nothing secret reaches the browser.** `p1_question.answer_key`, `model_answer`,
`p1_hack_question.reference_source` and `validator_py` are excluded from every
participant-facing query, exactly as `jury_detail` is in Phase 2. `given_source` is
the deliberate exception — it is meant to be read. A contract test asserts the rest.

**Format is the client's job; correctness is the validator's.** `format_regex` and
`format_hint` are sent to the browser so a malformed entry is rejected as it is typed —
and re-checked server-side, because a manipulated client must not be able to submit
past it. Whether an entry is *correct* is never revealed while the section is open:
otherwise "find as many as you can" becomes brute-force against the validator rather
than reasoning about the puzzle.

**Hack feedback is deliberately thin.** A participant learns whether their input was
valid, and if valid whether the hack succeeded. They are **not** told the verdict, or
the reference solution's output — otherwise the judge becomes an oracle for probing
the solution's behaviour rather than a check on reading it. Evaluators and
administrators see everything.

**A broken question never scores against anyone.** If the reference solution itself
fails on a supplied input, the result is `IE`: the attempt is neither a hack nor a
failure, and no penalty applies. The same holds if the judge is unreachable — the
attempt stays pending and is retried.

**Totals are a sum across both sections, so voiding is one update.**

```sql
total = SUM(COALESCE(auto_score,0) + COALESCE(manual_score,0) + COALESCE(explain_score,0))
          WHERE NOT p1_question.voided     -- auto_score covers validator mode too
      + SUM(p1_hack_attempt.points_awarded)
          WHERE NOT p1_hack_question.voided
```

Ranked by total, then by **earliest submission time** — the rulebook's tiebreak, made
concrete by the explicit *finish* action in US-P4-02.

**Advancement gates Phase 2.** Every Phase 2 route checks `p1_advancement.advanced`.
A participant who was not selected keeps their account and their Phase 1 results but
cannot bid or submit.

**One session per account applies to participants only.** Evaluators grade while
administrators run the contest, and an administrator may legitimately be signed in on
two machines. Applying the rule to every role would log them out mid-auction.

## 6. Submission pipeline

```
POST /api/submissions
  ├─ lock participant FOR UPDATE
  ├─ reject unless ownership exists and is not voided      (US-B4-01)
  ├─ reject if a judgement is in flight                    (US-B5-03)
  ├─ reject if now() - last_judgement_ended_at < 3s        (US-B5-03)
  ├─ INSERT submission  ← persisted BEFORE the judge is called (US-B5-01)
  ├─ INSERT judgement (state='pending')
  └─ COMMIT, then hand to the poller
```

A separate **poller** (one `setInterval`, no queue infrastructure) walks
`judgement WHERE state IN ('pending','queued','running')`:

| Judge response | Action |
|---|---|
| `202` | store `job_id`, state `queued` |
| `200 done` | store verdict, state `done`, stamp `last_judgement_ended_at` |
| `404` on poll | **resubmit from stored source** (US-B5-04, US-B10-02) |
| `429` | leave pending, retry with backoff |
| `503` / unreachable | leave pending, retry — never mark failed (NFR-B-09) |
| verdict `IE` | **not** a wrong answer; surface to admin (US-B5-04) |

Because every state transition is a database row, a backend restart resumes
mid-flight with nothing lost. That is why there is no in-memory queue here.

**Resubmission cancels the superseded job** (`DELETE /jobs/{id}`) and the cooldown
starts when the job *ends or is cancelled*, so cancel-and-resubmit cannot bypass it.

---

## 7. Scoring — computed, never stored

```sql
score       = SUM(question.score) for questions where the owner has a current AC
solve_time  = MIN(submission.created_at | verdict AC) - ownership.awarded_at
total_time  = SUM(solve_time) over solved questions
rank        = ORDER BY score DESC, total_time ASC, phase1_rank ASC
```

Nothing above is a stored column. A rejudge changes verdicts, and standings follow
automatically (US-B7-02) with no recompute job to forget to run. For 20
participants this is a millisecond query; materialise it only if measurement says so.

Wrong submissions contribute nothing — there is no penalty component (decision:
no-penalty submissions). Money never affects score (US-B7-01).

**Phase 1 rank is the last tiebreak.** It adds no points; it only separates
participants tied on both score and solve time, so a prize does not come down to joint
first place. Still tied after that, and an administrator decides with a recorded
reason.

**Leaderboard freeze** filters on `submission.created_at < contest.leaderboard_frozen_at`
rather than snapshotting, so unfreezing is free.

---

## 8. Rejudge, void and override

Publishing a new version mid-contest (US-B9-01):

1. Write `problems/<id>/v(n+1)/`, validate through the judge, **show the blast
   radius** — how many submissions will be rejudged — and require confirmation.
2. Swap the `current` symlink (atomic).
3. Insert a new `judgement` row per affected submission; stamp the old ones
   `superseded_at`. History is kept.
4. Standings recompute themselves (§7).
5. **Present the choice explicitly**: refund the owner, void the question, or let
   the verdict stand. A reason is required. Recorded in `audit_log`.
6. Notify the owner that their verdict changed.

Voiding (US-B9-02) refunds the question price **and every hint bought for it** by
default, because money spent on an unsolvable problem bought nothing. The admin may
override what is refunded.

**Every admin mutation requires a `reason`.** Enforce it in the shared request type,
not per-route, so a new admin endpoint cannot forget. One interceptor writes
`audit_log`.

---

## 9. Realtime: SSE, not WebSockets

Everything realtime here flows **server → client**: auction state, countdown, phase
changes, announcements, verdicts, leaderboard. Bids and submissions go over ordinary
`POST`.

Server-Sent Events fit that shape exactly, and bring automatic reconnection with
`Last-Event-ID` for free — which US-F2-03 and US-F10-02 require ("reconciles on
reconnect", "state comes from the server, never from cached local state"). A
WebSocket would mean hand-writing reconnect and heartbeat logic for a channel that
is one-directional anyway.

```
GET /api/events        text/event-stream
  event: auction   { lot, question, current_bid, bidder, bidding_ends_at, server_now }
  event: phase     { phase, phase_ends_at, server_now }
  event: verdict   { submission_id, state, progress, verdict }
  event: announce  { id, body_md }
  event: balance   { balance }
```

**Every payload carrying a deadline also carries `server_now`.** The client computes
one clock offset at connect and renders countdowns locally against it. The browser
clock is never trusted (NFR-F-07, US-B2-02).

On reconnect the client discards local state and re-reads `GET /api/state`.

---

## 10. Auth

**Better Auth**, self-hosted, with the **username** plugin (no mail server in the
hall) and the **admin** plugin. Sessions are database-backed and revocable, which is
what makes the single-session rule enforceable.

```ts
databaseHooks: {
  session: { create: { after: async (session) => {
    // One active session per account (US-B1-03, decision 53c). A second window
    // would otherwise double submission throughput on a speed-tiebreak contest.
    await db.delete(sessions).where(and(
      eq(sessions.userId, session.userId),
      ne(sessions.id, session.id),
    ));
  }}}
}
```

Better Auth does **not** provide an audit log; that is ours (§8). Balance stays out
of the auth tables — it needs `FOR UPDATE` locking the auth library knows nothing
about.

The judge keeps its own shared bearer token. It trusts the backend and authenticates
no participants; that boundary is what keeps it open-sourceable.

---

## 11. Frontend

```
app/
  (auth)/login, register
  (participant)/
    dashboard          balance, owned questions, score, phase banner
    auction            live lot, bid button, countdown, running order
    question/[id]      statement, samples, hints, editor, verdicts, history
    leaderboard
  (admin)/
    problems           list, upload, validate, publish
    contest            phases, timers, parameters, announcements
    participants       balances, ownership, overrides
    submissions        inspection with jury detail
    audit
```

**State handling.** One `useEventStream()` hook owns the SSE connection and writes
into a store; components read from it. `GET /api/state` is the single source of
truth on load and on every reconnect. No component computes eligibility, price or
score — NFR-F-03 means the client only renders what the server says.

**The bid button** offers exactly one amount: `current_bid + increment`. It is
disabled with a stated reason when the participant is already highest or cannot
afford it. A disabled button is a hint, not a control — the server re-checks
everything (US-B3-01).

**Drafts** (US-F5-03) are debounced to `PUT /api/drafts/{questionId}` about every
2 s, with `localStorage` as an immediate local mirror. A failed save must raise a
visible warning — silently losing work is the failure mode the story names.

**Verdict rendering** (US-F6-01): `first_fail < sample_count` is called out as a
likely format misunderstanding; `TLE`/`MLE`/`RE` get plain-English explanations;
`IE` says explicitly that the judge failed and it is not counted against them.
`jury_detail` is never in a participant response at all — it is not hidden in the
UI, it never leaves the server (NFR-F-04, NFR-B-05), and a contract test asserts it.

### Kiosk constraints (US-F10-01, NFR-F-05)

The hall has **no internet**. Every asset must be served locally:

- **Monaco must be self-hosted.** The usual `@monaco-editor/react` setup pulls the
  editor from a CDN at runtime and would show a blank editor in the hall. Bundle it.
- Fonts local (`next/font/local`), no Google Fonts at runtime.
- No analytics, no external icon CDNs, no remote source maps.

**Verification:** build the image, run it with networking restricted to the contest
server, and confirm the app is fully usable. This belongs in the pre-contest
checklist, not in someone's memory.

---

## 12. API surface

```
POST   /api/auth/*                        Better Auth handler
GET    /api/state                         everything the client needs on load
GET    /api/events                        SSE stream

POST   /api/bids                          { lot_id, amount }
GET    /api/questions/:id                 owned only; statement, samples, hints
POST   /api/questions/:id/hints           buy the next hint
POST   /api/submissions                   { question_id, language, source }
GET    /api/submissions/:id
PUT    /api/drafts/:questionId
GET    /api/leaderboard

ADMIN — every mutation requires { reason }
POST   /api/admin/problems                upload a package
POST   /api/admin/problems/:id/validate
POST   /api/admin/problems/:id/publish    blast radius, then rejudge
POST   /api/admin/contest/phase
PATCH  /api/admin/contest                 parameters
POST   /api/admin/lots/:id/close
POST   /api/admin/questions/:id/void
POST   /api/admin/participants/:id/adjust
POST   /api/admin/announcements
GET    /api/admin/audit
GET    /api/admin/health                  judge health + submission backlog
GET    /api/admin/export
```

---

## 13. Build order

Each step ends somewhere demonstrable.

| # | Step | Done when |
|---|---|---|
| 1 | Schema, migrations, seed | 20 participants and 25 questions exist |
| 2 | Better Auth + single session | second login kills the first, proven by test |
| 3 | Contest state + SSE + phases | admin advances a phase, every client sees it |
| 4 | **Auction** — bid, award, clock | 20 concurrent bidders, balance never negative |
| 5 | Questions, samples, hints | owner reads a statement, buys a hint, is charged once |
| 6 | Submissions + poller | code judged end to end, cooldown enforced |
| 7 | Scoring + leaderboard | standings correct, ties broken by time |
| 8 | Admin: problems, validate, publish | package uploaded, validated, published |
| 9 | Rejudge, void, override, audit | verdict changed, standings follow, reason recorded |
| 10 | Kiosk hardening | works with no internet, full dress rehearsal |

Step 4 is the highest-risk item and should be built and load-tested before anything
cosmetic. Everything else is comparatively ordinary CRUD.

---

## 14. Decisions taken

| # | Decision | Reasoning |
|---|---|---|
| 1 | **Solve time is derived, never stored** | Satisfies both halves of US-B7-02; nothing can go stale after a rejudge |
| 2 | **Redis dropped** — four services, not six | Nothing left for it to do; one fewer contest-day failure mode. Amends decision 5 |
| 3 | **Next.js route handlers**, not NestJS | One deployable, Better Auth first-class, shared types for free |
| 4 | **`final` is a second coding round** | Separately configurable duration; a clear end to the contest |
| 5 | **Shared `/problems` volume**, judge read-only | Uses the atomic symlink publish the judge already supports; amends assumption 4 |
| 6 | **One repository** | Simplest for the FYP; the judge can be split out when it is open-sourced |
| 7 | **Auction 2 is sequential, same rules** | Reuses the whole auction mechanism; keeps funds reservation unnecessary |
| 8 | **Samples: admin sets K, text read from the package** | A displayed sample can never disagree with the testcase that is judged |
| 9 | **Phase 1 rank breaks an exact final tie** | Avoids joint first place without letting Phase 1 contribute points |
| 10 | **One scoring hack per given solution** | Finding the flaw is the achievement; stops one bug being farmed with near-identical inputs |
| 11 | **Automatic database backups, tested restore** | The only cover for the *server* failing; every other recovery story covers a client |
| 12 | **One account, one role** | Nobody grades their own work |

## 15. Still open

Only values remain — no structural questions.

| # | Open | Blocked on |
|---|---|---|
| 1 | Phase 1 section durations, points per question / explanation / hack | the question set existing |
| 2 | Phase 2 starting balance, base prices, increment X, hint prices, difficulty scores | **how many participants advance** — see below |
| 3 | Countdown, opening window, coding round and final round durations | rehearsal |
| 4 | Default ownership cap | the advancement count |
| 5 | Editor language support beyond highlighting; visual design | — |

**The ordering that matters:** every price in Phase 2 depends on the ratio of
questions to participants. 25 questions among 20 people is a different auction from 25
among 8. Decide how many advance from Phase 1 *first*, then set balances and prices.
