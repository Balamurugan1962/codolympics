# 7. Phase 1: The Qualifying Round

## 7.1 Purpose and shape

Phase 1 decides **who takes part in Phase 2**. It tests reasoning and code-reading,
not code-writing, so a strong programmer who reasons badly does not coast through.

- **Section A: Logical Puzzles.** Timed (default 45 minutes). Multiple-choice and
  short-answer questions: pattern and observation, detective and mystery, constraint
  puzzles.
- **Section B: Hacking.** Timed (default 45 minutes). Read a flawed solution and find an
  input that breaks it.
- **Review.** Evaluators finish marking; an administrator selects who advances.

The sections run **strictly in sequence**. Each is opened by an administrator. A break
or a fix can happen between them.

Every registered, non-disqualified participant takes part in Phase 1. Selection has
not happened yet.

Phase 1 points **do not** carry into Phase 2. Everyone who advances starts Phase 2 on
identical coins. Phase 1 **rank** is kept for exactly one purpose: breaking an exact
tie in the final Phase 2 standings.

---

## 7.2 Section A: Logical Puzzles

### 7.2.1 What a puzzle looks like to a participant

- "Question 3 of 12 · detective"
- A title and a body, which may include tables, grids, formatting and code blocks
  (timetables and grids are central to these puzzles).
- Points for the answer, and, if an explanation is requested, "+N reasoning".
- An answer control suited to the answer type.
- If requested, a "Your reasoning" box: "marked by an evaluator, up to N pts".
- A save status: Saving… / Saved / Not saved / Locked.

Participants never see the answer key, model answer or validator.

### 7.2.2 Answer types

| Type | What the participant does | Example use |
|---|---|---|
| **Pick one** | Selects exactly one option | "Who took the laptop?" |
| **Pick several** | Selects any number of options | "Who could have been in the room?" |
| **Short answer** | Types a short answer (up to 500 characters) | Missing number in a grid → `41` |
| **Number** | Types a number | Minimum river crossings |
| **Order** | Puts every listed item in order, each exactly once | Event schedule, Monday to Friday |
| **List** | Adds several entries one by one (up to the question's maximum) | "All possible schedules" |
| **Free text** | Writes freely | "Find as many valid passwords as you can", or a written solution |

A puzzle may also be **explanation-only**: the points come entirely from the written reasoning.

### 7.2.3 Grading modes

| Mode | How it scores | When the score exists |
|---|---|---|
| **Auto** | Compared with the organiser's answer key | Computed each time the answer is saved, **shown only after the section closes** |
| **Validator** | Every distinct entry is checked by an organiser-supplied checker; score = valid distinct entries × points per entry | Computed **after the section closes**, never while it is open |
| **Manual** | Read and marked by an evaluator | When an evaluator marks it |

An explanation is **always** marked by an evaluator, never automatically.

### 7.2.4 How auto grading decides

| Type | Correct when | Partial credit? |
|---|---|---|
| Pick one | The chosen option is the key's option | No |
| Pick several | The set of chosen options equals the key's set | Optional (see below) |
| Short answer | The answer matches **any** accepted spelling, ignoring surrounding spaces, treating runs of spaces as one, and ignoring capital letters unless the question is case-sensitive | No |
| Number | Within the question's tolerance of the key value (default tolerance 0, meaning exact) | No |
| Order | The order is exactly the key's order | No |
| List | The set of entries (normalised as for short answers) equals the key's set | Optional |
| Free text | Never auto-graded | — |

**Partial credit** (pick several, list): each correct selection earns an equal share of
the points, each wrong selection cancels one share, the result is rounded to the nearest
whole point (halves round up), and it never goes below zero.

> Example: 10 points, the key has 4 correct options. Bob picks 3 correct and 1 wrong:
> (3 − 1) ÷ 4 × 10 = **5 points**. Charlie picks all 4 correct and 2 wrong: (4 − 2) ÷ 4
> × 10 = **5 points**. Dana picks 1 correct and 2 wrong: below zero, so **0 points**.

Without partial credit, anything but the exact set scores 0.

### 7.2.5 How validator grading decides

Used for "find as many as you can" puzzles.

1. The participant's entries are collected: each item of a List answer, or each line of a
   Free text answer.
2. Entries are **normalised**: surrounding spaces removed, runs of spaces collapsed, and
   capital letters ignored unless the question is case-sensitive. Empty entries are dropped.
3. **Duplicates after normalising count once.** "Blue Sky" and "blue  sky" are the same entry.
4. At most the question's **maximum entries** are counted (default 100), in the order given.
5. After the section closes, the checker decides for each distinct entry whether it is valid.
6. Score = number of valid distinct entries × points per entry.
7. **If the checker fails to run** (crashes, hangs or exceeds its limits), the answer is
   flagged for an administrator and the participant's total is marked provisional. **It is
   never silently scored 0.**
8. A whole answer larger than 256 KB is refused when saved.

**Why correctness is withheld while the section is open:** live feedback would turn
"find as many as you can" into guessing against the checker.

### 7.2.6 Format checks

An organiser may give a puzzle a **format** (a pattern plus a plain-English hint such as
"four digits, no spaces").

- An entry that does not match is rejected **as it is typed**, with "Expected: four digits,
  no spaces". It is not saved.
- The same check applies when the answer reaches the server. A participant who bypasses
  the screen cannot save a malformed entry.
- A well-formed entry is saved, **with no indication of whether it is correct**.
- In a List answer, adding a duplicate shows "Already added". Adding past the maximum shows
  "At most N entries."

### 7.2.7 Answering rules

1. Questions may be answered **in any order**.
2. Any answer or explanation may be **changed freely** until the section closes or the
   participant finishes.
3. Answers **save automatically** shortly after each change. A failed save shows a visible
   warning. Answers are held on the server, so a refresh or a machine swap restores them all.
4. **No negative marking.** A wrong answer scores 0, never less.
5. An **unanswered** question scores 0. Evaluators can tell "unanswered" apart from
   "answered wrongly".
6. **Finish (Submit & finish):**
   - A confirmation states how many of the questions are answered, warns about unanswered
     ones, and says finishing is irreversible and records the submission time.
   - On confirming, the participant's Section A answers are locked, and the time is recorded.
   - The participant can still read the questions and their locked answers.
7. **When the deadline passes** (whether or not the participant finished): answers are
   locked as last saved. The screen shows "Section A is closed — Your answers are recorded
   as they were when it closed."
8. Blacked-out and disqualified participants cannot save answers.

---

## 7.3 Section B: Hacking

### 7.3.1 What a hacking question looks like

- "Solution 2 of 4", a title, its points, and "−N per miss" if a penalty is set.
- The problem statement and a **Constraints** box: the legal limits on input.
- **The given solution**, read-only, in full, with its language and line count, marked
  "read only — it is wrong somewhere". Reading it is the task.
- A marker if the participant has already hacked it.
- A test input box, a Submit hack button, and the participant's attempts on this solution.

The **correct (reference) solution is never shown**, at any point, to anyone but staff.

### 7.3.2 Submitting a hack attempt

1. The participant submits a **test input**, never code. Maximum 256 KB.
2. It is refused before judging if:
   - Section B is not open, or its deadline has passed;
   - the participant has finished Section B;
   - they have an attempt still being judged ("your previous attempt is still being judged");
   - their previous attempt ended less than 3 seconds ago ("wait a moment before trying again");
   - they are blacked out or disqualified.
3. Otherwise it is recorded and judged. The attempt shows "judging".
4. **A submitted attempt is final.** It cannot be withdrawn or edited.

### 7.3.3 How an attempt is decided

1. **Is the input legal?** It is checked against the question's constraints.
   - If not: **invalid input**, with the broken constraint named, for example "n must be at
     most 100000". It is not a hack and not a failure. **0 points, no penalty.**
2. **Does the given solution fail on it?** The correct solution produces the right answer;
   the given solution is run under the question's limits.
   - Wrong output, too slow, too much memory, or a crash → **hacked**.
   - Correct output within limits → **did not break it**.
3. **Is the question itself broken?** If the correct solution fails on a legal input, or the
   question cannot be judged → **problem error · not counted**: neither a hack nor a failure,
   **0 points, no penalty**.
4. **Judge unreachable:** the attempt stays "judging" and is retried. It is **never** recorded
   as a failed hack.

### 7.3.4 Points for hacking

| Outcome | Points |
|---|---|
| First **hacked** result by this participant on this solution | + the question's hack points |
| Any later **hacked** result by the same participant on the same solution | 0 (reported as hacked) |
| **Did not break it** | − the question's penalty (default 0), for each such attempt |
| **Invalid input** | 0 |
| **Problem error** | 0 |

"First" is **per participant, per solution**. Alice hacking solution 2 does not stop Bob
from scoring for hacking solution 2 too. After Alice has hacked solution 2, Alice's screen
says "You have already broken this solution. Further hacks on it score nothing — move on."

**Why only the first hack scores:** finding the flaw is the achievement. Paying for every
variation would reward farming one bug with near-identical inputs.

### 7.3.5 What the participant is told

- Whether the input was **valid** (and, if not, which constraint it broke).
- If valid, whether the solution was **hacked**.
- The points awarded for the attempt.

They are **not** told how the solution failed (wrong answer / time limit / crash), or what
the correct output was. Otherwise the judge becomes a tool for probing the solution instead
of reading it. Staff see full detail.

### 7.3.6 Finishing and closing

- **Finish section** ends the participant's Section B participation. No more attempts. The
  time is recorded.
- When the deadline passes, Section B closes for everyone. Attempts already received are
  still judged and still score.

---

## 7.4 Marking (evaluators)

1. **One grading queue** contains every manual answer and every explanation, **grouped by
   question**, so one question is marked consistently across all participants.
2. The queue always shows how many items are **ungraded**.
3. For each item the evaluator sees the question, the model answer, the participant's
   answer and explanation, and any existing mark. Participants' names can be hidden while
   marking.
4. The evaluator records a manual mark (0 to the question's points), an explanation mark (0
   to the explanation's points), an optional comment, and optionally a **flag** for an
   administrator. Out-of-range marks are refused.
5. Each mark records who gave it and when.
6. Ungraded items **do not block** advancement. Affected totals are marked **provisional**
   everywhere they appear.
7. Short answers are marked on **the correctness of the reasoning**, not only the final answer.

---

## 7.5 The Phase 1 leaderboard

- Ranks by **total points** across both sections (auto + validator + manual + explanation
  marks + hack points), excluding voided questions.
- **Ties: earlier submission time ranks higher.** A participant's submission time is the
  **later** of their Section A and Section B finish times (whichever they pressed). A
  participant who never pressed Finish ranks **after** everyone on the same points who did.
  If still level, they are listed alphabetically by name. Phase 1 ranks are never shared.
- **Disqualified** participants are listed last, unranked.
- **Provisional** totals carry a marker ("* some items are still being graded").
- **Visibility for participants** is an organiser setting (default hidden). Participants see
  name, points, provisional marker and rank, plus the published selection basis. Staff always
  see everything, including who is advancing.
- **Own results:** once Section A has closed, a participant can **always** see their own total,
  rank, per-question Section A marks and evaluator comments, pending items and hacking points,
  **whatever the leaderboard setting**. It is their own work.

---

## 7.6 Selection: who advances

1. The **selection basis** is published to participants **before Phase 1 begins**, even if it
   is discretionary. The readiness checklist warns if it is empty.
2. During Review (or earlier), an administrator selects **any set** of participants from the
   Phase 1 leaderboard. **There is no automatic top-N.**
3. The selection requires a reason and is recorded.
4. The selection can be **revised** (again with a reason) until Phase 2 opens. Each revision
   replaces the whole set.
5. Every participant is notified of the outcome, selected or not.
6. Auction 1 cannot open unless at least one participant is selected.
7. Evaluators cannot make or change the selection.
8. A participant who was not selected keeps their account and Phase 1 results, sees the "not
   selected" screen during Phase 2, and takes no part in it.
9. A disqualified participant cannot advance.

---

## 7.7 Corrections in Phase 1

Administrators may:

- **Void a puzzle or hacking question.** It scores for nobody, and every total is recomputed
  immediately.
- **Unpublish** a question that should not have gone out.
- **Override any participant's score** on any puzzle (auto, manual or explanation part), with
  a reason.
- **Disqualify** a participant (with a reason), which removes them from the leaderboard and
  prevents them advancing. Their answers and attempts are kept. **Requalify** reverses it, also
  with a reason.
- **Edit** a question after Section A has opened. The edit is recorded with a reason, and the
  question loses its proven status until re-proven.

---

## 7.8 Authoring rules that affect participants

- A Phase 1 question **cannot be published unless proven ready**:
  - auto: the organiser's intended answer scores full marks;
  - validator: entries that should pass do, and entries that should fail do not;
  - manual: a model answer is recorded;
  - hacking: a known breaking input is legal, breaks the given solution, and the correct
    solution handles it.
- **Any edit removes the proven status.** The self-test must be run again.
- Questions imported from a package that was proven elsewhere carry that status, marked as
  proven elsewhere.

**Why:** a draft tiebreak puzzle was once found to have no valid answer at all. Entering the
intended answer and watching it score zero is what catches that before the contest.
