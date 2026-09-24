# Writing Phase 2 questions

Phase 2 questions are ordinary competitive-programming problems: stdin in,
stdout out, judged against hidden testcases with a 1s time limit. They are
what participants buy at auction, not what they see in Phase 1.

Questions are written either in the app (Admin → Problems → New / Import) or
as a zip imported there. This folder is a working example of the zip format;
`phase2-example.zip` beside it is the same two problems, packed.

```
Admin → Problems → Import      problems, one or a bundle
```

## Zip layout

A bundle holds one folder per problem under `problems/<id>/`, each with a
`question.json` (the contest-facing details) and a `package/` (the judge
package — exactly what a plain upload to the judge accepts on its own).

```
problems/second-largest-distinct/question.json
problems/second-largest-distinct/package/problem.json
problems/second-largest-distinct/package/solution.py
problems/second-largest-distinct/package/validator.py
problems/second-largest-distinct/package/tests/00001.in
problems/second-largest-distinct/package/tests/00001.ans
problems/peak-element/question.json
problems/peak-element/package/problem.json
problems/peak-element/package/solution.py
problems/peak-element/package/validator.py
problems/peak-element/package/checker.py
problems/peak-element/package/tests/...
```

A zip holding a single `question.json` at its root (with `package/` beside
it) imports that one problem instead of a bundle — that is also exactly what
**Admin → Problems → Export** produces for one problem, so a round-trip
always works.

Rebuild the zip from this folder with:

```bash
cd demo/phase2-example && zip -qr ../phase2-example.zip . -x '.*' README.md
```

## `question.json` — the contest-facing details

```json
{
  "format": 1,
  "type": "problem",
  "id": "second-largest-distinct",
  "details": {
    "title": "Second Largest Distinct Value",
    "topic": "arrays",
    "difficulty": "easy",
    "score": 100,
    "base_price": 40,
    "statement_md": "Given `n` integers, print …",
    "sample_count": 2,
    "hints": [
      { "price": 15, "body_md": "Track the largest value seen so far…" },
      { "price": 30, "body_md": "Keep two running values…" }
    ]
  }
}
```

| Field | Required | Notes |
|---|---|---|
| `format` | yes | Always `1`. |
| `type` | yes | `problem`. |
| `id` | yes | Letters, digits, `.` `_` `-` only. Also the judge's `problem_id` — the two are never allowed to differ. |
| `details.title` | yes | Never shown before the lot is sold — bidding is **blind**, on `topic`/`difficulty`/`base_price`/`score` alone. |
| `details.topic` | no | The one thing bidders see. Keep it a category, not a hint (`arrays`, not `two pointers, O(n)`). |
| `details.difficulty` | yes | `easy`, `medium` or `hard` — the only field the importer itself rejects if wrong. |
| `details.score` | yes | Points paid to whoever solves it — the Phase 2 leaderboard. |
| `details.base_price` | yes | Coins it opens at in the auction. |
| `details.statement_md` | yes | The problem, in Markdown. Fenced code blocks render; state the input/output format and constraints explicitly. |
| `details.sample_count` | yes | How many of the **first** testcases (in filename order) are shown, with their answers, in the statement itself. Judged first, so a formatting mistake is caught before the hidden tests. |
| `details.hints` | no | Author-written text only — **hidden testcases are never revealed, at any price.** Purchasable any time the owner holds the question. |
| `details.auction_order` | no | Omitted here on purpose: a new problem is appended to the end of this contest's running order on import, not placed by the zip. |

The importer itself only checks `id`, that `difficulty` is one of the three,
and that `hints` is a list — everything else is stored as given. The app's
own editing form is stricter (title 1–200 characters, topic ≤ 80, statement
≤ 200,000, `sample_count` 0–20, up to 20 hints), and enforces it the moment
you open the problem there, so an out-of-range zip is worth fixing before it
surprises you in the UI rather than at import time.

A zip with no `details` still imports the judge package, but the problem has
no title, price or statement yet and cannot be auctioned until someone adds
them in the app.

## `package/problem.json` — what the judge runs

```json
{
  "id": "peak-element",
  "time_limit_ms": 1000,
  "memory_limit_mb": 256,
  "compare": "checker",
  "reference": { "language": "python", "file": "solution.py" }
}
```

| Field | Required | Notes |
|---|---|---|
| `id` | yes | A label only, not cross-checked — the problem id that actually matters is the zip folder's (or the id typed in the import dialog). Keep them the same anyway. |
| `time_limit_ms` | no | Default `1000`. The contest standard is 1s, Codeforces-style, with **no per-language multiplier** — a slow language is the contestant's problem, which is why `pypy` exists as an escape hatch. |
| `memory_limit_mb` | no | Default `256`. |
| `compare` | no | How output is judged. Default `tokens`. See below. |
| `early_exit` | no | Default `true`: stop at the first failing testcase. Scoring is binary (solved or not), so there is rarely a reason to set this `false`. |
| `float_tolerance` | no | Only read when `compare` is `float`. Default `1e-6`. |
| `reference` | **yes** | `{ "language": ..., "file": ... }`, a solution proven correct. **Required for every problem** — it is how `.ans` files are checked and how the 1s limit is proven comfortable. Its source is never served to anyone. Language is one of `c`, `cpp`, `python`, `pypy`, `java`, `javascript`. |
| `hack_only` | no | Leave unset. A `true` problem has no testcases of its own and exists only to be pointed at by a Phase 1 Section B hacking question — see [phase1-example/README.md](../phase1-example/README.md). |

## `package/tests/` — the testcases

One file pair per case: `NNNNN.in` and `NNNNN.ans` (`.out` is also accepted
for the answer), zero-padded so lexical order is numeric order — that order
is what `sample_count` counts from, and what a jury sees as "testcase 3". An
`.in` with no matching `.ans` is a broken problem: import flags it and
judging simply skips it rather than failing a contestant's submission over
the setter's mistake.

`.ans` files are produced by running the reference solution, never typed by
hand — this example's were generated that way and re-checked on import.

## Comparing output

Four modes need no code from you (US-J3-01 in the judge's own notes); the
fifth runs a checker you write.

| `compare` | Judges by |
|---|---|
| `tokens` *(default)* | Whitespace-insensitive token match — `1 2 3` equals `1  2\n3`. Right for almost every problem. |
| `exact` | Byte-exact, except trailing whitespace at the very end. |
| `float` | Token by token; numeric tokens may differ by `float_tolerance`, absolute or relative, whichever is kinder. Non-numeric tokens must match exactly. |
| `yesno` | Case-insensitive `YES`/`NO` (`y`/`n`/`true`/`false` also normalise), token by token. |
| `checker` | Runs `checker.py`. Use this whenever more than one output can be correct — as in `peak-element` here, where several indices may be valid peaks and only the checker can tell. |

### `checker.py` (tier 2, `compare: "checker"`)

```python
def check(inp, out, ans):
    n = inp.int()
    a = inp.ints(n)
    idx = out.int(0, n - 1)   # out of range or not an integer is a clean WA, not a crash
    out.eof()                 # extra tokens after a correct answer are rejected
    left = a[idx - 1] if idx > 0 else float("-inf")
    right = a[idx + 1] if idx < n - 1 else float("-inf")
    if not (a[idx] > left and a[idx] > right):
        return False, f"index {idx} (value {a[idx]}) is not a peak"
    return True
```

`inp`, `out` and `ans` are Readers — one over the testcase input, one over
the contestant's output, one over the reference answer. Return `True` (or
`True, "detail"`) to accept, `False, "detail"` to reject. The detail is
shown to the jury only; it would hand a contestant the answer, so it is never
sent to them.

The rule that makes checkers safe to write: malformed **contestant** output
(`out`) is a clean WA — call `out.int()` without defending against garbage,
the reader turns "banana" into a rejection for you. Malformed **jury** data
(`inp`/`ans`) is our mistake, never the contestant's, and the same call on
those raises into an internal error instead of scoring against them.

### `validator.py` (optional, checks the *input*, not the output)

```python
def validate(inp):
    n = inp.int(1, 200000)
    seen = set()
    for _ in range(n):
        v = inp.int(-10**9, 10**9)
        assert v not in seen, "values must be distinct"
        seen.add(v)
    inp.eof()
```

Run once per input file; raising anything — an `assert`, a bounds error from
`inp.int(lo, hi)`, a plain exception — marks that file invalid, checked by
**Admin → Problems → Validate**. It never touches output, so it cannot
replace a checker; it exists to catch a bad testcase (out of range, or an
aggregate constraint like "sum of `n` over all cases ≤ 2·10^5") before a
contestant ever sees it.

Both `checker.py` and `validator.py` read through the same `Reader`:
`.int(lo, hi)`, `.float(lo, hi)`, `.ints(count, lo, hi)`, `.word()`,
`.line()`, `.rest()`, `.eof()`.

Three distinct things, easy to confuse:

- **validator** → checks the **input** files are legal
- **reference solution** → proves the **answer** files are right, and that
  the time limit is comfortable
- **checker** → decides if the **contestant's** output is acceptable

## Importing and validating

Through **Admin → Problems → Import**, every import lands as a new
**unpublished** version, whatever the zip claims — importing mid-contest
never changes what a participant can see until you publish it yourself.
**Admin → Problems → Validate** then proves the package end to end: runs the
reference solution against every testcase (confirming the `.ans` files and
the time limit), checks the validator accepts them, and — for `checker` —
runs the checker over the reference's own output. A problem that has never
validated cannot go live.

`exported_from.was_live` and the validation record travelling with an
exported zip exist for one narrower path: restoring a full contest from
**Settings → Setup → Import a setup**, which republishes a problem that was
live where the zip was made, but only when that run's validation travelled
with it and the contest being imported into is still in **registration**. A
problem zip imported on its own, through Admin → Problems, always lands
unpublished and unvalidated regardless — validate and publish it there.

## Example set

`phase2-example.zip` holds two problems, one of each comparison tier:

| Problem | Tier | Compare | Difficulty | Score | Base price | Tests |
|---|---|---|---|---|---|---|
| Second Largest Distinct Value | 1, no code | `tokens` *(default)* | easy | 100 | 40 | 9 |
| A Peak Element | 2, `checker.py` | `checker` | medium | 200 | 70 | 8 |

Both carry a `validator.py`, a reference solution proven against every
testcase here, and two priced hints. Import them and run **Validate** (or
**Validate all** under Problems) to see both pass against a real judge.
