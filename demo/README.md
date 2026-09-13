# Demo setup

`codolympics-demo-setup.zip` — a complete contest, ready to import under
**Settings → Setup, out and back in → Import a setup**.

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
- *Count the occurrences* — breaks when the run of the target touches index 0
  (`3 7 / 7 7 9`), because the walk outwards stops one short.

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

Nothing arrives published — that is deliberate, since an import cannot know
whether these tests were built against the checker on your judge. For each
problem: open it, run **Validate**, then **Publish**. For Phase 1: open each
question, run its self-test, then publish.

## Rebuilding it

`scripts/demo-content.ts` holds the content and `scripts/build-demo-setup.ts`
seeds a scratch database and exports through the app's own exporter, so a change
to the zip format breaks the build loudly instead of producing a file that no
longer imports.

```
docker exec web-postgres-1 psql -U contest -d postgres -c "create database contest_seed;"
cd web
DATABASE_URL=postgres://contest:contest@localhost:5432/contest_seed pnpm db:migrate
DATABASE_URL=postgres://contest:contest@localhost:5432/contest_seed \
  PROBLEMS_DIR=/tmp/seed-problems \
  pnpm tsx scripts/build-demo-setup.ts ../demo/codolympics-demo-setup.zip
```
