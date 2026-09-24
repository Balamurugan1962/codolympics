# `hack-max-subarray` — a package with nothing to solve

This is not a problem someone buys and solves. It is the **backing judge
package** for the hacking question next door, `../001-largest-block/`, whose
`question.json` points here with `"problem_id": "hack-max-subarray"`.

It lives inside `hacking/` for convenience, but it is **not** imported by
Section B's importer — that only ever reads `question.json` files and skips
this folder entirely. This package is imported separately, on its own, under
**Admin → Problems → Import**. Import it before (or after) the hacking
question; either order works, but the question shows as a draft until this
exists too.

## What's in it

```
package/problem.json     hack_only: true, no testcases
package/solution.py       correct: proves a submitted breaking input's right answer
package/validator.py      proves a submitted breaking input is legal
```

The problem: given `n` integers, print the largest sum of a contiguous,
non-empty block. Constraints `1 ≤ n ≤ 1000`, `-1000 ≤ ai ≤ 1000`.

There are no testcases — a `hack_only` package is never judged against a
fixed test set, only against whatever input a competitor submits as their
attempted hack. That's also why `problem.json` needs a reference solution
but nothing else: no testcases means nothing to validate the reference
against ahead of time.

## Importing

**Admin → Problems → Import**, a zip of *this folder alone* —
`hack-max-subarray-package.zip`, built from it and sitting right beside it.
Not `phase1-example.zip`: Admin → Problems only understands a single
`package/` at a zip's root, or `problems/<id>/` folders bundled at the top
level, and this folder is neither once it is buried inside that larger zip.
It rides along inside `phase1-example.zip` (the whole-folder rebuild sweeps
it up) purely so it travels with the question it backs — Section B's own
importer ignores it, since it has no `question.json`.

There is no `question.json` here either way, so type `hack-max-subarray` as
the id in the Problems import dialog — it has to match what the hacking
question's `problem_id` says, or that question keeps landing as a draft.
Rebuild the zip with:

```bash
cd demo/phase1-example/hacking/hack-max-subarray-package && \
  zip -qr ../hack-max-subarray-package.zip . -x README.md
```

## The bug it's meant to catch

The flawed program shipped with the Section B question seeds its running
best at `0`:

```python
best = 0
here = 0
for x in a:
    here = max(0, here + x)
    best = max(best, here)
```

On an array that is entirely negative, the true answer is the largest
(least negative) single value, but this always returns `0` — an empty block
outscores every real one under this bug. `3` / `-5 -2 -9` breaks it: the
buggy program prints `0`, this package's `solution.py` prints `-2`.
