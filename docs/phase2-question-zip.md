# The Phase 2 question zip

A Phase 2 question is one zip file. Hand it to an organiser, or import it
yourself under **Admin → Problems → Import**, and the question exists: it can be
put in the auction order, bought, read, solved and judged.

The zip has two halves, and they answer different questions.

| Half | Answers | Who reads it |
|---|---|---|
| `question.json` | What is this question worth, and what do bidders get told? | The contest app |
| `package/` | Does this code pass? | The judge |

Keep that split in mind while you work. The judge never reads a title, a price
or a hint. The contest app never reads a testcase.

> Section B hacking questions are a different shape and a different flow. They
> are authored in the app under **Phase 1 → Hacking**, and their packages carry
> `hack_only` with no testcases. This document is only about Phase 2 coding
> questions.

## Start from one that works

The fastest correct start is an export, not a blank folder:

```bash
# Admin → Problems → open a problem → Export as a zip
unzip two-sum.zip -d my-problem
```

Everything below describes what you will find in it.

## The layout

```
my-problem.zip
├── question.json           the contest half: title, topic, price, points, hints
└── package/                the judge half, byte for byte
    ├── problem.json        limits and how output is compared
    ├── tests/
    │   ├── 00001.in
    │   ├── 00001.ans
    │   ├── 00002.in
    │   └── 00002.ans
    ├── solution.py         the reference solution, named in problem.json
    ├── checker.py          only when compare is "checker"
    ├── validator.py        optional, checks that each input obeys the constraints
    └── validation.json     written by the app when the package is validated
```

**Zip the contents, not the folder.** `question.json` and `package/` must be at
the root of the zip. Import does not strip a wrapper folder: a zip of
`my-problem/question.json` and `my-problem/package/…` is refused with "the
package has no problem.json at its root".

```bash
cd my-problem && zip -r ../my-problem.zip question.json package   # right
zip -r my-problem.zip my-problem                                  # refused
```

(The **Upload a problem** button, which takes a judge package on its own, is
more forgiving and does strip one wrapper folder. Import is the strict one.)

`__MACOSX`, `.DS_Store` and `Thumbs.db` are dropped. Any path containing `..`
is ignored.

## question.json

The contest half. Everything a bidder is told, and everything the winner reads.

```json
{
  "format": 1,
  "type": "problem",
  "id": "two-sum",
  "details": {
    "title": "Two Sum",
    "topic": "Arrays and two pointers",
    "difficulty": "easy",
    "score": 100,
    "base_price": 40,
    "statement_md": "Given an array of integers and a target, find the **two distinct positions** whose values add up to the target.\n\n### Input\n```\nn target\na1 a2 … an\n```\n\n### Output\nThe two positions, **0-based**, smaller first.\n\n### Constraints\n- `2 ≤ n ≤ 100000`\n",
    "sample_count": 2,
    "hints": [
      { "price": 15, "body_md": "You do not need to compare every pair." },
      { "price": 30, "body_md": "Walk the array once, keeping a map from value to position." }
    ]
  }
}
```

### Every field

| Field | Required | Limit | If you leave it out |
|---|---|---|---|
| `id` | yes, unless you type the id in the import dialog | letters, digits, `.` `_` `-` | The import is refused |
| `details.title` | in practice yes | 1 to 200 characters | Falls back to the problem id |
| `details.topic` | yes in the app's own form | up to 80 characters | Empty, and the auction floor reads "Topic not set" |
| `details.difficulty` | yes | `beginner`, `easy`, `easy_medium`, `medium` or `hard` (`easy-medium` is accepted too) | The import is refused |
| `details.score` | yes in practice | whole number, 0 or more | 0, so solving it pays nothing |
| `details.base_price` | yes in practice | whole number, 0 or more | 0, so bidding opens at nothing |
| `details.statement_md` | yes | up to 200,000 characters, Markdown | Empty, and the owner sees a blank problem |
| `details.sample_count` | no | 0 to 20 | 0, so no worked example is shown. More than the testcases you have shows every testcase it can find |
| `details.hints` | no | up to 20, each `{ "price": n, "body_md": "…" }` | No hints for sale |
| `format` | no | integer | Assumed current. A zip from a newer exporter is refused |
| `type` | no | `"problem"` | Ignored on import |
| `exported_from` | no | written by the exporter | Read for provenance only, never replayed |

`auction_order` is deliberately not imported from the zip. A new problem joins
the end of this contest's running order, so importing never takes somebody
else's slot. Set the order in the app, under **Problems → Order**.

### What a bidder actually sees

Bidding is blind. On the auction floor the room is shown the **topic**, the
**difficulty**, the **base price** and the **points**, and nothing else. The
title, the id and the statement stay hidden until somebody wins the question,
and then only the winner sees them.

That makes `topic` load-bearing. Write enough to bid on and not enough to solve:

- Good: `Graphs, shortest paths`, `Strings, sliding window`, `Greedy with sorting`
- Too much: `Dijkstra on a 2D grid with teleports`
- Too little: `Medium problem`

### Samples

`sample_count` takes the **first N testcases** and shows them, input and
expected output, inside the statement. Number your tests so the first ones are
the small, readable, explanatory ones. Never set `sample_count` to the number
of testcases you have: nothing would be hidden.

## package/problem.json

The judge half. Limits, comparison and the reference solution.

```json
{
  "time_limit_ms": 2000,
  "memory_limit_mb": 256,
  "compare": "tokens",
  "reference": { "language": "python", "file": "solution.py" }
}
```

| Field | Default | Meaning |
|---|---|---|
| `time_limit_ms` | 1000 | Per testcase, per run |
| `memory_limit_mb` | 256 | Per run |
| `compare` | `tokens` | How output is compared, see below |
| `early_exit` | `true` | Stop at the first failing testcase. Validation ignores this and runs them all |
| `float_tolerance` | `1e-6` | Only for `compare: "float"`, absolute or relative |
| `reference` | none | `{ "language": …, "file": … }`. Required to validate the package. Never served to anyone |
| `id` | none | Ignored by the judge, which loads a problem by its directory. Harmless to keep |

`language` is one of `c`, `cpp`, `python`, `pypy`, `java`, `javascript`.

### Comparison modes

| `compare` | Behaviour |
|---|---|
| `tokens` | Whitespace-insensitive. Right for most problems |
| `exact` | Byte-exact, trailing whitespace tolerated |
| `float` | Numeric, within `float_tolerance` |
| `yesno` | Case-insensitive YES and NO |
| `checker` | `checker.py` decides. Use when more than one answer is correct |

## tests/

One input file and one answer file per testcase.

- `NNNNN.in` holds the input. `NNNNN.ans` holds the expected answer, and
  `NNNNN.out` is accepted for the same thing.
- **Zero-pad the names.** The judge orders testcases lexically, so `10` runs
  before `2` unless the names are padded. A report of "failed on testcase 12"
  then means the same testcase on every run.
- An input with no answer file is skipped during judging and named by
  validation. It is a setter's mistake, so it never fails a competitor's
  submission.
- End every file with a newline. It costs nothing and avoids a class of
  comparison surprise.

## checker.py

Only for `compare: "checker"`, and only when a question has more than one
correct answer.

```python
def check(inp, out, ans):
    target = inp.int()
    got = out.int()
    if got * got != target:
        return False, f"{got}^2 != {target}"
    return True
```

`inp`, `out` and `ans` are readers over the test input, the competitor's output
and your expected answer. They offer `.int(lo, hi)`, `.float()`, `.word()`,
`.line()`, `.ints(n)`, `.rest()` and `.eof()`.

You do not need to defend against malformed competitor output. If they print a
word where you called `out.int()`, the reader turns that into a clean wrong
answer. The same failure reading `inp` or `ans` becomes an internal error,
because broken jury data is never the competitor's fault. A checker that
crashes or hangs is an internal error too, never a wrong answer.

## validator.py

Optional for a Phase 2 question, and worth writing anyway: it is what proves
your testcases obey the constraints you published.

```python
def validate(inp):
    n = inp.int(1, 100000)
    for _ in range(n):
        inp.int(-10**9, 10**9)
    inp.eof()
```

## validation.json

Written by the app, not by you. It records the last time the reference solution
was run over every testcase:

```json
{ "at": "2026-09-13T19:15:25.781Z", "verdict": "AC", "passed": 6,
  "testcases": 6, "max_time_ms": 29.1, "time_limit_ms": 2000, "ok": true }
```

It travels inside an export, and on import it is kept and stamped with the time
it arrived. Treat it as provenance, not permission: it says the package passed
**somewhere**, which is not the same as passing on the contest machine. If this
machine is slower than the one that proved it, validate again here.

## Many problems in one zip

An export of everything, and what you can hand over as a set:

```
codolympics-problems-2026-09-20.zip
├── manifest.json               written by the exporter, optional on import
└── problems/
    ├── two-sum/
    │   ├── question.json
    │   └── package/…
    └── merge-intervals/
        ├── question.json
        └── package/…
```

Each folder is imported exactly as it would be on its own, and the id comes from
that folder's `question.json`. The folder name is only a container, and the id
typed in the import dialog is ignored for a bundle. Two consequences worth
knowing:

- **A folder without its own `question.json` is not part of the bundle.** The
  import will not see it, and if no folder has one the whole zip is treated as a
  single problem instead.
- **A folder whose `question.json` has no `id` fails**, even if the folder is
  named after the problem.

## A plain judge package

A zip with `problem.json` at its root and no `question.json` imports too. It
gives you a judged problem with no contest details, so you must type the id in
the import dialog, and the app tells you it cannot be auctioned until you add a
title, a statement and a price. This is the shape to use when the problem was
prepared for the judge alone.

## What the app checks before it accepts anything

The browser looks inside the zip before it is uploaded and separates what will
be refused from what is worth a second look.

**Refused:**

- The file is not a valid zip, or it is empty
- There is no `problem.json` at the root of the package
- `problem.json` is not valid JSON
- `compare` is `"checker"` and there is no `checker.py`
- The reference file named in `problem.json` is not in the package
- There are no testcases under `tests/`
- `difficulty` is not `beginner`, `easy`, `easy_medium`, `medium` or `hard`
- The problem id has anything other than letters, digits, `.`, `_` or `-`
- The zip was written by a newer exporter than this install understands

**Warned about, and imported anyway:**

- Testcases with no `.ans` or `.out` file, named for you
- Names that are not zero-padded, so 10 would run before 2
- No `time_limit_ms` or `memory_limit_mb`, so the judge's defaults apply
- No contest details in the zip, so the question cannot be auctioned yet
- No judge package in the zip, so nothing can be judged yet

## When an import is refused

Every message below is the whole message, and each means one thing.

| Message | Cause | Fix |
|---|---|---|
| `the upload is not a valid zip file` | Not a zip, or a corrupt one | Rezip it |
| `the package has no problem.json at its root` | The package files are inside a wrapper folder, or `package/problem.json` is missing | Zip the contents, not the folder |
| `the zip has no id, give one, or export the problem from this app` | A plain judge package with no `question.json`, and no id typed | Type the id in the import dialog |
| `problem id: letters, digits, . _ - only` | An id with a space or a slash in it | Rename the problem |
| `unknown difficulty "tricky"` | `details.difficulty` is not one of the five tiers | Use `beginner`, `easy`, `easy_medium`, `medium` or `hard` |
| `that zip was made by a newer version (format 99)` | The zip came from a newer install | Export it again from this one |
| `that zip is larger than 256 MB` | Too many or too large testcases | Trim the testcases, or upload the package on its own |

## Limits

Two of these are enforced on the way in. The rest are what the app's own
authoring form allows, and an import is **not** checked against them: a zip with
a 300 character title is written as it stands, and then sits badly on every
screen that shows it. Keep to them anyway.

| Thing | Limit | Enforced on import |
|---|---|---|
| Import of a question zip or a bundle | 256 MB | yes, refused above it |
| Upload of a plain judge package | 200 MB | yes, refused above it |
| Export of one problem | 256 MB of package files | yes, the export fails |
| Title | 200 characters | no |
| Topic | 80 characters | no |
| Statement | 200,000 characters | no |
| Hints | 20 per question, each up to 20,000 characters | no |
| Samples | 20 | no |

## What importing actually does

1. The package becomes a **new version** on the shared volume: `v1`, `v2`, `v3`.
   The version that is live is never touched by an import.
2. The details are written, and the question joins the **end** of the running
   order if it is new.
3. Any `validation.json` that came with it is kept and stamped as having run
   elsewhere.
4. Nothing is published. Publishing is a separate, deliberate step, because
   publishing a new version mid-contest rejudges every submission against it.

A question is ready to be auctioned when it has a package, a passing validation,
contest details, and a published version.

The one exception to step 4 is the **setup zip**, the whole-contest export used
to carry a contest from the machine it was built on to the machine it runs on.
That one restores what was live where it was made, and only while the contest is
still in registration and only for a package whose validation travelled with it.
Anything it cannot publish safely it leaves unpublished and says why.

## Before you hand it over

- [ ] The reference solution passes every testcase, well inside the time limit
- [ ] The statement's constraints match what `validator.py` enforces
- [ ] `topic` says enough to bid on and not enough to solve
- [ ] `score` and `base_price` are sane against the other questions in the set
- [ ] `sample_count` is small, and the first testcases are the readable ones
- [ ] Testcase names are zero-padded, and every `.in` has an answer
- [ ] Hints are ordered from gentle nudge to near-solution, and priced that way
- [ ] The zip imports into a scratch install and validates there

## Building one by hand

```bash
mkdir -p my-problem/package/tests
cd my-problem

cat > package/problem.json <<'JSON'
{ "time_limit_ms": 2000, "memory_limit_mb": 256, "compare": "tokens",
  "reference": { "language": "python", "file": "solution.py" } }
JSON

cp ~/work/solution.py package/solution.py
printf '5 9\n2 7 11 15 1\n' > package/tests/00001.in
printf '0 1\n'              > package/tests/00001.ans

cat > question.json <<'JSON'
{ "format": 1, "type": "problem", "id": "my-problem",
  "details": { "title": "My Problem", "topic": "Arrays and two pointers",
               "difficulty": "easy", "score": 100, "base_price": 40,
               "statement_md": "…", "sample_count": 1, "hints": [] } }
JSON

zip -r ../my-problem.zip question.json package
```

Then import it, open it, validate it, and publish it.
