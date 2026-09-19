# 5. Complete User Journey

This is the whole day, told mostly from a participant's seat, with what organisers
and evaluators do alongside. Detailed rules for each step live in the files that
follow. This file gives the order and the intermediate states.

Throughout: **the participant's main screen always shows the phase that is open now,
and changes by itself when an organiser advances the contest.** Nobody needs to
refresh.

---

## 5.1 Before the contest

### Organisers (days or weeks before)

1. Author **Section A puzzles**. For each one, prove it works:
   - enter the intended answer for an auto-graded puzzle and confirm it scores full marks;
   - supply entries that should pass and fail for a validator puzzle, and confirm the
     validator agrees;
   - record a model answer for a manually graded puzzle.
   A puzzle cannot be published until it is proven. Any later edit un-proves it.
2. Author **Section B hacking questions**. Supply a known breaking input and confirm
   it is a legal input on which the given solution fails and the correct solution
   succeeds. The question cannot be published until this is proven.
3. Author **Phase 2 coding questions**: statement, difficulty, **points reward**, **base coins**,
   limits, testcases, sample count, hints and prices. Validate each one: the correct
   solution must pass every testcase within the limits.
4. Set the **auction running order**.
5. Configure **powerups**: prices, Blackout duration, hold and purchase limits, usable phases.
6. Set **contest settings**: starting coins, increment, countdown, opening window,
   ownership cap, round durations, leaderboard visibility, auction mode.
7. Write and set the **Phase 1 selection basis**.
8. Create **evaluator** accounts.
9. Check the **readiness checklist**: judge reachable, every question present and
   validated, Phase 1 content published, selection basis set, at least one
   evaluator, participants registered, registration closed before Phase 1.
10. **Export the whole setup as one file** (a zip) once everything is authored, ordered
    and configured. The setup file carries the content and configuration, never
    anything that happens during a run. See
    [17-organiser-controls-and-corrections.md](17-organiser-controls-and-corrections.md) §17.9.

### Organisers (on contest day, before doors open)

1. On the contest machine, starting from a fresh contest in Registration, **import the setup
   file**. Questions, hints, packages, Phase 1 content, the running orders and the settings
   are restored. Items that were live when exported become live again, and staff logins
   come back if they were included.
2. Read the import summary: what was added, what was published, anything never proven, and
   any warnings.
3. Re-check the readiness checklist, then open the doors for registration.

### Participants (before the day)

They are told the rules in advance, including that code is written in the browser with
no personal tools. They are also told how Phase 1 selection will work and whether the
leaderboard will be live, frozen or hidden.

---

## 5.2 When a participant enters

**Contest phase: Registration. Registration: open.**

1. Alice sits at their assigned machine. The product shows a sign-in page with a link to register.
2. Alice chooses **Register** and enters:
   - a **display name** (2–32 characters: letters, digits, spaces, `_` and `.`), which is
     how they appear on leaderboards and must not already be taken;
   - a **password** of at least 8 characters;
   - a **starting language** for the editor, which they can change on any question later.
3. If the name is taken, they are told so and pick another. Nothing else is created.
4. On success their account exists and is **signed in automatically**. Their balance is
   set to the current starting coins, and the change is recorded.
5. They land on the **welcome screen**:
   - "You're in, Alice. Nothing is required of you yet."
   - "Waiting for the organisers to start. Don't refresh — this screen follows."
   - a live clock, the shape of the day (Puzzles → Hacking → Auction → Coding), and
     six key rules.
6. If Alice's machine fails now, they sign in on a spare machine and see the same screen.

**If registration is closed** when someone tries to register, they are told clearly
that registration is closed. A broken or empty form is not acceptable. An organiser
can still add a participant by hand.

**Signing in later:** a participant enters their display name and password. If either
is wrong, they are told that sign-in failed, **without saying which field was wrong**.
After too many attempts in a short time, they are asked to wait. Signing in ends any
session they had open on another machine, and the sign-in page says so.

### Organisers during registration

Olivia watches participants appear. Olivia can rename someone, reset a forgotten password,
or remove an account created by mistake. When the roster is final, Olivia **closes
registration**. The contest cannot move to Phase 1 while registration is open or while
nobody has registered.

**Someone arriving after registration closes** is added by an organiser at any point in the
contest. They start with 0 points and the same starting coins, get only the time left in the
current phase, and change nothing for anyone else. If added during Phase 2 they take part in
Phase 2 straight away. See [06-contest-lifecycle.md](06-contest-lifecycle.md) §6.7.1.

---

## 5.3 When the contest starts (Phase 1)

### Section A opens

1. Olivia advances the contest to **Section A**. Before confirming, Olivia sees blockers
   (for example "no puzzle is published") and warnings, and must give a reason.
2. Section A's deadline is set (default 45 minutes from now).
3. Every participant's screen changes by itself to Section A: a question list with
   progress, one question at a time, and a countdown with a "Submit & finish" control.
   A short on-screen message says the phase changed.
4. If an announcement is posted (for example the selection basis), it covers the screen
   until acknowledged.

### While answering Section A

- Alice moves between questions in any order.
- As Alice types or selects, **the answer saves automatically** within about a second. A
  status line shows "Saving…", "Saved", or "Not saved" (with a warning).
- If an entry has the wrong shape (for example letters where "four digits" are
  expected), it is rejected immediately with the expected format, and nothing is saved.
- Alice is **never told whether an answer is correct** while the section is open.
- Alice may press **Submit & finish**. A confirmation shows how many questions they have
  answered, warns about unanswered ones, and explains that finishing is irreversible and
  records their submission time. After finishing, their answers are locked.
- If the deadline passes, the section closes for everyone. Their answers are recorded
  **as they were saved at that moment**. The screen shows "Section A is closed".

### Section B opens

1. Olivia advances to **Section B** (with a reason). This transition also starts
   automatic scoring of validator-graded Section A answers.
2. Participants see the hacking screen: a list of flawed solutions, each with its
   statement, constraints, points (and a penalty per miss, if any), and the flawed code.

### While hacking

1. Bob reads a given solution, finds a bug, types a test input and presses **Submit hack**.
2. The attempt shows "judging". While it is judging, Bob cannot submit another attempt.
3. The attempt resolves to one of:
   - **invalid input**, naming the constraint the input broke (no points, no penalty);
   - **hacked** (+points the first time Bob breaks this solution; nothing for later hacks
     of the same solution);
   - **did not break it** (minus the penalty, if the organiser set one; default 0);
   - **problem error · not counted** (the question itself is broken).
4. After each result there is a short cooldown before the next attempt.
5. Bob is never told *how* the solution failed or what the correct output was.
6. Bob may **Finish section**, or wait for the deadline.

---

## 5.4 Review, and selection

1. Olivia advances to **Review**.
2. Participants see "Phase 1 is over — Your answers are in". They can view their own
   Phase 1 results (scores per question, evaluator comments, hack points, pending
   items), and the Phase 1 standings if visible.
3. Evaluators mark remaining short answers and explanations in the grading queue,
   grouped by question. Totals with ungraded items are marked **provisional**.
4. Olivia selects who advances from the Phase 1 leaderboard, with a reason, and may revise
   the selection until Phase 2 opens.
5. Each participant is notified: "You have been selected to advance to Phase 2" or "You
   were not selected for Phase 2. Thank you for taking part."
6. A selected participant's review screen changes to "You're through to the auction".

---

## 5.5 Phase 2 begins: Auction 1

1. Olivia advances to **Auction 1**. It cannot open unless registration is closed,
   at least one participant is selected, and every question exists on the judge.
   Unvalidated questions produce warnings Olivia must acknowledge.
2. Every non-void question becomes a lot, in the published running order. The first lot
   opens immediately.
3. **A participant who was not selected** sees "You were not selected for Phase 2. You can
   still follow the contest to the end", with links to their Phase 1 results and the
   leaderboard. They cannot bid, own questions or submit.
4. **A selected participant** sees the auction floor:
   - "Now offering": title, difficulty, points reward, base coins. It states that the question
     text is what is being bought, and that they will read it only if they win.
   - a countdown ring: before any bid, "to open bids" (opening window); after a bid,
     "to close" (bid countdown);
   - highest bid and holder, next legal bid, their balance and how many more steps they
     could afford;
   - one big button: **Bid <next amount>**;
   - a live feed of recent bids with names;
   - the running order with each lot's state, and for sold lots the winner and price.

### Bidding (online)

- Alice presses **Bid 100** on a question with base coins 100. Alice now holds the top bid.
  The countdown restarts, and Alice's button reads "You're winning".
- Bob presses **Bid 110**. Alice's screen shows a "You've been outbid" message. Alice's button
  offers **Bid 120**. The countdown restarts again.
- If nobody bids before the countdown ends, the question is **sold** to the highest bidder.
  The winner is charged exactly their bid and notified ("You won Q7 for 110"). The question
  appears in their questions. Everyone else's balance is unchanged.
- If nobody bids at all within the opening window, the question is **unsold** and the next
  lot opens.
- When every lot has been offered, the floor shows no open lot, and everyone waits for
  Olivia to advance.

### Bidding (offline)

If organisers chose an offline auction, participants see the same board without a
countdown or bid button. They raise their hands in the room. Olivia records each result
("sold to Bob for 137" or "unsold"), and every screen updates at once.

### Working during the auction

Submitting code and buying hints are allowed during auctions, for questions already owned.

---

## 5.6 Solving problems (Coding round 1)

1. Olivia advances to **Coding round 1**. Its deadline is set (default 90 minutes).
2. A selected participant's screen becomes the coding round:
   - a banner naming the next unsolved question with "Open the question";
   - stats: solved count and points, balance, rank (unless the leaderboard is hidden),
     time left;
   - "My questions", unsolved first, each showing difficulty, points reward, coins paid,
     attempts and progress (not started / attempted / judging / solved).
3. If they own nothing, the screen says so plainly: "There is nothing to solve this round.
   Losing every bid is a legitimate outcome."
4. Opening a question shows the **workspace**: the statement on one side, with limits,
   the number of hidden tests and copyable samples, plus tabs for submissions and hints.
   The code editor is on the other side.
5. The editor opens with their saved draft, or a starter template in their preferred
   language. **Drafts save automatically** as they type. If saving fails, they see "Not
   saved!" and a warning, and the code stays in the window.

---

## 5.7 Submitting solutions

1. Alice presses **Submit** (or Ctrl/Cmd+Enter).
2. The submission is recorded with the **server time** it arrived. That time is what
   counts for tiebreaks.
3. If Alice already has a submission in flight, or is in the 3-second cooldown, the
   submission is refused with the reason, and the code is untouched.

## 5.8 While results are being evaluated

- The result panel shows stages: "Sending to the judge" → "Queued — waiting for a free
  slot" → "Running test 4 of 20", with a filling bar.
- The Submit button shows "Judging…" and is unavailable. A **Cancel** option is offered.
- Alice can keep editing while it runs.
- If the judge is slow or temporarily unreachable, Alice is told the submission is safe
  and will be judged. It is never silently dropped.
- When the verdict lands, Alice sees it in plain words. For example: "Wrong answer on test 2
  of 20. That is one of the samples — check your output format before your logic."
  Compiler output is shown for a compile error. An internal error says it is not counted
  against them.
- A 3-second countdown ("Wait 3s") runs before Alice can submit again.
- On **Accepted**: "Every testcase passed. This question is solved, and it stays solved."
  Alice's points, solved count and possibly rank update. Alice may keep submitting. The question
  stays solved, and its solve time stays that of the earliest accepted submission.

### Buying a hint

1. In the Hints tab Alice sees "Hint 1 of 3 · Buy for 40".
2. Alice confirms: "Reveal hint 1 for 40 coins? This cannot be undone."
3. The hint appears immediately and Alice's balance drops by 40. Hint 2 becomes buyable.
4. If the balance is below the price, Alice is told so and nothing is charged.

---

## 5.9 While viewing the leaderboard

- The Phase 2 leaderboard lists rank, name, total points, solved count and total solve time, and
  highlights "You are #3".
- It updates by itself when a question is solved, sold, taken back or voided.
- If frozen, it says "Leaderboard frozen — shown as of 14:30. Results after that are not
  reflected until it is unfrozen."
- If hidden, it says "Standings are hidden", not an empty table.
- No actions start from the leaderboard. It is information only.

---

## 5.10 Interacting with other participants

Participants interact through exactly three things:

1. **The auction**: bidding against each other, and seeing who holds the top bid and who won what.
2. **Leaderboards**: seeing each other's standing.
3. **Powerups**: using a Blackout on someone, and Shields absorbing those Blackouts.

Nothing else is shared. No messages, no code, no hints, no coins.

---

## 5.11 Purchasing or using powerups

1. When organisers **open the marketplace**, participants can visit it. While it is
   closed, it says so and that held items still work.
2. Charlie sees each item: name, description, price, duration (Blackout), hold limit,
   purchase limit progress, how many they hold, and whether it is usable now.
3. Charlie presses **Buy** on a Blackout (price 150). Their balance drops by 150, and they
   hold 1. If buying is not possible, the reason is shown under the item and the button is
   unavailable.
4. During a phase in which Blackout is usable (and, in a coding round, before the cut-off: the last *duration + half
   the duration*, 90 seconds by default, disables it), Charlie presses **Use**. A list of every
   other participant appears, alphabetically, with markers: **shielded**, **already out**
   (currently blacked out) and **out of the contest** (disqualified, cannot be chosen). It
   explains: "They lose their screen for the duration. If they hold a Shield it absorbs
   this instead, and your powerup is still spent."
5. Charlie chooses Alice.
   - **If Alice holds no Shield:** Charlie sees "Alice is blacked out — your Blackout
     landed. You hold 0."
   - **If Alice holds a Shield:** Charlie sees "Blocked by a Shield — Alice had a Shield. It
     absorbed your Blackout — you hold 0."
6. **Shields are never "used".** Buying one is the whole action. While held, the
   marketplace says "Protected. The next Blackout aimed at you is absorbed automatically."

---

## 5.12 When another participant affects you

**Alice, mid-edit in the workspace, is blacked out by Charlie for 60 seconds.**

1. Within about a second, Alice's whole screen is covered by the Blackout screen:
   - "You've been blocked out"
   - "Charlie used a Blackout on you."
   - a large countdown: **1:00**
   - "Nothing is lost. Your work is saved and you will come back to exactly where you were.
     Refreshing or opening another tab will not clear this — the clock is on the server."
2. Alice receives a notification: "Charlie blacked you out for 60 seconds."
3. While blacked out Alice cannot submit, buy hints, answer puzzles or submit hacks. **Bidding is never blocked.**
   The round's clock keeps running, and Alice's solve-time clock keeps running.
4. A submission Alice made **before** the Blackout keeps being judged, and its verdict is recorded.
5. If Dana also blacks Alice out while the first is running, the countdown **grows by 60
   seconds** and the screen shows "2 blackouts stacked · 95s total remaining". It names both attackers.

**If Alice had held a Shield instead,** Alice's screen would not change at all. Alice would
receive a notification: "Charlie tried to black you out. Your Shield absorbed it — 0 left."

---

## 5.13 When temporary effects expire

1. Alice's countdown reaches 0:00.
2. The screen does not lift on the local count alone. It checks with the server.
3. If the server confirms no Blackout is still running, the Blackout screen disappears.
   Alice is **exactly where they were**: same page, same unsaved editor content, same scroll
   position, same half-typed answer.
4. If another Blackout is still stacked, the screen stays, with the new remaining time.
5. If Alice's connection drops while blacked out, the screen **stays up** rather than lifting
   early. Failing safe means remaining blocked, never being released early.

---

## 5.14 Auction 2 and the final round

1. When Coding round 1's deadline passes, submissions close. The phase label stays until
   Olivia advances.
2. Olivia advances to **Auction 2**. Questions still unsold are offered again, one at a
   time, **at the same base coins**, under the same rules. Submitting and hint buying for
   owned questions work again.
3. Olivia advances to the **Final round** (default 60 minutes). It behaves exactly like
   Coding round 1. Newly won questions can be attempted, and all owned questions remain open.

---

## 5.15 When the contest ends

1. When the final round's deadline passes, submissions close.
2. Olivia advances to **Ended**.
3. At that moment **every Blackout stops mattering**. A participant who was blacked out
   is no longer blacked out, and their Blackout screen lifts within a few seconds, at its
   next check with the server.
4. Participants see "That's the contest — Nothing more will be judged. Final standings
   below", with their finishing rank, points and solved count (unless the leaderboard is
   hidden), and a link to final standings.
5. Submissions are refused. A submission received **before** the round closed that is
   still being judged is still judged, and counts.
6. Nobody can bid, answer or hack.

## 5.16 After the contest

1. Organisers typically set the leaderboard to live if it was frozen or hidden, so
   everyone sees final results. This is their choice; the product does not do it
   automatically.
2. Organisers resolve any disputes using the full record: every submission, every
   judgement including superseded ones, the failing testcase at the exact version judged,
   every bid, every purchase and every override with its reason.
3. Organisers export the complete results for publication and the project record.
4. Participants' accounts and history remain until organisers reset the contest for a
   future run.
