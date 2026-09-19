# 21. UX Expectations

What users must understand from the experience. This file prescribes outcomes for comprehension, not visual
design or technology.

## 21.1 Guiding principles

1. **The screen follows the contest.** A participant never has to find the current phase. Their main screen *is* the
   current phase and changes by itself when organisers advance.
2. **Every click that is not the task is lost time.** Participant navigation is minimal and stable. Links never move
   around between phases.
3. **The server decides; the screen explains.** No screen computes eligibility, price or points. It shows what the
   contest decided, including the reason something is unavailable.
4. **Nothing fails silently.** Every failure is visible, and everything that looks successful was successful.
5. **Waiting must not look broken.** Every waiting state says what is happening, what happens next, and that nothing is
   required.
6. **Obstruct, never destroy.** No state (a Blackout, an announcement, a lost connection, a closed round) may discard a
   participant's work or position.
7. **Plain language.** Verdicts, refusals and states use words a first-time participant understands. Abbreviations never
   appear alone.
8. **Works in the hall.** A full-screen locked-down browser with no address bar and no internet. Every function must be
   reachable without an address bar, and nothing may depend on outside resources. Usable at the hall's screen sizes
   without sideways scrolling.

## 21.2 Information that must always be obvious to a participant

On every contest screen, without any action:

- **Current phase** (for example "Coding 1").
- **Time remaining** in that phase, counting down in server time, if the phase has a deadline.
- **Their balance.**
- **Connection trouble**, shown only when there is a problem, persistently, until resolved. Silence means healthy.
- **Disqualification**, as a persistent banner, if it applies.

On the relevant screens:

- **Auction:** what is on offer; that its statement is hidden and why; the highest bid and holder; the **exact next bid
  amount**; which clock is running (opening window vs countdown) and that bidding again restarts it; whether they are
  winning; how far their balance goes; whether the auction is paused or offline and what that means; the whole running
  order with results.
- **Coding:** which of their questions are unsolved, judging, attempted or solved; what to open next; that wrong
  submissions cost nothing; their rank unless hidden.
- **Workspace:** limits, samples, hidden test count, draft save status, submit availability and the reason if unavailable,
  judging progress, verdict in plain words, cooldown remaining, hints bought and the next hint's price.
- **Section A:** answered count, save status per question, format expectations, time left, finished or closed state.
- **Section B:** which solutions they have hacked, points and penalties, each attempt's outcome, time left.
- **Marketplace:** open or closed, balance, items held, what each item does, price and limits, and for every unavailable
  action **one sentence saying why**.
- **Target list:** who is shielded, who is already blacked out, who cannot be targeted; that a Shield absorbs the attack and
  the Blackout is still spent.
- **Leaderboard:** the mode (live/frozen/hidden), and if frozen, as of when; their own position; the tie rule.

## 21.3 Actions must be understandable before they are taken

| Action | What the participant must understand beforehand |
|---|---|
| Bid | The exact amount, that it is binding if they end highest, and that it restarts the countdown |
| Buy hint | The price, that it is final, and which hint number it reveals |
| Finish a section | That it is irreversible, locks their answers, records their tiebreak time, and how many questions are unanswered |
| Submit | The chosen language. That they can keep editing while it is judged |
| Cancel a submission | That it will not be judged and the cooldown starts |
| Buy a powerup | The price, how many they will hold, and whether it is usable now |
| Use a Blackout | Who it targets, the duration, that a Shield would absorb it and it is still spent, that it stacks on someone already out, and, near the end of a coding round, that it is disabled for the last 90 seconds |
| Shield | That there is nothing to activate: it protects automatically while held |
| Register | That the display name is public on leaderboards, that one person means one account, and that the language is only the editor default |
| Sign in | That signing in ends the session on any other machine |

**Confirmation is required** for irreversible actions that cost coins or lock work: buying a hint and finishing a
section. Organiser overrides always require a reason. Reset requires a typed phrase.

## 21.4 Feedback after actions

| Action | Success feedback | Failure feedback |
|---|---|---|
| Bid | "Bid placed: 120. You hold the highest bid. The countdown restarted." Button becomes "You're winning" | "Bid not accepted" and the reason, for example "the next legal bid is 130" |
| Being outbid | "You've been outbid — <title> is now at 130." | — |
| Winning a lot | "You won <title> for 180." The question appears; the balance updates | — |
| Submit | Switches to the submissions view with live stage and progress | "Not submitted" and the reason; the code untouched |
| Verdict | Short announcement with the verdict's full name, plus the full explanation in the panel | — |
| Draft save | "Saved" | "Not saved!" plus a warning: "Check the connection. Your code is still in this window." |
| Section A save | "Saved" | "Not saved" plus the reason (format expectation, closed, blacked out) |
| Hack attempt | "Attempt submitted — Judging", then the outcome badge | "Not submitted" and the reason |
| Hint | "Hint 2 revealed — Balance now 310." The hint is shown | "Not bought" and the reason |
| Buy powerup | "<Name> bought — You hold 2. Balance 700." (or "Already bought" for a repeat) | "Not bought" and the reason |
| Use Blackout | "<Target> is blacked out — Your Blackout landed. You hold 1." or "Blocked by a Shield — …" | "Not used" and the reason |
| Phase change | "Now: <phase>" and the screen changes | — |
| Notification | "For you" with a short text (refund, attack, selection, correction) | — |

Feedback for events caused by others (outbid, attacked, refunded, selected, disqualified, verdict changed) must reach the
participant **without them looking for it**.

## 21.5 What temporary states must communicate

| State | Must communicate |
|---|---|
| **Blacked out** | That they have been blocked; by whom; exactly how long remains (from server time); that several are stacked if so; that nothing is lost; that refreshing will not help. It must cover everything, so no action is possible, and it must not lift until the contest confirms |
| **Judging** | Which stage; progress through tests; that the submission is safe even if slow or the connection blips; that they may keep editing |
| **Cooldown** | Seconds until they can submit again |
| **Auction paused** | That organisers paused it, the clock is stopped, and remaining time will be restored |
| **Opening window vs countdown** | Which clock is running and what happens when it ends (unsold vs sold to the highest bidder) |
| **Timer off** | That the lot closes only by hand |
| **Round closed, not yet advanced** | That the round is over and they are waiting for organisers |
| **Leaderboard frozen** | As of when, and that later results are not shown yet |
| **Connection lost** | That the contest is unreachable, it is retrying, and to raise a hand if it persists |
| **Announcement** | The full message, formatted; that it must be acknowledged; how many more are queued |
| **Waiting screens** (registration, review, not selected, ended) | What is happening now; what happens next; that nothing is required. No buttons that do nothing |

## 21.6 What errors must communicate

Every refusal must say **what** was refused and **why**, in the participant's terms, and where possible **what would make
it work**:

- "You have 90; this costs 150." (not "insufficient funds")
- "the next legal bid is 130" (not "invalid amount")
- "your previous submission is still being judged"
- "wait 2 s before submitting again"
- "you are blacked out for another 42 seconds"
- "hints unlock in order; the next one is #2"
- "n must be at most 100000" (for an invalid hack input, the broken constraint)
- "Expected: four digits, no spaces"
- "this round has closed"
- "that display name is already registered; pick another"
- "Sign-in failed. Check your display name and password." (**never** saying which one was wrong)
- "accounts can only be removed during registration; disqualify instead" (for organisers)

Errors must never reveal protected information: not whether a Section A answer is correct, not how a hack failed, not any
hidden testcase content, and not which sign-in field was wrong.

## 21.7 What must never be ambiguous

1. **Whether a question is solved**, and that it stays solved.
2. **Whether an action succeeded.** A failed submission, bid, save or purchase must never look successful.
3. **Whether coins were spent**, how much, and what the balance is now.
4. **Whether they are blacked out**, and until when.
5. **Whether the auction is paused, offline, between lots, or finished.**
6. **Whether a round is open or closed.**
7. **Whether a leaderboard is live, frozen or hidden.** An empty table must never stand for "hidden".
8. **Whether registration is closed**, rather than a broken form.
9. **Whether they were selected.**
10. **Whether an internal error counts against them.** It never does, and they must be told so.
11. **Whether a failing test was a sample** (a format problem) or hidden.
12. **Whether a Shield needs activating.** It does not.
13. **Whether their Blackout landed or was absorbed.**
14. **Why an action is unavailable.**
15. **That hidden testcases are never for sale.** No screen may imply otherwise.

## 21.8 Organiser and evaluator experience

- A **console**, not a flow: an overview, readiness checklist, health, and quick access to every control.
- **Consequences before commitment**: blockers and warnings before advancing; the number of submissions to be rejudged
  before publishing a correction; validation of offline sale prices before recording; typed confirmation before reset.
- **Every override asks for a reason**, with a sensible default reason text where appropriate.
- **Previews match reality**: an organiser previewing a puzzle, hacking question or problem sees exactly what participants
  will see.
- **Problems are prominent**: an unreachable judge, internal errors, failed validators, participants owning nothing,
  unproven content.
- **Reversible toggles are reversible from where they were made**: pause/resume and timer off/restart sit together.
- **Grading is one pass**: grouped by question, ungraded count visible, names can be hidden, and flags stand out.
