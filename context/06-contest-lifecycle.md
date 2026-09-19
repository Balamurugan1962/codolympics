# 6. Contest Lifecycle and Behaviour

## 6.1 The phases

```
Registration ─► Section A ─► Section B ─► Review ─► Auction 1 ─► Coding round 1 ─► Auction 2 ─► Final round ─► Ended
               └──────────── Phase 1 ────────────┘  └────────────────────── Phase 2 ──────────────────────┘
```

- The contest is in **exactly one** phase at a time.
- Phases only move **forward**, one step at a time, in the order above. There is no
  skipping and no going back. The one exception is a full contest reset, which returns
  to Registration; see [17-organiser-controls-and-corrections.md](17-organiser-controls-and-corrections.md).
- **Only an administrator advances the phase**, and only with a stated reason.
- **Nothing advances by itself.** A deadline passing closes that phase's work. The
  contest stays in that phase, visibly closed, until an organiser advances.

**Why organisers drive every step:** real halls need breaks, fixes, announcements and
recounts between parts. A contest that moved on by itself could not wait for any of
them.

## 6.2 Deadlines and timing

| Phase | Deadline set on entry | Default duration |
|---|---|---|
| Registration | none | — |
| Section A | yes | 45 minutes |
| Section B | yes | 45 minutes |
| Review | none | — |
| Auction 1 | none (each lot has its own clocks; see [08-auction.md](08-auction.md)) | — |
| Coding round 1 | yes | 90 minutes |
| Auction 2 | none | — |
| Final round | yes | 60 minutes |
| Ended | none | — |

Rules:

1. **All timing is server time.** Countdowns on screen are derived from the server's
   clock, never from the participant's computer clock. Two participants whose computer
   clocks differ by a minute still see the same remaining time.
2. A deadline is fixed **when the phase is entered**, as "now + duration". Changing a
   duration setting later does not move a deadline already running. Organisers use
   **Extend** for that.
3. **An action is accepted only if the server receives it before the deadline.** An
   answer, hack attempt or submission arriving at or after the deadline is refused with
   "this round has closed" (or the section equivalent), even if the participant's screen
   still showed a second left.
4. Work that was **received before** the deadline is honoured even if its result arrives
   later. A submission received at 89:59 that is judged at 90:04 counts. A hack attempt
   received before Section B closed is still judged.
5. **Extending** a phase adds minutes to the later of the current deadline and now.
   - Coding round 1 ends at 15:30 and it is 15:10. Extending by 5 minutes moves the deadline to 15:35.
   - The deadline was 15:30 and it is now 15:33, so the round is closed. Extending by 5
     minutes sets the deadline to 15:38 and the round **reopens** until then.
   - Every screen shows the new deadline within about a second.
   - A phase with no deadline cannot be extended.
6. Every phase change and extension is recorded with who, when and why.

## 6.3 Advancing: checks before an organiser confirms

Before advancing, the organiser is shown **blockers** (which prevent advancing) and
**warnings** (which must be explicitly acknowledged). Checks run against the phase the
contest is in at that moment.

| Moving… | Blockers | Warnings |
|---|---|---|
| Out of Registration | registration is still open ("the roster must be final because balances are equal"); nobody has registered | — |
| Into Section A | no published, non-void puzzle ("Section A would open empty") | — |
| Into Section B | no published, non-void hacking question; a published hacking question whose problem is not available to be judged ("every attempt fails") | a hacking question has no proven breaking input |
| Into Auction 1 | no participant has been selected to advance; there are no questions; a question does not exist on the judge | a question has no testcases; a question has not been validated |
| From Ended | the contest has ended; there is no next phase | — |

If two organisers press Advance at the same moment, the contest moves **one** phase.
The second is told the contest already moved while they were confirming.

## 6.4 What happens automatically at each transition

| Transition | Also happens, in the same instant |
|---|---|
| → Section A | Section A deadline set |
| Section A → Section B | Section A is closed for good; every validator-graded Section A answer is queued for scoring; Section B deadline set |
| → Review | nothing else |
| Review → Auction 1 | a lot is created for every non-void question in running order; the first lot opens; the running order can no longer be changed |
| Auction 1 → Coding round 1 | Coding round 1 deadline set |
| Coding round 1 → Auction 2 | a lot is created for every question still unsold; the first opens |
| Auction 2 → Final round | Final round deadline set |
| → Ended | every Blackout stops having any effect |

Every connected screen reflects a phase change **within about a second, without a
refresh**. Participants see a short "Now: Coding 1" message.

## 6.5 What participants may do in each phase

Each ✔ still depends on the other conditions given in the linked files: owning the
question, not being blacked out, not being disqualified, being selected, having the
balance, and so on.

| Action | Reg. | Sec. A | Sec. B | Review | Auc. 1 | Coding 1 | Auc. 2 | Final | Ended |
|---|---|---|---|---|---|---|---|---|---|
| Register (if registration open) | ✔ | | | | | | | | |
| Save / change a Section A answer | | ✔ until deadline | | | | | | | |
| Finish Section A | | ✔ | | | | | | | |
| Submit a hack attempt | | | ✔ until deadline | | | | | | |
| Finish Section B | | | ✔ | | | | | | |
| See own Phase 1 results | | | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Bid (online auction) | | | | | ✔ | | ✔ | | |
| Submit code for an owned question | | | | | ✔ | ✔ until deadline | ✔ | ✔ until deadline | |
| Buy a hint for an owned question | | | | | ✔ | ✔ | ✔ | ✔ | see [22](22-open-questions.md) |
| Buy a powerup (marketplace open) | ✔* | ✔* | ✔* | ✔* | ✔* | ✔* | ✔* | ✔* | see [22](22-open-questions.md) |
| Use a Blackout | only in the Blackout's **usable phases** (default: Coding 1 and Final), and not in the last *duration + duration ÷ 2* of a coding round | | | | | | | | never |
| View leaderboards | per visibility setting, in every phase | | | | | | | | |

\* Buying depends only on the marketplace being open, not on the phase. Organisers
normally open it only during Phase 2.

**Submitting and buying hints are allowed during auctions.** Phases decide when
bidding happens, not when work is allowed. A participant who has run out of coins
in Auction 2 can keep solving instead of watching.

**Gap between a coding round's deadline and the next phase.** After Coding round 1's
deadline passes and before an organiser opens Auction 2, submissions are refused
("this round has closed"). They are accepted again once Auction 2 opens. The same
applies after the Final round's deadline until the contest is ended.

## 6.6 What each person sees in each phase

| Phase | Selected / any participant | Not selected (Phase 2 only) | Staff |
|---|---|---|---|
| Registration | Welcome screen: "You're in", waiting for organisers, live clock, shape of the day, six rules | — | Console: registrations arriving, readiness checklist |
| Section A | Question list with progress, current question, autosave status, countdown, Submit & finish; "Section A is closed" after the deadline | — | Console, submissions arriving, standings |
| Section B | Solutions list with hacked markers, statement + constraints + flawed code, input box, attempt history, countdown, Finish section | — | Console, hack attempts with full detail |
| Review | "Phase 1 is over". If selected: "You're through to the auction". Links to own results and standings | — | Grading queue, Phase 1 standings, selection |
| Auction 1 / 2 | Auction floor (online: ring, bid button, feed; offline: board only); running order | "You were not selected for Phase 2. You can still follow the contest to the end." | Auction control: lot, clocks, controls, all balances |
| Coding 1 / Final | Coding round: next unsolved, stats, my questions; workspace per question | "not selected" screen | Console, submissions, health |
| Ended | "That's the contest", own final rank/points/solved (if visible), link to final standings | "not selected" screen | Console, export |

On every participant screen, always visible: **current phase, time remaining (if
the phase has a deadline), balance, connection status (only when not connected),
and a disqualification banner (if disqualified).**

## 6.7 Registration rules

1. **Who:** anyone at a hall machine, while the contest is in Registration **and**
   registration is open.
2. **What is captured:** display name, password, starting editor language.
3. **Display name:** 2–32 characters of letters, digits, spaces, underscores and full
   stops, starting with a letter, digit or underscore. (A hyphen is refused as an invalid
   name.) It must be unique **ignoring
   capital letters and treating spaces as underscores**: "Alice Smith", "alice smith" and
   "alice_smith" are the same name. A clash is refused with "that display name is already
   registered; pick another".
4. **Password:** at least 8 characters.
5. **On success:** the account exists with the participant role and the **current starting
   balance**, recorded as a ledger entry. The participant is signed in.
6. **Why registration closes before Phase 1:** everyone must start Phase 2 on identical
   coins, so the roster must be final before competition begins.
7. **When closed:** self-registration is refused with a clear message. An administrator can
   still create a participant by hand at any time (see §6.7.1).
8. Two people registering the same name at the same moment: exactly one account is
   created, and the other person is told the name is taken.

### 6.7.1 Adding a participant after the contest has started (late account)

Someone arrives late, or a registration went wrong. An administrator can create a
participant account **at any point in the contest**, with a reason. **The contest itself
does not change** for anyone.

| Aspect | Rule |
|---|---|
| Who can do it | Administrators only. Self-registration stays closed |
| Points | The new participant starts with **0 points** in whatever phase they join. Nothing they missed is credited |
| Coins | The **same starting coins** everyone else started with (the current starting-coins setting) |
| Time | **The running clock is the same for everyone.** The new participant gets only the time remaining in the current phase. No phase deadline moves and no personal timer starts |
| Joining during Section A or B | They can answer or hack for the remaining time. Anything missed scores 0 |
| Joining during Registration | An ordinary participant, exactly as if they had registered themselves |
| Joining during Review | They have no Phase 1 answers; organisers may include or exclude them when selecting |
| Joining during Phase 2 (an auction, a coding round) | They are a **Phase 2 participant immediately**, with no separate selection step. They may bid on lots still to be offered, buy hints and powerups, and submit for anything they come to own. Lots already settled stay settled |
| Phase 1 rank | Whatever their Phase 1 standing computes to (typically last, with 0 points and no finish time). It matters only for an exact Phase 2 tie |
| Leaderboards | They appear with 0 immediately, and are ranked by the normal rules |
| Everyone else | Unaffected: balances, ownership, deadlines, lots and standings do not change |

> **Example.** Coding round 1 is at minute 40 of 90. Erin's laptop failed during registration,
> so their account never existed. Olivia creates "Erin" with a reason. Erin starts with 1,000
> (the same starting coins), 0 points and no questions. Their screen shows Coding round 1 with
> **50 minutes remaining**, the same as everyone. They own nothing yet, so they wait for Auction 2
> to bid.

## 6.8 Contest settings and defaults

| Setting | Default | Notes |
|---|---|---|
| Starting coins | 1,000 | Given at registration. Changing it later does not change existing balances |
| Bid increment (X) | 10 | |
| Bid countdown | 15 seconds | 0 = lots close only by hand |
| Opening window | 30 seconds | Wait for the first bid before a lot goes unsold |
| Ownership cap | none | Max questions owned at once |
| Section A duration | 45 minutes | |
| Section B duration | 45 minutes | |
| Coding round 1 duration | 90 minutes | |
| Final round duration | 60 minutes | |
| Phase 1 selection basis | empty | Readiness checklist flags it until set |
| Phase 1 leaderboard visibility | hidden | |
| Phase 2 leaderboard visibility | live | |
| Auction mode | online | Cannot be changed while an auction phase is running |
| Marketplace | closed | |

Every change is recorded with a reason. Participants see the effect of a visible change
(for example leaderboard mode or marketplace open) within about a second.

## 6.9 Participant access conditions

| Condition | Effect |
|---|---|
| Not signed in | Sees only sign-in and registration |
| Signed in elsewhere since | The old window's session has ended; it must sign in again, and should explain why |
| Not selected for Phase 2 | During Phase 2 sees only the "not selected" screen, own Phase 1 results and leaderboards; cannot bid, own, submit or use powerups. (A participant **created during Phase 2** counts as selected; see §6.7.1) |
| Disqualified | A persistent banner: "Your account has been disqualified. Speak to an organiser." Every contest action is refused; removed from leaderboards; cannot be targeted |
| Blacked out | Covered by the Blackout screen; submissions, hints, Section A saves and hacks refused until it ends. Bidding is never blocked (see [13-powerups.md](13-powerups.md)) |
| Connection lost | After a few failed checks, a red banner: "Connection to the contest server lost — reconnecting. If this stays, raise your hand." On reconnection the whole view is refreshed from the server |

## 6.10 Visibility of content by phase

| Content | Becomes visible to participants | Never visible |
|---|---|---|
| Section A puzzles | When Section A opens, and afterwards read-only | Before Section A |
| Section B hacking questions and flawed code | When Section B opens, and afterwards | Before Section B |
| Own Phase 1 scores | Once Section A has closed | — |
| Phase 1 leaderboard | Per Phase 1 visibility setting | — |
| Phase 2 question metadata (title, difficulty, points reward, base coins) | When it is on the block or in the running order during an auction | — |
| Phase 2 question statement, samples, hint prices | Only to its owner, while they own it | To everyone else, always |
| Hidden testcases | — | To all participants, always |
| Phase 2 leaderboard | Per Phase 2 visibility setting | — |

## 6.11 Boundary conditions

- **A phase change and a participant action at the same instant:** the action is judged
  entirely against the phase before or entirely against the phase after, never a mixture.
  "Section A closed" and "this answer was saved" can never both be true of the same moment.
- **A deadline passing while a participant is mid-typing:** only what the server had
  received before the deadline counts. Autosave runs within about a second of a change, so
  the last second of typing before a deadline may not be saved. The on-screen save status
  shows this.
- **Advancing while work is still being judged:** judging continues after the phase changes,
  and results are recorded.
- **Advancing out of an auction while a question is still on the block:** **Undefined.**
  Organisers are expected to let the current lot settle, or close or withdraw it, before
  advancing. See [22-open-questions.md](22-open-questions.md).
