# 17. Organiser Controls and Corrections

## 17.1 Principles

1. **Administrators can override anything.** No rule may trap the contest in a bad state: every parameter
   and every automated outcome can be changed.
2. **Every override needs a reason.** A reason of at least a few characters is required before the action is
   applied. It is recorded with the administrator's identity and the time, in the same indivisible step as
   the change.
3. **Affected participants are told.** Any override that changes a participant's coins, questions, bids,
   verdicts, eligibility or standing notifies that participant.
4. **Participants cannot reverse anything.** Only organisers correct outcomes.
5. **Unlimited authority is made defensible by the audit trail.** Organiser decisions are final.
6. **Irreversible or wide actions show their consequence first**: the number of submissions a correction
   will rejudge, phase-advance blockers and warnings, and typed confirmation for a reset.

The rules' list of override powers is: adjust balances, reverse or void a purchase, correct ownership, change
any parameter, close bidding by hand, extend or end a phase, rejudge, void a question, and correct standings.
The controls below implement those powers. Where a power has no dedicated control, see
[22-open-questions.md](22-open-questions.md).

---

## 17.2 Running the contest

| Control | What it does | Rules |
|---|---|---|
| **Advance phase** | Moves to the next phase | Shows blockers and warnings first; warnings must be acknowledged; two organisers advancing together move one phase ([06](06-contest-lifecycle.md) §6.3) |
| **Extend** | Adds 1–600 minutes to a timed phase's deadline | Added to the later of the deadline and now; may reopen a closed round; every screen updates |
| **Open / close registration** | Controls self-registration | Must be closed before leaving Registration |
| **Change settings** | Any contest setting ([06](06-contest-lifecycle.md) §6.8) | Auction mode cannot change during an auction phase. A new starting coins applies to accounts created afterwards. A new duration applies the next time that phase starts |
| **Leaderboard visibility** | Live / frozen / hidden, separately for Phase 1 and Phase 2 | Switching to frozen records the freeze moment |
| **Open / close marketplace** | Allows or stops buying powerups | Held items keep working |
| **Announce** | Sends a message (1–5,000 characters, formatted text) to everyone | Covers every open screen until acknowledged; stays readable |
| **Readiness checklist** | Shows what is not yet ready | See §17.10 |

---

## 17.3 People

| Control | What it does | Rules |
|---|---|---|
| **Create participant** | Adds a participant account by hand, at **any** point in the contest | Starts with 0 points and the current starting coins; gets only the time left in the current phase; nothing else changes for anyone. If created during Phase 2, they are a Phase 2 participant straight away ([06](06-contest-lifecycle.md) §6.7.1) |
| **Create staff** | Adds an administrator or evaluator | Staff never compete |
| **Rename** | Changes a participant's display name | Takes effect everywhere, including leaderboards and the auction record |
| **Reset password** | Sets a new password (8+ characters) | For participants who forget |
| **Remove account** | Deletes an account entirely | **Only during Registration.** Afterwards: "accounts can only be removed during registration; disqualify instead" |
| **Disqualify** | Removes a participant from competition for malpractice | Reason required; persistent banner for them; all their actions refused; removed from leaderboards; cannot be targeted; cannot advance; records kept; notified |
| **Requalify** | Reverses a disqualification | Reason required; notified; standings recomputed |
| **View a participant** | Their full record: balance, ledger, questions, submissions, hints, Phase 1 answers, powerups, audit entries | Staff only |

---

## 17.4 Phase 1

| Control | What it does | Rules |
|---|---|---|
| Create / edit puzzles and hacking questions | Authoring | Any edit removes proven status; edits after Section A opens are recorded with a reason |
| **Self-test** | Proves a question works | Required before publishing ([07](07-phase1-qualifying-round.md) §7.8) |
| **Publish / unpublish** | Makes a question visible or not | Publishing requires proven status |
| **Delete** | Removes an unpublished puzzle | A published one must be unpublished or voided instead |
| **Void** | The question scores for nobody | All totals recompute |
| **Reorder** | Sets the order within a section | Must list every question exactly once |
| **Grade** (also evaluators) | Marks manual answers and explanations, comments, flags | Marks bounded by the question's points |
| **Override a Phase 1 score** | Sets any auto, manual or explanation mark for one participant on one puzzle | Reason required |
| **Select who advances** | Chooses any set of participants | Reason required; revisable until Phase 2 opens; everyone notified |
| **Import / export** | Moves Phase 1 content between contests | Imported questions keep a "proven elsewhere" status if they had one |

---

## 17.5 Phase 2 content

| Control | What it does | Rules |
|---|---|---|
| **Question details** | Title, difficulty, **points reward**, **base coins**, statement, number of samples (0–20), running-order position, hints and their prices | Hints unlock in the order listed |
| **Upload a problem package** | Adds a new version of a question's testcases, limits and correct solution | Never overwrites the live version; must be validated before it can become live |
| **Validate** | Runs the correct solution over every testcase | Reports the specific failing testcase by number; marks the question ready |
| **Make a version live (publish)** | Switches the question to the new version at once | Judging never sees a half-updated question. **During the contest:** shows how many submissions will be rejudged and requires confirmation, then rejudges all of them ([10](10-problems-and-submissions.md) §10.10) |
| **Rejudge a question** | Re-runs every submission for it | Earlier verdicts kept; owner's standing recomputes |
| **Rejudge outcome** | After a rejudge: let verdicts stand / refund the owner / void | Presented explicitly; reason required ([09](09-coins-and-ownership.md) §9.7.5) |
| **Auction running order** | The order questions are offered in Auction 1 (and, for leftovers, Auction 2) | Must list every question once; **fixed once auction lots have been created** |
| **Configure powerups** | Price, duration, enabled, hold limit, purchase limit, usable phases, name, description | Applies to the next purchase or use; landed Blackouts keep their end times |

---

## 17.6 Auction

See [08-auction.md](08-auction.md) §8.8–§8.9 for full behaviour.

Pause · resume · close bidding now · timer off / restart / add or remove seconds · retract the top bid · withdraw a
lot · restore a lot · reorder pending lots · record an offline sale · record an offline unsold result · take a
question back.

The organiser's auction view shows every lot of the round with state, owner and price paid, plus **every
participant's balance and number of questions owned**, so the organiser can see who can still afford what.

---

## 17.7 Coins and ownership

See [09-coins-and-ownership.md](09-coins-and-ownership.md) §9.7 for full behaviour.

| Control | One-line summary |
|---|---|
| Adjust balance | ± any amount; never below zero |
| Assign unsold question | Charge a set price; the participant owns it from now |
| Take back question | Wrong sale, good question → unsold; optional refund of price and/or hints; optional relist |
| Void question | Bad question → gone for everyone; refunds price and hints by default; announced |
| Transfer ownership | Move to another participant; no coins change hands; new owner's solve clock starts now |
| Rejudge outcome: refund | Refund the price; the owner keeps the question |

---

## 17.8 Resetting the contest

A dangerous action, placed apart from everything else, requiring a **typed confirmation phrase** and a reason.

| Scope | Confirmation phrase | Removes | Keeps |
|---|---|---|---|
| **Reset the contest** | "reset the contest" | Every participant account and everything any participant did: answers, attempts, advancement, bids, lots, ownership, hint purchases, ledger, submissions, verdicts, drafts, notifications, announcements, powerup holdings and Blackouts. Sold questions return to unsold | Authored content (questions, hints, Phase 1 questions, problem packages), staff accounts, settings, powerup configuration |
| **Wipe everything** | "wipe everything" | All of the above **plus** all authored content, all problem packages, and the contest settings in [06](06-contest-lifecycle.md) §6.8 other than auction mode and marketplace (back to defaults) | Staff accounts, powerup configuration, auction mode, marketplace open/closed |

After either: the contest is in **Registration** with registration **open**, the auction unpaused, and no leaderboard
freeze. The reset itself is recorded.

---

## 17.9 Exporting and importing the contest setup

**Purpose:** prepare everything in advance (content, order, settings), save it as **one setup file (a zip)**, and on
contest day **import it and start**. It also serves as a backup of the preparation work and a way to rehearse on a
different machine.

### What the setup file contains

| Included | Not included (by design) |
|---|---|
| Contest settings: starting coins, bid increment, countdown, opening window, ownership cap, all four phase durations, Phase 1 selection basis, both leaderboard visibility settings | Anything that happened during a run: participants, balances, bids, lots, ownership, submissions, verdicts, hint purchases, Phase 1 answers and attempts, advancement, notifications, announcements, the audit log |
| The auction running order | |
| The order of Section A and Section B questions | |
| Every Phase 2 question: details, hints and prices, and its problem package (testcases, limits, correct solution), with whether it was validated and live | |
| Every Phase 1 puzzle and hacking question, with whether it was proven and published | |
| **Optionally**, the staff accounts (administrators and evaluators) with their passwords in protected form. The file must then be treated as a credential file | |

**Not currently carried** (so organisers must set these again after importing, or see
[22-open-questions.md](22-open-questions.md)): powerup configuration, auction mode (online/offline), and whether
the marketplace is open.

### Importing

1. An administrator imports the setup file, with a reason.
2. **The import adds; it never deletes.** Nothing already in the contest is removed.
3. **An existing login is never overwritten.** A staff account in the file whose name already exists is skipped,
   with a warning.
4. Settings in the file **replace** the current values of those settings.
5. The auction running order and section orders are restored.
6. **If the contest is in Registration:** anything that was live or published when exported becomes live or
   published again.
7. **If the contest has already started:** content is added, but **nothing is published**, because publishing
   mid-contest would change what participants can see. Nothing that already happened is touched.
8. Content that was **never proven** (not validated or self-tested) is listed. It must be proven on this machine
   before it can be published.
9. The organiser receives a **summary**: settings restored, number of staff, problems, puzzles and hacking questions
   added, how many are proven and published, what was never proven, and any warnings (for example a hacking
   question whose problem package is missing).
10. The import is recorded.

### Contest-day procedure

1. Start from a fresh contest (Registration). A reset or a new installation gives one.
2. Import the setup file and read the summary.
3. Set powerup configuration, auction mode and marketplace state if needed.
4. Check the readiness checklist.
5. Open the doors: participants register.

> **Example.** On 28 September Olivia finishes authoring 25 questions, 12 puzzles and 4 hacking questions, sets the
> running order and prices, and exports "codolympics-setup-2026-09-28.zip" including staff. On 29 September, on the
> hall server, Olivia imports it into a fresh contest. The summary says: settings restored, 3 staff, 25 problems, 12
> puzzles, 4 hacks, 41 proven, 41 published, no warnings. Olivia sets Blackout to 45 seconds, checks readiness, and
> registration begins.

Importing the same setup file twice into one contest: **Undefined** whether content is duplicated. Avoid it. See
[22-open-questions.md](22-open-questions.md).

---

## 17.10 Watching the contest

| View | Shows |
|---|---|
| **Readiness checklist** | Judge reachable · every question has a problem package · every package has contest details · every question validated · Phase 1 questions published · selection basis set · at least one evaluator · participants registered · registration closed before Phase 1. Each with a count and a link to fix it |
| **Health** | Whether the judge is reachable (shown prominently if not) · submissions waiting to be sent · in flight · retrying · internal errors |
| **Judge activity / submissions** | Every submission and hack attempt with **full detail**: source, verdict, failing test, problem version judged, internal judging detail, and the failing testcase's content at the exact version it was judged against. Used to settle "my code works" disputes |
| **Participants** | Balances, questions owned (flagging anyone owning nothing after an auction), disqualification |
| **Both leaderboards** | Full and current, ignoring visibility settings; Phase 1 with submission times and advancement |
| **Grading queue** | Ungraded count and items |
| **Powerup log** | Every purchase, landed Blackout and absorbed Blackout |
| **Audit log** | Every organiser/evaluator action and hint purchase: who, what, target, reason, detail, when |
| **Export results** | Everything, for the record: settings, participants, questions, ownership, ledger, submissions, all verdicts (including superseded ones), hint purchases, Phase 1 content and answers, audit log |

---

## 17.11 What organisers cannot do

- Make an override without a reason.
- Push a balance below zero.
- Give a question two owners, or sell a void question.
- Record an offline sale below the base coins, above the winner's balance, beyond the ownership cap, to a disqualified
  participant, or while paused.
- Remove an account after Registration.
- Switch auction mode during an auction phase.
- Change the auction running order after lots exist.
- Publish a Phase 1 question that has not been proven.
- Move a lot timer into the past (closing is its own action).
- Withdraw a lot that has already been settled.
- Advance past a blocker.
- Compete, or be blacked out.
