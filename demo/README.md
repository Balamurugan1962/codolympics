# Demo setup

`codolympics-demo-setup.zip` — a complete contest, ready to import under
**Settings → Setup, out and back in → Import a setup**.

To write Phase 1 questions of your own, see
[phase1-example/README.md](phase1-example/README.md) and the example set
`phase1-example.zip` beside it.

## Logins it creates

| Who   | Password        | Role          |
|-------|-----------------|---------------|
| admin | `admin12345678` | Administrator |
| bala  | `12345678`      | Evaluator     |

An import never overwrites an existing login, so on an install that already has
an `admin` the existing one is kept and only `bala` is added.

## What is in it

**Phase 1 · Section A** — one puzzle of every kind, across all three grading
modes, so every authoring option can be seen working before you write your own:

| Puzzle | Kind | Graded |
|---|---|---|
| The next tile | `mcq_single` | auto |
| Who was in the building? | `mcq_multi` | auto, partial credit |
| The missing word | `fill_blank` | auto, case-insensitive |
| Handshakes | `numeric` | auto |
| Put the build in order | `sequence` | auto |
| Every factor of 36 | `set` | Python validator, per entry |
| Why a restarting countdown? | `long_text` | evaluator, with reasoning marks |

**Phase 1 · Section B** — two flawed solutions, each with a proven breaking
input and a validator that rejects illegal ones:

- *Largest sum of a contiguous block* — breaks on an all-negative array
  (`3 / -5 -2 -9`), because the given solution seeds its best at zero.
- *Count the occurrences* — breaks when the run of the target touches index 0,
  because the walk outwards stops one short.

### Inputs to try — Count the occurrences

Format is `n x` on the first line, then the sorted array. All verified against
the judge.

| Input | Result | Why |
|---|---|---|
| `3 7` / `7 7 9` | **hacked** | the run of 7s starts at index 0 |
| `4 3` / `3 3 3 8` | **hacked** | three 3s from index 0 |
| `5 -4` / `-4 -4 -4 -4 0` | **hacked** | negatives, four from index 0 |
| `6 2` / `2 2 2 2 2 5` | **hacked** | five 2s from index 0 |
| `2 5` / `5 5` | survives | the search lands on index 0, so nothing is walked left |
| `4 5` / `1 5 5 9` | survives | the run does not touch index 0 |
| `3 4` / `1 2 3` | survives | the target is absent |
| `3 7` / `9 7 7` | rejected | the array must be sorted non-decreasing |
| `2 7` / `7 99999` | rejected | 99999 is above the maximum 1000 |
| `2 7` / `7 7 7` | rejected | three values but `n` says 2 |

The rule: the run of the target must **start at index 0** and be long enough
that the binary search lands past it. A run of two where the search lands on
index 0 survives, which is why `2 5 / 5 5` is not a hack.

**Phase 2** — four interview classics with an explicit stdin/stdout contract,
two hints each, and a reference solution that passes every test:

| Problem | Tier | Score | Base | Tests |
|---|---|---|---|---|
| Two Sum | easy | 100 | 40 | 6 |
| Valid Parentheses | easy | 100 | 40 | 7 |
| Merge Intervals | medium | 200 | 70 | 5 |
| Longest Substring Without Repeating Characters | medium | 200 | 70 | 7 |

**Settings** — 1000 starting balance, bid increment 10, 15s countdown, 30s
opening window, ownership capped at 2, Coding 1 of 90 minutes, Final of 60,
Section A 45 minutes and Section B 30, Phase 1 standings hidden and Phase 2
live, with a selection basis written out.

## After importing

Nothing to do. Every package was validated against a real judge, every puzzle
passed its self-test, both hacking questions were broken by their own input,
and all of it was live when the zip was made — so it arrives validated, ready
and published, and the contest can be started as it stands.

Each carried result is marked as having been proven elsewhere, because the one
thing a zip cannot carry is how fast your machine is: a reference that ran at
1900 ms of a 2000 ms limit on the machine that exported it will time out on a
slower one. Everything in this set has far more headroom than that (the slowest
reference runs in about 125 ms), but if you want the proof done here, open any
problem and run **Validate**, or use **Validate all** under Problems.

Importing into a contest that has already started publishes nothing: publishing
mid-round changes what participants can see, so it is left to you.

## The two kinds of Python in here

They look alike and are not interchangeable — getting them the wrong way round
produces a question that silently scores nothing.

**Answer validator** (Phase 1, `validator` grading) is handed one submitted
entry at a time and returns whether to accept it:

```python
def check(entry):
    value = entry.int(1, 36)   # raising marks just this entry invalid
    entry.eof()
    return 36 % value == 0
```

**Input validator** (a judge package, used by hacking) is handed a whole input
file and raises if it breaks the stated constraints:

```python
def validate(inp):
    n = inp.int(1, 1000)
    for _ in range(n):
        inp.int(-1000, 1000)
    inp.eof()
```

Both read through the same `Reader`: `.int(lo, hi)`, `.word()`, `.line()`,
`.ints(n)`, `.rest()`, `.eof()`.

## Rebuilding it

`scripts/demo-content.ts` holds the content and `scripts/build-demo-setup.ts`
seeds a scratch database, proves everything through a real judge, and exports
through the app's own exporter — so a change to the zip format breaks the build
loudly instead of producing a file that no longer imports, and a question that
stops working breaks it before anyone ships the zip.

It needs a judge of its own, because the judge reads packages off the volume and
this build uses a scratch one. Start a second one on 8002 pointing at it:

```
cd judge
JUDGE_PROBLEMS_DIR=/tmp/seed-problems \
  JUDGE_SERVICE_TOKEN=$(grep ^JUDGE_SERVICE_TOKEN= ../web/.env | cut -d= -f2) \
  JUDGE_GO_JUDGE_URL=http://127.0.0.1:5050 \
  .venv/bin/uvicorn app.main:app --port 8002
```

Then, with the sandbox container running:

```
docker exec web-postgres-1 psql -U contest -d postgres -c "create database contest_seed;"
cd web
DATABASE_URL=postgres://contest:contest@localhost:5432/contest_seed pnpm db:migrate
DATABASE_URL=postgres://contest:contest@localhost:5432/contest_seed \
  PROBLEMS_DIR=/tmp/seed-problems JUDGE_URL=http://127.0.0.1:8002 \
  JUDGE_SERVICE_TOKEN=$(grep ^JUDGE_SERVICE_TOKEN= .env | cut -d= -f2) \
  pnpm tsx scripts/build-demo-setup.ts ../demo/codolympics-demo-setup.zip
```
