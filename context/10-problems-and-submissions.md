# 10. Problems and Submissions (Phase 2)

## 10.1 What a question is

A Phase 2 question is a programming task that reads from **standard input** and writes to
**standard output**. It is not a function stub. Many questions have one input file
containing many small cases ("the first line holds t, the number of test cases"), which the
program loops over.

Each question has:

| Part | Seen by its owner? | Seen by anyone else? |
|---|---|---|
| Title, difficulty, points reward | Yes | Yes, at auction and on the running order |
| Base coins | Yes | Yes, at auction |
| Statement (formatted text, formulae, code blocks; input format, output format and constraints clearly separated) | Yes | **Never** |
| Time limit per testcase (default 1 second, the same for every language) | Yes | No |
| Memory limit | Yes | No |
| **Sample testcases**: input and expected output in full | Yes, free | Never |
| **Number** of hidden testcases | Yes | No |
| **Contents** of hidden testcases | **Never** | Never (staff only) |
| Hints: how many exist, the next one's price, and the text of bought ones | Yes | Never |
| Their own submissions, verdicts and draft | Yes | Never |

## 10.2 Languages and limits

- Offered languages: **C, C++, Java, Python, PyPy, JavaScript.** The editor's language list
  always matches what the judge actually offers.
- **One time limit for every language** (default 1 second per testcase, unless a question
  states otherwise). It is set with C++ in mind. Interpreted languages are genuinely
  disadvantaged on tight problems, and PyPy exists as the escape hatch. Participants are told
  to factor this into bidding.
- Source code: at most 256 KB per submission or draft.
- All code is written in the product's editor and compiled and run on the server. There is no
  local compiler, terminal or personal template.

## 10.3 The workspace

Opening a question shows the problem and the code side by side.

**Problem side** (three tabs):

- **Problem:** title, difficulty, points reward, "Solved" marker if solved; statement; limits; number of
  hidden tests; samples with a one-action **copy** for each input and output. Samples are
  clearly labelled as distinct from hidden tests.
- **Submissions (N):** every submission for this question, newest first, with verdict, time,
  language, run time, and the plain-language explanation of the verdict.
- **Hints (bought / total):** bought hints in full with their price; a "Buy for N" action for the
  next hint; "Every hint is revealed" when none remain; "No hints for this question" if there
  are none.

**Code side:**

- A language selector.
- Reset to template (with a confirmation).
- Text size controls.
- The editor, with syntax highlighting, indentation, bracket matching, undo/redo, find and
  standard shortcuts.
- A save status: Saving… / Saved / **Not saved!**
- A result panel for the newest submission.
- **Submit** (also Ctrl/Cmd+Enter), **Cancel** while judging, and a cooldown countdown.

## 10.4 Drafts: never lose code

1. Editor content is **saved automatically** a moment after typing stops, both to the server and
   to the machine itself.
2. On opening a question, the **newer** of the machine copy and the server copy is loaded.
3. On a different machine, the server copy is loaded, so a machine swap loses at most the last
   moment of typing.
4. If saving to the server fails, the participant sees **"Not saved!"** and a warning ("Draft not
   saved — Check the connection. Your code is still in this window."). Work is never silently lost.
5. With no draft, the editor opens a starter template for the participant's preferred language.
6. Changing language on an empty editor loads that language's template.

## 10.5 Submitting

### 10.5.1 What a submission is

The exact source code, the chosen language, the question, the participant, and **the server time
at which it was received**. It is stored **before** judging starts and kept for the whole contest.

### 10.5.2 A submission is accepted only if all of these hold

| Check | If not (message in substance) |
|---|---|
| The contest is in Auction 1, Coding round 1, Auction 2 or Final round | "submissions are not open" |
| If in Coding round 1 or Final round, its deadline has not passed | "this round has closed" |
| The participant is not blacked out | "you are blacked out for another N seconds" |
| The language is offered | "language 'x' is not offered" |
| The source is at most 256 KB | "source is larger than 256 KB" |
| The participant is not disqualified | "your account is disqualified" |
| The participant **currently owns** the question | "you do not own this question" (never reaches the judge) |
| The participant has **no other submission in flight**, for any question | "your previous submission is still being judged" |
| The participant's **3-second cooldown** has ended | "wait N s before submitting again" |

A refused submission leaves the editor content untouched.

The in-flight limit and cooldown apply **per participant account**. A second browser window or
machine does not allow a second concurrent submission. **They affect only timing, never a participant's points.**
**Why:** they keep the judge responsive for everyone while the no-penalty rule stands.

### 10.5.3 Submitting after solving

Allowed. The question **stays solved**, and its solve time **does not change**. A later wrong
submission never un-solves a question.

## 10.6 While a submission is being evaluated

1. The result panel shows the stage: **Sending to the judge → Queued (waiting for a free slot) →
   Running test k of n**, with a filling progress bar. The bar stays visible even if the panel is
   collapsed.
2. The Submit button reads **"Judging…"** and is unavailable. **Cancel** is offered.
3. The participant **can keep editing** while judging runs.
4. If judging is slow: "Still waiting on the judge. Nothing is lost — it is queued and will be judged."
5. If the connection drops: "Lost contact with the server for a moment. Still trying; your submission is safe."
6. If the judge is restarted or temporarily unreachable, the submission is **automatically sent again**
   from the stored source. The participant never has to resubmit. A submission is **never silently
   dropped or marked failed** because of an infrastructure problem.
7. The order in which testcases run is always the same for a question, so "test 12" means the same
   test on every run and every rejudge.

### Cancelling

- While a submission is in flight, the participant may **Cancel** it.
- It is recorded as **cancelled**: "You cancelled this submission. It was not judged and does not count."
- The **3-second cooldown starts at the moment of cancelling**, so cancel-and-resubmit cannot be used to
  skip the cooldown.
- If the judge's result arrives after the cancel, it is ignored.

## 10.7 Verdicts and what the participant is told

Judging runs **sample tests first, then hidden tests**, and **stops at the first failure**.

The participant is told: the verdict, in plain words; for a failure, the **number** of the failing test
(and the total number of tests); the number of tests passed; the longest run time; and, for a compile
error, the compiler's output (it concerns their own code). They are **never** told the failing test's
input or expected output, or any other internal judging detail. **Not for free, and not for any price.**

| Verdict | What the participant reads |
|---|---|
| **Accepted** | "Every testcase passed. This question is solved, and it stays solved." |
| **Wrong answer** | "Wrong answer on test 7 of 20." If test 7 is a sample: "That is one of the samples — check your output format before your logic." |
| **Time limit exceeded** | "Too slow on test 7 of 20. The logic may be right; the complexity is not." |
| **Memory limit exceeded** | "Used too much memory on test 7 of 20." |
| **Output limit exceeded** | "Printed far too much on test 7 of 20 — check for a stray debug print or a loop that never ends." |
| **Runtime error** | "Crashed on test 7 of 20 — an exception, a bad index, or a non-zero exit code." |
| **Compilation error** | "It did not compile. The compiler's own output is below." |
| **Internal error** | "The judge failed on our side. This is not counted against you — tell an organiser if it happens again." |
| **Cancelled** | "You cancelled this submission. It was not judged and does not count." |

A short on-screen message also announces each verdict by its full name. Abbreviations like "TLE" never
appear on their own.

**How output is compared.** Unless the question says otherwise, output that differs only in spacing or line
breaks is accepted. Questions with decimal answers may accept answers within a stated tolerance. Questions
with yes/no answers may accept any capitalisation. These are properties of the question, fixed by its author.

### After the verdict

- The submission's row appears in the Submissions tab.
- The question's progress becomes **solved** (on Accepted) or **attempted**.
- The **3-second cooldown** starts ("Wait 3s").
- On Accepted, the question's **points reward** is paid to its owner, and points, solved count and (if
  visible) rank update everywhere within about a second. **Coins are not affected:** solving pays points,
  never coins.

## 10.8 Hints

### Rules

1. Hints exist only for questions a participant **owns**, and only the owner can buy them.
2. They are **author-written text**: guidance on how to think about the problem. **Hidden testcases are
   never for sale**, and no hint reveals one.
3. Each hint has **its own price**, shown before buying.
4. Hints **unlock in order**. Hint 2 cannot be bought before hint 1. The screen only ever offers the next one.
5. Buying requires **confirmation with the price stated**: "Reveal hint 1 for 40 coins? This cannot be undone."
6. The price is charged and the hint revealed **together**. The hint appears immediately, and the balance updates.
7. A bought hint **stays visible for the rest of the contest** and is **never charged twice**.
8. **Purchases are final** for the participant.
9. Hints can be bought **at any time the participant owns the question**: during coding rounds and during
   auctions. They do not have to wait for Auction 2.
10. A blacked-out participant cannot buy a hint.
11. Every hint purchase is recorded with who, which hint, the price and the time.

**Why hints are text only.** Paid reveals of failing testcases were designed and then removed. With
unlimited free wrong submissions, a participant could submit garbage, buy each revealed failing test,
hardcode the answers and never solve the problem.

**Why hints can be bought mid-round.** Otherwise someone stuck at minute 12 has 78 minutes of dead time and
coins they cannot use.

### Refusals

| Situation | Outcome |
|---|---|
| Not the owner | "you do not own this question" |
| Balance below the price | Refused: "this hint costs 40; you have 25". Nothing charged. The button is unavailable with the reason |
| No hints left | "there are no more hints for this question" |
| Trying to buy a later hint first | "hints unlock in order; the next one is #2" |
| Double click, or a retry after a dropped connection | The second request finds the hint already bought and returns it **without charging** |

## 10.9 How results affect the participant's contest state

| Event | Effect |
|---|---|
| First Accepted on a question | Question becomes solved; its points reward is added; its solve time (acquisition → this submission's receipt time) joins the total; rank may change |
| Later Accepted on the same question | No change to points or solve time |
| Any non-Accepted verdict | No change to points or time. No penalty |
| Internal error / cancelled | Never counted. Cooldown still starts |
| A rejudge changes verdicts | Standings recompute from the new verdicts; the participant is notified that their verdict changed |
| The question is voided or taken back | The question's points and time disappear from the participant's standing |

## 10.10 Rejudging (participant-facing behaviour)

Organisers may **correct a question during the contest** (for example a wrong expected output).

1. Before publishing a correction, the organiser is shown **how many submissions will be rejudged** and must confirm.
2. **Every submission for that question is automatically rejudged.** The participant does nothing.
3. Verdicts can change in either direction, **including from Accepted to not Accepted**.
4. Earlier verdicts are kept for the record.
5. **Solve time after a rejudge:** the solve time is always measured to the owner's **earliest submission
   whose current verdict is Accepted**. If a rejudge invalidates the first Accepted but a later submission is
   still Accepted, the later one now sets the time.
6. Because each question has one owner, **only that participant is affected**. They keep the question and may
   keep attempting it.
7. The owner's screen updates with the new verdicts, and the owner is told their submissions
   were rejudged. Organisers announce the correction to everyone.
8. The organiser then explicitly chooses, with a reason, to **let the verdicts stand, refund the owner, or void
   the question** (see [09-coins-and-ownership.md](09-coins-and-ownership.md) §9.7.5). This matters when a
   correction lands too late for a realistic re-attempt.

## 10.11 Edge cases specific to submissions

| Situation | Expected behaviour |
|---|---|
| Submission received 1 second before the round's deadline, verdict after it | Judged; counts; solve time uses the receipt time |
| Submission sent 1 second after the deadline | Refused: "this round has closed" |
| Judge down for 2 minutes | Submission stays queued, the screen says it is safe, and it is judged when the judge returns. The participant cannot submit another meanwhile but may cancel |
| Question voided while a submission for it is in flight | The submission may finish judging, but it scores nothing because the question is void |
| Question taken back while its owner's submission is in flight | Same: it no longer counts for them |
| Participant opens a question URL they do not own | "You don't own this question", and nothing about it is revealed |
| Participant submits in another tab while this tab shows the previous verdict | Refused if the other submission is in flight; this tab's history refreshes |
| Blackout lands while a submission is in flight | Judging continues; the verdict is recorded and shown after the Blackout lifts |
| Participant's machine dies mid-judging | The submission continues on the server; on another machine the history shows it |
| The question has no hidden tests beyond samples | Accepted means passing the samples |
| Failing test is a sample | The explanation points to output format |
