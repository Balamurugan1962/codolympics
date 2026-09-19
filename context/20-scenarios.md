# 20. Scenarios

Complete worked scenarios. Unless stated otherwise: increment 10, bid countdown 15 s, opening window 30 s,
starting coins 1,000, Blackout 60 s at 150 coins, Shield 120 coins, hold limit 3, Blackout usable in Coding round 1
and Final round, Phase 2 leaderboard live. Times are server time.

---

## S1: A simple Blackout

**Initial state.** Coding round 1, minute 30. The marketplace is open. Alice has 800 coins, 0 points and no powerups.
Bob has no Shield and is editing a solution in their workspace.

**Actions.**
1. 10:30:00 Alice buys a Blackout for 150 coins: 650 coins left, holds 1.
2. 10:30:20 Alice presses Use and sees the target list. Bob is listed with no markers. Alice chooses Bob.

**Expected result.**
- Alice holds 0 Blackouts and sees "Bob is blacked out — Your Blackout landed. You hold 0."
- Bob is blacked out from 10:30:20 to 10:31:20. Within about a second, Bob's screen is covered: "You've been
  blocked out · Alice used a Blackout on you · 1:00". Bob is notified: "Alice blacked you out for 60 seconds."
- Bob's submissions, hint purchases and so on are refused until 10:31:20. The round deadline does not move.
- At 10:31:20 Bob's countdown reaches 0:00. The screen checks with the contest and lifts. Bob is back in the same
  workspace with the same unsaved code.

**Final state.** Alice: 650 coins, 0 Blackouts, points unchanged (buying and using a powerup never touches points). Bob: unaffected except for 60 lost seconds. The powerup log shows a purchase
and a landed Blackout.

---

## S2: A Shield absorbs an attack

**Initial state.** Coding round 1. Bob bought a Shield earlier (holds 1). Charlie holds 1 Blackout.

**Actions.** Charlie opens the target list, where Bob is marked **shielded**. Charlie uses the Blackout on Bob anyway.

**Expected result.**
- Absorbed. Charlie holds 0 and sees "Blocked by a Shield — Bob had a Shield. It absorbed your Blackout — you hold 0."
- Bob holds 0 Shields. Bob's screen does not change. Bob is notified: "Charlie tried to black you out. Your Shield
  absorbed it — 0 left."
- Bob is no longer marked shielded for anyone.

**Final state.** Neither item remains. Bob lost no time. Nothing is refunded to anyone.

---

## S3: Two Blackouts stack

**Initial state.** Final round. Alice holds no Shield. Charlie and Dana each hold a Blackout.

**Actions and timing.**
1. 14:00:00 Charlie blacks out Alice: 14:00:00 → 14:01:00.
2. 14:00:25 Dana blacks out Alice. The target list showed Alice as "already out".

**Expected result.**
- Dana's Blackout starts at 14:01:00 and ends at 14:02:00.
- At 14:00:25 Alice's countdown jumps from 0:35 to **1:35**, with "2 blackouts stacked · 95s total remaining" and
  "Charlie and Dana used Blackouts on you."
- At 14:01:00 the countdown simply continues. The screen does not lift in between.
- At 14:02:00 it lifts.

**Final state.** Alice lost 120 seconds in total. Both attackers hold 0.

---

## S4: Simultaneous attacks against one Shield

**Initial state.** Coding round 1. Alice holds 1 Shield. Charlie and Dana each hold 1 Blackout.

**Actions.** At the same instant, Charlie and Dana both use a Blackout on Alice.

**Expected result.** The contest processes them one after the other.
- Suppose Charlie's is processed first: absorbed, and Alice's Shield count goes to 0. Charlie sees "Blocked by a Shield".
- Dana's is processed second: Alice holds no Shield, so it lands for 60 seconds. Dana sees "Alice is blacked out".
- Alice receives two notifications, one per attempt, and the Blackout screen names Dana.

**Never:** both absorbed by one Shield, Alice at −1 Shields, or both landing while a Shield remains.

**Final state.** Alice: 0 Shields, blacked out 60 s. Charlie: 0. Dana: 0.

---

## S5: Buying a Shield at the moment of an attack

**Initial state.** Coding round 1. Alice has 400 coins and no Shield. Charlie holds a Blackout.

**Actions.** Alice presses Buy Shield at the same instant Charlie uses a Blackout on Alice.

**Expected result.** Exactly one of two outcomes:
- **(a) Purchase processed first.** Alice is charged 120 coins (280 left) and holds 1 Shield. The Blackout is absorbed:
  Shield 0, Alice not blacked out. Charlie sees "Blocked by a Shield".
- **(b) Attack processed first.** Alice is blacked out for 60 s. The purchase then completes (balance 280, 1 Shield) and
  protects against the **next** attack only. The current Blackout keeps running.

**Final state (a).** 280 coins, 0 Shields, not blacked out. **(b).** 280 coins, 1 Shield, blacked out until +60 s.

---

## S6: The end-of-round cut-off

**Initial state.** Coding round 1 ends at 11:30:00. Blackout duration 60 s, so Blackouts are disabled from
**11:28:30** (the last 60 + 30 = 90 seconds). Dana and Charlie each hold a Blackout. Bob holds no Shield and is
about to submit.

**Actions.**
1. 11:28:20 Dana blacks out Bob. It is before the cut-off, so it lands: 11:28:20 → 11:29:20.
2. 11:28:35 Charlie opens the marketplace. Use is unavailable: "Blackouts are disabled for the last 90 seconds of
   the round." Charlie tries anyway and is refused. Charlie still holds the Blackout.
3. 11:29:20 Bob's screen lifts. Bob submits at 11:29:25, and it is Accepted.

**Expected result.**
- Bob lost 60 seconds but still had 40 seconds of the round left, which is the purpose of the cut-off.
- Charlie's Blackout is not spent and can be used in the Final round (subject to that round's cut-off).
- If Olivia had extended the round by 5 minutes at 11:29:00 (new deadline 11:35:00), Blackouts would have been
  usable again until 11:33:30.

**Final state.** Bob solved in Coding round 1. Dana holds 0 Blackouts. Charlie holds 1.

---

## S7: A Blackout still running when the phase changes early

Apart from the undecided stacking case, a landed Blackout always ends before its round's deadline. It can only still be running at a phase change if an
organiser advances **before** the round's deadline.

**Part A: into an auction.** Coding round 1's deadline is 11:30:00, but everyone has finished, so Olivia advances to
**Auction 2** at 11:20:10. Charlie had blacked out Alice at 11:19:40 (until 11:20:40).

**Expected result.** Alice stays blacked out until 11:20:40, but **Alice can still bid** on the first lot, because a
Blackout never blocks bidding. Submissions and hint purchases stay refused until 11:20:40. How Alice's Blackout screen
and the auction floor appear together is **Undefined** (see [22-open-questions.md](22-open-questions.md)). Charlie
cannot use a new Blackout during Auction 2.

**Part B: into Ended.** The Final round's deadline is 15:00:00. At 14:50:00 Dana blacks out Bob (until 14:51:00). At
14:50:20 Olivia ends the contest early.

**Expected result.** From 14:50:20 Bob is no longer blacked out, because the contest has ended. Bob's screen lifts within a
few seconds and shows "That's the contest". Nothing is refunded to Dana.

---

## S8: An ordinary online auction lot

**Initial state.** Auction 1. Lot 3 "Graph Walk", Medium, 200 points, base 150. Alice 1,000 coins, Bob 900, Charlie 300.

**Actions and timing.**
1. 09:10:00 Lot 3 opens. The ring shows 30 s "to open bids".
2. 09:10:12 Charlie bids 150. The ring switches to 15 s "to close". Charlie's button shows "You're winning".
3. 09:10:20 Bob bids 160. Charlie sees "You've been outbid — Graph Walk is now at 160". The countdown restarts.
4. 09:10:22 Alice and Charlie both press "Bid 170" at the same instant. Alice's is received first and accepted. Charlie's
   is refused: "the next legal bid is 180".
5. 09:10:30 Charlie bids 180.
6. No further bids. 09:10:45 the countdown reaches zero.

**Expected result.**
- Sold to Charlie for 180 coins. Charlie's coins go from 300 to 120, Charlie now owns Graph Walk (acquired 09:10:45), and
  Charlie is notified "You won Graph Walk for 180".
- Alice and Bob's balances are unchanged.
- The running order shows "sold 180 · Charlie". Lot 4 opens within about a second.

**Final state.** Charlie 120 coins and owns Graph Walk (its 200 points arrive only if Charlie solves it). Alice 1,000. Bob 900.

---

## S9: Pause in the middle of a countdown

**Initial state.** Auction 1, lot 5, Bob holds the top bid, with 6 seconds left at 09:20:00.

**Actions.**
1. 09:20:00 Olivia pauses (reason: "Projector failed").
2. 09:20:01 Alice tries to bid and is refused: "the organisers have paused the auction".
3. 09:23:00 Olivia resumes.

**Expected result.**
- During the pause: the ring shows "paused", nothing settles, no lot opens.
- On resume the lot has 6 seconds again, closing at 09:23:06.
- If no one bids, Bob wins at 09:23:06.

---

## S10: Offline auction with a jump bid and a mistake

**Initial state.** Auction 2, **offline** mode. Lot 1 "Prime Paths", base 100. Dana has 140 coins. Bob has 600.

**Actions.**
1. The room bids. The auctioneer calls "137 to Dana". Olivia records a sale: Dana, 137. It is accepted (above base, within
   Dana's balance). Dana's balance is 3.
2. The auctioneer realises Bob had called 140 first. Olivia takes Prime Paths back from Dana (refund price: yes, refund
   hints: no, relist: yes, reason "recorded the wrong winner").
3. Prime Paths returns to the end of the queue. When it opens again, the room bids and Olivia records Bob at 140.

**Expected result.**
- Dana: 3 → 140 coins (refund). Dana is notified with the reason. Prime Paths disappears from Dana's questions.
- Bob: 600 → 460 coins. Bob owns Prime Paths, acquired when the second sale was recorded.
- The record shows both sales, the take-back and the reasons.

---

## S11: Solving, a hint, a sticky solve and the tiebreak

**Initial state.** Coding round 1 starts 10:00. Alice owns Q1 (points reward 100, acquired 09:05) and Q2 (points reward 200, acquired 09:40),
and has 400 coins.

**Actions.**
1. 10:02 Alice submits Q1: Wrong answer on test 1 (a sample). The explanation mentions output format.
2. 10:03 Alice submits again 2 s after the verdict and is refused: "wait 1 s". Alice submits again at 10:03:05: Accepted.
3. 10:20 Alice buys hint 1 for Q2 (50 coins). 350 coins left.
4. 10:45 Alice submits Q2: Accepted.
5. 10:50 Alice submits Q2 again, experimenting: Wrong answer.

**Expected result.**
- Q1 solve time: 10:03:05 − 09:05 = 58 min 5 s. Q2 solve time: 10:45 − 09:40 = 65 min. Total 123 min 5 s. **300 points**, and coins unchanged by solving.
- The 10:50 Wrong answer changes nothing. Q2 stays solved.
- The two earlier wrong or refused submissions add nothing.

---

## S12: A rejudge after a broken testcase

**Initial state.** Coding round 1. Bob owns Q7 (acquired 09:30). Bob's submissions on Q7: #1 at 10:10 Accepted, #2 at
10:40 Accepted.

**Actions.**
1. 11:00 Olivia fixes a wrong expected output in Q7 and publishes the correction. Olivia is shown "2 submissions will be
   rejudged" and confirms.
2. Rejudge results: #1 Wrong answer on test 9, #2 Accepted.
3. Olivia chooses "let the verdicts stand" (reason: "enough time to re-attempt").

**Expected result.**
- Q7 is still solved, but the solve time now runs to #2: 10:40 − 09:30 = 70 min (was 40 min). Bob's rank may drop.
- The old verdicts are kept for the record. Bob's screen updates, and Bob is notified that the verdicts stand.
- Organisers announce the correction.

**Variant.** If both became Wrong answer, Q7 is no longer solved. If there are only 5 minutes left, Olivia might choose
"refund" (Bob keeps Q7 and gets the price back) or "void" (Q7 leaves the contest, and Bob is refunded price and hints).

---

## S13: Voiding a question

**Initial state.** Coding round 1. Charlie owns Q4 (paid 180 coins, points reward 250) and bought hint 1
(40 coins). 80 coins left, and Charlie has solved Q4, so its 250 points are theirs.

**Actions.** Olivia voids Q4 (reason "no valid answer exists"), with the default refunds.

**Expected result.**
- Charlie: +220 coins (300), and **−250 points**, because a void question pays nobody. Notified: "Q4 was voided by the organisers and 220 was refunded to you. Reason: …"
- Q4 disappears from Charlie's questions, and its points and solve time leave Charlie's standing.
- Everyone sees the announcement "Question Q4 has been voided. …"
- Q4 is never offered in Auction 2.

---

## S14: Submitting while blacked out

**Initial state.** Coding round 1. Dana has just been blacked out (50 s left).

**Actions.** Dana's page is covered, so the product offers no way to submit. Suppose a submit request reaches the
contest anyway by bypassing the screen.

**Expected result.** Refused: "you are blacked out for another 50 seconds". No submission is created, no cooldown starts,
and the code is kept. When the Blackout ends, Dana submits normally.

---

## S15: A submission in flight when the Blackout lands

**Initial state.** Final round. Bob submits Q2 at 13:10:00. Judging is on test 4 of 30.

**Actions.** 13:10:03 Alice blacks out Bob for 60 s.

**Expected result.** Judging continues. At 13:10:09 the verdict (Accepted) is recorded. Bob's points and solve time update,
using submission time 13:10:00. The leaderboard shows it to everyone at once. Bob sees the verdict when the screen lifts at
13:11:03.

---

## S16: A late participant during Coding round 1

**Initial state.** Coding round 1 is 40 minutes into 90. Erin never registered. Starting coins are 1,000.

**Actions.**
1. Olivia creates participant "Erin" (reason "arrived late — bus"). Erin signs in.
2. Olivia advances to Auction 2 when the round ends. Erin bids on the leftover lots.

**Expected result.**
- Erin: 0 points, 1,000 coins, no questions, and **50 minutes** remaining in Coding round 1, the same deadline as everyone.
- Erin's screen shows the coding round with "You own no questions". Erin does **not** see a "not selected" screen, because an
  account created during Phase 2 is a Phase 2 participant.
- Erin appears on the Phase 2 leaderboard with 0.
- In Auction 2 Erin bids like anyone else. Nothing about other participants changed.

---

## S17: Not selected

**Initial state.** Review. 20 participants. The selection basis was "top 12 by Phase 1 points, conduct permitting".

**Actions.** Olivia selects 12. Dana (rank 13) is not selected.

**Expected result.**
- Dana is notified "You were not selected for Phase 2. Thank you for taking part."
- When Auction 1 opens, Dana sees "You were not selected for Phase 2. You can still follow the contest to the end", with links to
  Dana's Phase 1 results and the leaderboard. Dana cannot bid, own, submit or use powerups.

---

## S18: Phase 1 hacking with a penalty

**Initial state.** Section B. Solution 2 is worth 30 points with a 5-point penalty per miss.

**Actions (Bob).**
1. Input violates "n ≤ 10^5": invalid input, "n must be at most 100000". 0 points.
2. A valid input that the solution handles: did not break it. −5.
3. A valid input that makes it time out: hacked. +30. Bob is told "hacked", not "time limit".
4. A slightly different breaking input: hacked. 0 points; "already broken" message shown.

**Expected result.** Bob's hacking points on solution 2: −5 + 30 = **25**. Alice hacking solution 2 later still earns 30.

---

## S19: Section A with a validator question

**Initial state.** Section A. Puzzle 9 is "find valid passwords", 2 points per valid entry, max 100 entries, case-insensitive,
format "8 letters".

**Actions (Charlie).** Charlie adds "ABCDEFGH", "abcdefgh", "abc" (rejected as typed: "Expected: 8 letters"), and 40 more entries.
Nobody is told which are valid. The section closes, then the checker runs.

**Expected result.** "ABCDEFGH" and "abcdefgh" count once. Suppose 30 distinct entries are valid: 60 points. If the checker had
crashed, Charlie's total would be marked provisional and the answer flagged, not scored 0.

---

## S20: Contest-day setup import

**Initial state.** A fresh installation on the hall server, in Registration. Olivia has "codolympics-setup-2026-09-28.zip" exported
with staff included.

**Actions.** Olivia imports it (reason "contest day setup").

**Expected result.** Settings, running orders, 25 questions with hints and packages, 12 puzzles and 4 hacking questions are added.
Everything that was live or published is live or published again. Evan's evaluator login exists. The summary lists counts and
warnings. Powerup configuration, auction mode and marketplace state must be checked separately. No participant, bid or submission
comes from the file.

---

## S21: Rank changing while watching the leaderboard

**Initial state.** Coding round 1. Alice is #2 with 300 points and 28 min, and has the leaderboard open. Bob is #3 with 200.

**Actions.** Bob's submission on a 200-point question is judged Accepted (Bob's total 400).

**Expected result.** Within about a second, Alice's table reorders by itself: Bob #2, Alice #3. The "You are #3" banner updates. No refresh.

**Variant (frozen at 10:30).** Bob's submission was received at 10:35. Participants see no change until the leaderboard is unfrozen.
Staff see it immediately.

---

## S22: Contest ends mid-interaction

**Initial state.** Final round, deadline 15:00:00. At 14:59:59.6 Charlie submits. Alice is on the hint
confirmation dialog.

**Actions.** 15:00:00 the round closes. 15:01:00 Olivia advances to Ended.

**Expected result.**
- Charlie's submission (received before 15:00:00) is judged, and its verdict counts.
- No Blackout can be running: the last one usable in the round had to be used before 14:58:30 and ended by 14:59:30 (apart from the undecided stacking case in [22-open-questions.md](22-open-questions.md)).
- Alice's hint purchase: if confirmed before 15:01:00 it completes as a normal hint purchase. After Ended: **Undefined**.
- Everyone sees "That's the contest" and final standings (if visible).
