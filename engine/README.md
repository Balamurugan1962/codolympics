# Contest engine

Every rule of Codolympics, and all of its state, in plain Python. A thin
FastAPI layer exposes it; the Next.js web app is only a client.

```
browser ──► web (Next.js)  /api/auth/*  Better Auth: sign in / sign out
                │
                └── /api/*  forwarded, with x-engine-token + the session cookie
                     ▼
            engine (this)  api/  → engine/  → Postgres
                                   └──────► judge-api → go-judge
```

The engine container publishes **no port**. Only the web app reaches it, on the
internal Docker network, and every request must carry `ENGINE_SERVICE_TOKEN`.

## Reading a request end to end

Take `POST /api/bids`:

1. **Service token** – `api/main.py` refuses anything that did not come
   through the web app.
2. **Route** – `api/routes/participant/coding.py::place_bid`. The `Participant`
   type on the first argument is the authorisation; `BidBody` is the validated
   body.
3. **Authentication** – `api/auth.py`. The Better Auth cookie is
   `<token>.<HMAC-SHA256 signature>`. The signature is checked with
   `BETTER_AUTH_SECRET`, then the token is looked up in the `session` table
   (`engine/accounts/viewer.py::viewer_for_session_token`).
4. **Engine** – `engine/auction/bidding.py::place_bid`: one transaction, the
   locks it needs, the rules (`engine/auction/rules.py`), the writes.
5. **Event** – after commit, `engine/core/events.py::publish` appends what
   changed.
6. **Response** – the route returns `{"ok": true}`. A rule broken on purpose is
   an `EngineError`, which `api/error_handlers.py` turns into
   `{"error": code, "message": ...}`.

## Layout

```
api/
  main.py              the app: service-token check, routers, lifespan (scheduler)
  auth.py              cookie -> viewer, role guards
  common.py            shared body base, uploads, downloads
  error_handlers.py    the one error shape
  routes/
    participant/       session, coding (bids, questions, hints, submissions), marketplace, phase1
    staff/             grading
    admin/             contest, setup, auction, questions, powerups, people,
                       phase1_selection, phase1_authoring, problems, judge

engine/
  core/          config, db (pool, transaction, advisory locks), clock, errors,
                 serialize, audit, events (the polled feed)
  schema/        the tables, grouped: identity, contest, auction, coding, phase1, marketplace
  judge/         client (the judge service), languages
  accounts/      viewer, credentials, registration, management, wallet (every balance change)
  contest/       rules (the contest row and phase gate), phases, phase_checks, messages, readiness
  auction/       rules, board, bidding, lots (the clock), sales, control (pause, timer, retract),
                 lot_queue, takeback, offline, organiser_view
  coding/        questions, hints, question_authoring, submissions, judging (the poller),
                 rejudge, submission_views, scoring (standings)
  marketplace/   catalogue, storefront, inventory, buying, using, blackouts
  phase1/        answers (pure scoring), puzzles, validator_jobs, hacking, hack_jobs,
                 standings, grading, selection, authoring, self_tests, results
  packages/      volume, zips, validation, publishing, listing,
                 problem_zip, phase1_zip, setup_zip
  admin/         contest_settings, contest_reset, corrections, overview, dossier,
                 judge_activity, records
  state.py       GET /api/state
  scheduler.py   the once-a-second loop
  bootstrap.py   what must exist before serving
  migrate.py     schema upgrades

migrations/      Alembic
tests/           pytest, against a real Postgres
```

Each package's `__init__.py` says what it holds; each module's docstring says why
it works the way it does.

## Running

```bash
python3.12 -m venv .venv && .venv/bin/pip install -e ".[dev]"
export DATABASE_URL=postgres://contest:contest@localhost:5432/contest
export BETTER_AUTH_SECRET=... ENGINE_SERVICE_TOKEN=... JUDGE_URL=http://127.0.0.1:8001 JUDGE_SERVICE_TOKEN=...
export PROBLEMS_DIR=../judge/problems ADMIN_PASSWORD=...
.venv/bin/python -m engine.migrate
.venv/bin/uvicorn api.main:app --port 8080
```

`./run.sh up` at the repo root does all of this. Tests need a database whose name
says it is for testing (the suite refuses anything else):

```bash
DATABASE_URL=postgres://contest:contest@localhost:5432/contest_engine_test .venv/bin/pytest
```

A database built by the old web app's Drizzle migrations is recognised and stamped
at the baseline, then upgraded, so an existing contest database carries over.

## How the page stays live

Pages poll `GET /api/poll?after=<cursor>` about once a second. The engine returns
the events since that id that the viewer may see (broadcasts plus their own), in
the same shape the old SSE stream carried. `GET /api/state` includes
`event_cursor`, the newest id at the moment the state was read, so polling starts
exactly where the snapshot ends. Events are kept for 30 minutes. A cursor older
than that gets `reset: true`, and the page re-reads its state.

## Concurrency decisions

The engine runs at Postgres READ COMMITTED. Correctness never depends on memory,
a single process, or requests arriving in a polite order. Each rule below names
the shared state, the boundary it is protected at, and why.

### Lock order

Always: **contest row → lot / question → participant rows**. Several
participant rows are locked together, sorted by id (`wallet.lock_participants`).
A transaction that follows the order cannot deadlock with another that does.

### The contest row is the phase gate

- **Participant actions** that depend on the phase or a setting read the contest
  row `FOR SHARE`: bids, submissions, answers, hacks, purchases, uses and
  registration. Many run side by side.
- **Changes to the contest** take it `FOR UPDATE`: phase advance, extend, pause,
  resume, settings, registration and reset. Each waits for in-flight actions, and
  the actions after it see the new phase.

Why: without it, "Section A closed" and "an answer was saved" could both be true
of the same instant, or a bid could land during a pause.

### The auction

| Shared state | Protection | Why |
|---|---|---|
| The open lot's current bid | `lot` row `FOR UPDATE` in `place_bid` | Twenty simultaneous bids queue on one row. Each checks the amount the previous one left, so there is exactly one accepted bid per rung. |
| Settling a lot | `settle_if_due` re-reads the deadline under the lot lock | A last-second bid or an organiser's +30 s cannot be settled over by a scheduler that looked early. |
| A bid after the clock ran out | Refused inside `place_bid` | The deadline is the rule, not the scheduler's next tick. |
| "One lot on the block" | Partial unique index `lot_single_open` | Two processes opening "the next lot" at once cannot put two on the block. |
| Ownership | `ownership` primary key, plus upsert only over a voided row | A question has one owner. A question taken back can be sold again. |
| Pause / resume | Contest row `FOR UPDATE`; deadlines shifted in SQL | The held time comes back exactly, and no bid slips in mid-pause. |

### Money

`accounts/wallet.py::move` locks the participant row, checks, updates and writes the ledger,
all in the caller's transaction. Two purchases racing one balance run one after
the other. `CHECK (balance >= 0)` is the backstop.

### Submissions and the judge

- **One participant, many clicks.** `submit` locks the participant row, so the
  in-flight and cooldown checks see every earlier submission from that person.
- **Many senders.** The scheduler, possibly in several processes, and each submit
  send pending work. A row is claimed with `FOR UPDATE SKIP LOCKED` before it is
  sent, so each judgement goes to the judge exactly once.
- **Results out of order.** A verdict is written only if the row is still in
  flight and still waiting on that job id. A cancel, a rejudge, or a resubmission
  after a judge restart makes a late result update nothing.
- **Rejudges.** Partial unique index `judgement_one_current` means concurrent
  rejudges leave exactly one current judgement per submission.
- **No HTTP while holding locks.** The one exception is the brief claim during
  `/submit`, which returns at once. The language list is read before the submit
  transaction opens.

The same claim-and-conditional-update pattern covers hack attempts and validator
scoring.

### Powerups

- **Attacks** lock the attacker and target rows together, in id order. Two
  attacks on one person serialise, so one Shield is spent by exactly one of them.
  Two people attacking each other at once cannot deadlock.
- **Stacking is adjacency.** A new blackout starts where the last one ends, so
  the total is the sum by construction.
- **Idempotency.** Every buy or use carries a client `request_id`, unique per
  actor in `powerup_event`. The event row is inserted last, so a replay collides,
  rolls back, and gets the first attempt's result.

### Other idempotency

- **Hints.** The client sends the index it is buying. A repeat finds it already
  bought and returns it free, instead of buying the next one.
- **Registration.** The unique username and email decide name clashes. The user,
  participant and starting-ledger rows are one transaction.
- **Phase advance.** The engine checks that the phase is still the one the checks
  ran against, so two organisers move the contest one phase, not two.
- **Package upload.** Each upload claims its version directory with `mkdir`,
  which is atomic.
- **Publish.** An advisory lock per problem keeps the `current` symlink and the
  question row in agreement.

### The scheduler

It runs inside every API process. Each tick takes `pg_try_advisory_xact_lock`
on its own connection. Whoever gets it ticks, and the others skip that second.
The lock is released when the tick ends, or when the process dies. Every step
re-checks under row locks anyway, so overlapping ticks could not settle or score
twice; the lock only saves wasted work.

### The event feed

`publish` takes an advisory lock around its one-row insert, so event ids commit
in order. `since` reads the newest id first, then the rows up to it. A poller
therefore never advances past an event that has not committed yet. Events are
written after the change commits and are nudges, not truth: a lost one is
recovered by the page's next state read.

### Leaderboards

Leaderboards are computed on every read and never stored. There is no
leaderboard state to race over: a rejudge, void or take-back changes the
standings with nothing to recompute.
