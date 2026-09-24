# Writing Phase 1 questions

Phase 1 has two sections. **Section A** is puzzles: logic, pattern and
constraint questions answered in the browser. **Section B** is hacking:
a deliberately wrong program that competitors break with one input.

Questions are written either in the app (Admin → Section A / Section B → New)
or as a zip imported there. This folder is a working example of the zip
format; `phase1-example.zip` beside it is the same set, packed.

```
Admin → Section A → Import      puzzles
Admin → Section B → Import      hacking questions
```

## Zip layout

One question per folder, each with a `question.json`. A set may hold both
sections; `manifest.json` is optional and read by no one.

```
manifest.json
puzzles/001-next-tile/question.json
puzzles/006-factors-of-36/question.json
puzzles/006-factors-of-36/validator.py
hacking/001-largest-block/question.json
hacking/001-largest-block/given.python.py
hacking/001-largest-block/given.cpp.cpp
hacking/hack-max-subarray-package/          the judge package 001-largest-block points at
hacking/hack-max-subarray-package.zip       the same thing, pre-zipped for Admin → Problems
```

Folder names are yours; the app renames them on export. A zip holding a single
`question.json` at its root imports that one question. The two
`hack-max-subarray-package` entries are the odd ones out — no `question.json`,
not read by this importer at all — see [Hacking questions](#hacking-questions).

Rebuild the zip from this folder with:

```bash
cd demo/phase1-example && zip -qr ../phase1-example.zip . -x '.*' README.md hacking/hack-max-subarray-package.zip
```

(The last exclusion is a pre-built convenience zip that would otherwise nest
inside this one for no reason — see [Hacking questions](#hacking-questions)
below.)

## Puzzles

```json
{
  "format": 1,
  "type": "puzzle",
  "title": "The next tile",
  "body_md": "How many tiles are in **step 10**?",
  "category": "pattern",
  "kind": "mcq_single",
  "grading": "auto",
  "points": 10,
  "explain_points": 0,
  "config": { "options": ["18", "19", "20", "21"] },
  "answer_key": { "option": 1 },
  "model_answer": "Step n has 2n − 1 tiles.",
  "verified": false,
  "was_published": false
}
```

| Field | Required | Notes |
|---|---|---|
| `format` | yes | Always `1`. |
| `type` | yes | `puzzle`. |
| `title` | yes | Shown in the list and to the competitor. |
| `body_md` | yes | The question, in Markdown. Fenced code blocks render. |
| `category` | yes | `pattern`, `detective` or `constraint`. |
| `kind` | yes | One of the seven below; decides what the competitor is shown. |
| `grading` | yes | `auto`, `validator` or `manual`. |
| `points` | yes | Awarded for a correct answer. Ignored when `grading` is `validator`. |
| `explain_points` | no | Extra points for the written explanation, graded by a person. `0` hides the box. |
| `config` | per kind | Options, items and scoring switches. |
| `answer_key` | `auto` only | The answer. Never sent to a competitor. |
| `model_answer` | no | Shown to evaluators while grading, never to competitors. |
| `points_per_entry` | `validator` only | Points per accepted entry. |
| `max_entries` | no | Cap on entries for `set` (default 100). |
| `format_regex` | no | Rejects an answer that does not match, before it is scored. |
| `format_hint` | no | One line under the input saying what is expected. |
| `verified` | no | Leave `false`. Verification is proved in the app, not claimed in a file. |
| `was_published` | no | Leave `false`. See [Importing](#importing). |

### Kinds

| `kind` | `config` | `answer_key` | Competitor sees |
|---|---|---|---|
| `mcq_single` | `options: [string]` | `option: <index>` | Radio buttons |
| `mcq_multi` | `options: [string]`, `partialCredit: bool` | `options: [index]` | Checkboxes |
| `fill_blank` | `caseSensitive: bool` | `accepted: [string]` | One-line box |
| `numeric` | `tolerance: number` | `value: number` | Number box |
| `sequence` | `items: [string]` | `order: [index]` | Items to drag into order |
| `set` | `caseSensitive: bool`, `partialCredit: bool` | `members: [string]` | Multi-line list, one entry per line |
| `long_text` | — | — | Text area. Never auto-scored |

Indices are 0-based and refer to positions in `config.options` or
`config.items`. With `partialCredit`, each correct pick earns its share and
each wrong pick cancels one; without it, the answer must match exactly.
Whitespace is collapsed and, unless `caseSensitive` is true, case is ignored.

### Grading modes

**`auto`** — scored from `answer_key` the moment it is submitted.

**`validator`** — for open-ended lists ("name as many as you can"), where there
is no fixed key. Set `grading: "validator"`, `points_per_entry`, and name a
`validator_file`. Each distinct entry is scored by:

```python
def check(entry):
    """One submitted factor. True when it divides 36 exactly."""
    value = entry.int(1, 36)   # out of range or not an integer marks this entry invalid
    entry.eof()                # "12 18" on one line is two answers, not one
    return 36 % value == 0
```

`entry` is a reader over one answer: `.int(lo, hi)`, `.float()`, `.word()`,
`.line()`, `.rest()`, `.eof()`. Return truthy to accept. Raising marks that one
entry invalid and says why; the rest of the list is still scored. A validator
that cannot run flags the answer for a person — it never scores zero.

**`manual`** — queued for an evaluator under Grading. Give a `model_answer`.

Any question with `explain_points > 0` also reaches the grading queue,
whatever its mode.

## Hacking questions

The competitor reads a program that is wrong on at least one valid input, and
submits an input that breaks it. Each question points at a judge package that
holds the reference solution and the input validator.

```json
{
  "format": 1,
  "type": "hack",
  "title": "Largest sum of a contiguous block",
  "statement_md": "Print the largest sum of a contiguous, non-empty block.",
  "constraints_md": "`1 ≤ n ≤ 1000`, `-1000 ≤ ai ≤ 1000`.",
  "problem_id": "hack-max-subarray",
  "solutions": [
    { "language": "python", "file": "given.python.py", "proven": false, "breaking_input": null },
    { "language": "cpp", "file": "given.cpp.cpp", "proven": false, "breaking_input": null }
  ],
  "hack_points": 25,
  "fail_penalty": 0,
  "verified": false,
  "was_published": false
}
```

| Field | Notes |
|---|---|
| `problem_id` | A problem that already exists under Admin → Problems, marked `hack_only` in its `problem.json`. Its validator decides whether a submitted input is legal, and its reference decides the right answer. |
| `solutions` | One entry per language, each naming a file in the same folder. Offer the same wrong program in several languages so nobody is reading an unfamiliar one. |
| `breaking_input` | The input you know breaks it. Treat the zip as an answer key. |
| `hack_points` | Awarded for a breaking input. |
| `fail_penalty` | Subtracted per failed attempt. `0` for no penalty. |

Name files `given.<language>.<ext>`. Languages: `c`, `cpp`, `python`, `pypy`,
`java`, `javascript`, `typescript`, `go`, `rust`, `kotlin`.

Every copy must be wrong in the **same** way, so the same input breaks all of
them. Import fails if a listed file is missing; the question lands as a draft
if `problem_id` names a package this contest does not have.

This question's own package,
[hack-max-subarray-package/](hacking/hack-max-subarray-package/), sits beside
it under `hacking/` rather than inside this folder, since it belongs to
Admin → Problems, not Section B — see its README for why and how to import
it.

## Importing

Every question lands **unpublished**, whatever the zip says, and unverified
until the app proves it:

- **Puzzles** — run the question's self-test. `auto` asks for the intended
  answer and requires it to score full marks; `validator` asks for entries that
  should pass and entries that should fail; `manual` needs a `model_answer`.
- **Hacking** — submit the breaking input for each copy. A copy is proven when
  the judge agrees the input is legal and that the program gets it wrong.

Publish from the question's own page when it is ready. Publishing is what
makes a question visible to competitors, and a published question can be
answered as soon as its section opens.

`verified: true` and `was_published: true` exist so that a set exported from a
live contest can be restored intact. They are honoured only when the contest
is still in **registration**, and only for questions whose proof travelled with
them. Hand-written zips should leave both `false`.

## Example set

`phase1-example.zip` holds one puzzle of each kind and one hacking question:

| Question | Kind | Grading | Points |
|---|---|---|---|
| The next tile | `mcq_single` | auto | 10 |
| Who was in the building? | `mcq_multi` (partial credit) | auto | 15 |
| The missing word | `fill_blank` | auto | 8 |
| Average degree | `numeric` (tolerance, format regex) | auto | 10 |
| Put the build in order | `sequence` | auto | 12 |
| Every factor of 36 | `set` + `validator.py` | validator | 3 per entry |
| Why a restarting countdown? | `long_text` | manual | 20 |
| Largest sum of a contiguous block | hacking, Python + C++ | judge | 25 |

Its hacking question needs the `hack-max-subarray` package — a plain judge
package (`problem.json`, the correct `solution.py`, `validator.py`, no
testcases, `hack_only: true`), not something a Section B zip carries on its
own. It lives at
[hacking/hack-max-subarray-package/](hacking/hack-max-subarray-package/),
with its own README; import `hacking/hack-max-subarray-package.zip` (built
from that folder, sitting beside it) under **Admin → Problems → Import**
first, or point `problem_id` at a package of your own. Without it, this
question imports as a draft: the app has the buggy program to show but
nothing to check a submitted breaking input against.
