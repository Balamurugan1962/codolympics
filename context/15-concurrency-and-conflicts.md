# 15. Concurrency and Conflicting Actions

Twenty participants and several organisers act at once. This file states the **expected outcome** when
actions collide. It does not say how that outcome is achieved.

## 15.1 General principles

1. **Every action is all-or-nothing.** An action either happens completely or not at all. There is never a
   half-applied bid, a charge without an item, or ownership without payment.
2. **Colliding actions are resolved as if they happened one after the other**, in the order the contest
   received them. The outcome is always one of those orderings, never a blend of two.
3. **The later action always sees the result of the earlier one.** A second purchase sees the balance the
   first left behind. A second bid sees the price the first set.
4. **Rules are re-checked at the moment of acting**, not when the participant last looked at the screen.
   Anything shown on screen may be a moment out of date. The contest's answer at the moment of the action
   is what counts.
5. **Duplicates of the same attempt collapse.** A double click, a retry after a dropped connection, or a
   resubmitted page is one attempt. It is charged or applied once, and the second response reports the first
   result where the product can do so.
6. **A refused action changes nothing** and explains why.
7. **Everyone converges on the same truth within about a second.** Nobody's screen may permanently show a state
   that differs from anyone else's.

## 15.2 Participant against participant

### Two participants target the same participant

> Charlie and Dana each use a Blackout on Alice within the same second. Alice holds no Shield.

**Outcome:** both land. Alice is blacked out for the sum of both durations (60 + 60 = 120 s). Both attackers
see "landed", both Blackouts are spent, and Alice's screen names both.

### Two Blackouts on the same participant, one Shield

> Alice holds 1 Shield. Charlie and Dana attack at the same instant.

**Outcome:** exactly **one** Blackout is absorbed (Alice's Shield count goes to 0) and the **other lands** (Alice
is blacked out for one duration). The attacker processed first is told "Blocked by a Shield", and the other is told
"Alice is blacked out". Both Blackouts are spent. It is **never** the case that one Shield absorbs both, or that
Alice ends with −1 Shields.

### Five simultaneous attacks against two Shields

**Outcome:** two absorbed, three land (stacked, 3 × duration), and Alice ends with 0 Shields.

### A Shield bought at the same moment as an attack on its buyer

> Alice presses Buy Shield. At the same instant Charlie uses a Blackout on Alice.

(A Shield cannot be "activated". The only race is between buying one and being attacked.)

**Outcome:** exactly one of:
- **Purchase first:** Alice holds the Shield when the attack arrives. It is absorbed. Alice is charged for the Shield,
  then the Shield is spent. Alice is not blacked out.
- **Attack first:** the Blackout lands. The purchase then completes (if still allowed), and Alice holds a Shield
  that will protect against the **next** attack. The current Blackout is not shortened.

Which ordering happens depends only on which the contest received first. It is never both, and never neither.

### Two participants attack each other at the same instant

> Charlie uses a Blackout on Dana while Dana uses one on Charlie.

**Outcome:** both actions complete. Neither blocks or waits forever on the other. Both are blacked out, subject to
their own Shields. The product must never get stuck in this situation.

### Two participants bid at the same moment

> Lot at 100. Alice and Bob both press "Bid 110" in the same instant.

**Outcome:** exactly one bid of 110 is accepted (whichever the contest received first). The other is refused with
"the next legal bid is 120", and the refused bidder may bid 120. The countdown restarts once, for the accepted bid.

### Twenty participants bid at once

**Outcome:** exactly one bid is accepted per price step. Every participant sees the same final highest bid and holder,
in the same order.

### A bid arrives exactly as the countdown ends

**Outcome:** decided by server time. Received before the deadline: accepted, and the countdown restarts. Received at or
after it: refused ("bidding on this question has closed"), and the lot sells to the previous highest bidder.

### Two participants register the same display name at once

**Outcome:** exactly one account is created, and the other is told the name is taken.

## 15.3 A participant against themselves

### Double click on Bid

**Outcome:** the first click places the bid. The second is refused ("you already hold the highest bid"). Nothing else changes.

### Double click on Submit, or submitting from two windows at once

**Outcome:** exactly one submission is created and judged. The other is refused ("your previous submission is still being
judged").

### Double click on Buy hint

**Outcome:** exactly one hint is bought and charged. The second request finds that hint already bought and returns it
**free**. It does **not** buy the next hint.

### Double click on Buy (powerup), or a retry after a dropped connection

**Outcome:** one purchase, one charge. The repeated attempt reports "Already bought" with the current holdings.
(Deliberately pressing Buy again is a new attempt and buys another, within limits.)

### Double click on a Blackout target

**Outcome:** one Blackout used, one landing or absorption.

### Buying a hint and a powerup at the same instant with coins for only one

**Outcome:** whichever the contest received first succeeds. The other is refused for insufficient balance. The balance never
goes negative.

### Submitting while blacked out

**Outcome:** refused: "you are blacked out for another N seconds". The submission is not created, the editor content is kept,
and no cooldown starts. (Normally the Blackout screen prevents the attempt at all.)

### A Blackout lands while the participant's submission is being judged

**Outcome:** judging continues. The verdict is recorded and becomes visible when the Blackout screen lifts. The cooldown starts
normally when the verdict arrives.

### A Blackout lands while the participant is typing a Section A answer

**Outcome:** whatever had been saved before the Blackout landed is kept. A save that was still pending is refused, and the answer
shows "Not saved" with the reason. The text on screen is preserved under the Blackout screen. After the Blackout lifts, the
participant's next change saves it, if the section is still open. If the section closed during the Blackout, only what was saved
before counts.

### A submission's verdict arrives at the same moment the participant cancels it

**Outcome:** exactly one of: the cancel wins (the submission is recorded as cancelled and the verdict is ignored), or the verdict
wins (the verdict stands and the cancel has nothing to cancel). The cooldown starts once.

## 15.4 Participants against time

### A temporary effect expires while another is being applied

**Outcome:** see [14-temporary-effects.md](14-temporary-effects.md) §14.2. If the new Blackout arrives while the old one is still
running (by server time), it starts at the old one's end. If it arrives after, it starts now. The participant is never released
and re-blocked in an inconsistent way. At most there is a sub-second lift.

### A Blackout is used at the moment the end-of-round cut-off begins

**Outcome:** decided by server time. Received before *deadline − (duration + duration ÷ 2)*: it is used and lands (or is
absorbed). Received at or after: refused, and nothing is spent. An organiser extending the round at the same moment is
processed in order. If the extension is processed first, the use is judged against the new, later cut-off.

### A phase deadline passes while an answer or submission is on its way

**Outcome:** received before the deadline: accepted and counted. Received at or after: refused. There is no grace period.

### The contest ends while a powerup is active

**Outcome:** the moment the contest is Ended, no Blackout has any effect. Every blacked-out participant's screen lifts within
seconds. Nothing is refunded.

### The contest ends while a submission is being judged

**Outcome:** judging completes, and the verdict counts (the submission was received before the round closed).

### The contest ends while a participant is mid-purchase

**Outcome:** the purchase completes or is refused as a whole, depending on the marketplace being open at that moment. Whether
purchases should be possible after the contest ends is **Undefined** (see [22-open-questions.md](22-open-questions.md)).

## 15.5 Participants against organisers

### An organiser advances the phase while participants are acting

**Outcome:** each participant action is judged entirely against the phase before or entirely against the phase after. An answer
saved "at the same moment" Section A closes is either saved (if it came first) or refused. It is never saved into a closed section.

### An organiser pauses the auction while bids are arriving

**Outcome:** bids received before the pause are accepted, and bids after are refused ("the organisers have paused the auction").
No bid lands "during" the pause.

### An organiser adds time to a lot while its countdown is expiring

**Outcome:** if the extension is received before the deadline, the lot does not sell, and it now ends at the new time. A sale is
never recorded over a deadline that was moved first.

### An organiser closes a lot at the moment the countdown ends

**Outcome:** the lot settles exactly once, and the winner is charged exactly once.

### An organiser retracts the top bid while a new bid arrives

**Outcome:** processed in order. If the new bid came first, the retraction removes the new top bid (the newest one), which may not
be the one the organiser intended. The organiser sees the updated bid list and can act again. If the retraction came first, the new
bid must match the restored next legal amount or it is refused.

### An organiser changes a powerup's duration while a Blackout is being used

**Outcome:** the Blackout uses whichever duration was in effect at the moment it was processed. Blackouts that already landed keep
their end times.

### An organiser switches off the marketplace while a participant is buying

**Outcome:** the purchase is judged against the marketplace's state at the moment it is processed: completed if still open, refused
if already closed.

### An organiser voids a question while its owner's submission is being judged

**Outcome:** the void completes, and the owner is refunded (by default) and notified. The submission may still receive a verdict, but it
scores nothing, because the question is void.

### An organiser takes back a question while its owner is buying a hint for it

**Outcome:** processed in order. Hint first, then take-back: the hint is charged, and then refunded only if the organiser chose "refund
hints". Take-back first: the hint purchase is refused ("you do not own this question").

### A rejudge runs while the owner submits again

**Outcome:** both happen. The new submission is judged normally. The rejudge covers the submissions that existed when it started. Standings
reflect all current verdicts.

### Two organisers advance the phase at the same time

**Outcome:** the contest moves forward exactly one phase. The second organiser is told the contest already moved.

### Two organisers pause the auction at the same time

**Outcome:** it is paused once. The second is told it is already paused.

### Two organisers reorder the same list at the same time

**Outcome:** one complete order wins, and the result is never a mixture of the two. Each reorder must list every item exactly once.

### Two organisers open "the next lot" at the same time

**Outcome:** only one lot is on the block. Never two.

### An organiser records an offline sale while another withdraws the same lot

**Outcome:** exactly one applies. If the sale came first, the lot is sold and cannot then be withdrawn ("take the question back instead").
If the withdrawal came first, the sale is refused ("that question is not on the block").

## 15.6 Judge and infrastructure against everyone

### The judge restarts mid-contest

**Outcome:** submissions in flight are automatically sent again from their stored source. No participant resubmits, and no submission is lost.

### The judge's result for an old attempt arrives after the attempt was superseded (cancelled, rejudged or resent)

**Outcome:** the late result is ignored. It never overwrites a newer state.

### The contest server restarts during an auction

**Outcome:** the current lot, its highest bid and its remaining clock survive unchanged. Bidding continues where it was.

### A participant's machine fails

**Outcome:** they sign in on a spare. Balance, owned questions, hints, submissions, drafts, answers, powerups and any running Blackout are
exactly as the contest holds them.
