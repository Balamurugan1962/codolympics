# 8. The Auction

## 8.1 Why the auction exists

The auction turns "can you solve problems" into "can you judge which problems are worth
your coins and your time". Because each question has exactly one owner, the auction is
the only way to get anything to solve, and the only place where participants compete
for the same thing.

There are two auction phases:

- **Auction 1** offers **every non-void question**, in the published running order.
- **Auction 2** offers **every question still unsold**, at the **same base coins**,
  under the same rules. Waiting is not rewarded with a lower price. It is already
  punished by lost solving time.

## 8.2 The load-bearing rules

1. **One question at a time.** At most one question is on the block at any moment.
   Questions are never auctioned in parallel.
   - *Why:* a participant's whole balance is always available for the question in front of
     them, so coins never needs to be reserved and nobody can commit the same coins to two
     questions.
2. **The running order is set by organisers and published before bidding starts**, so
   participants can plan a budget across the whole set.
3. **What is shown about a question at auction:** title, difficulty, points reward, base coins.
   **The statement is never shown**: it is what is being bought.
4. **The highest bid when bidding closes wins**, and exactly that amount is charged.
5. **Ownership is exclusive and permanent from the participant's side.** Nobody else may read,
   attempt or score from the question. The winner cannot sell it back, swap it or refuse it.
6. **Bidding moves no coins.** Only winning does.
7. **All outcomes are final for participants.** Only an organiser correction can change
   one (see §8.9).
8. **Nothing is transferable.**

## 8.3 Auction modes

Organisers choose, in settings, how auctions are run. **The choice cannot change while an
auction phase is running.** A round is either entirely online or entirely offline.

| | Online | Offline |
|---|---|---|
| Who bids | Participants, from their machines | The room, out loud, to an auctioneer |
| What decides a sale | The bid countdown running out | An organiser recording the result |
| Clocks | Opening window and bid countdown | None |
| Participant screen | Question, countdown ring, highest bid and holder, next bid, balance, bid button, live bid feed, running order | Question, base coins, "in the room" marker, balance, running order. No ring, no button, no feed |
| Price rules | Base coins, then exact increments | Any whole amount **at or above** the base coins |

## 8.4 Lots and the running order

Each question offered in an auction becomes a **lot**:

```
pending ──opens──► open ──sold──► closed
   ▲                │
   │                ├──no sale──► unsold
   │                │
   └──restore── withdrawn ◄──withdraw (organiser)──┘  (a pending lot can also be withdrawn)
```

- When an auction phase starts, lots are created for the eligible questions in running order,
  and the first one opens immediately.
- **As soon as no lot is open** (and the auction is not paused), the next pending lot opens
  within about a second.
- When no pending lot remains, the auction floor shows no open question. The contest stays in
  the auction phase until an organiser advances.
- The running order screen lists every lot with its position, title, difficulty, points reward, base
  price and state: now / sold (with price and winner) / unsold / withdrawn / to come.
- **Sale results are public:** every participant can see who won each question and for how much.

## 8.5 Online bidding in detail

### 8.5.1 The next legal amount

- Before anyone bids: **the base coins**.
- After a bid: **the current highest bid + the increment** (default 10).
- A bid of any other amount is refused with "the next legal bid is N". Participants cannot
  jump-bid.

> Base coins 100, increment 10. Bids must go 100, 110, 120, 130… The screen always offers
> exactly one amount.

### 8.5.2 A bid is accepted only if all of these hold

| Check | Refusal message (in substance) |
|---|---|
| The participant is not disqualified | "your account is disqualified" |
| The auction is online | "bidding for this contest happens in the room, not here" |
| The auction is not paused | "the organisers have paused the auction" |
| The lot is open **and** its running clock has not reached zero | "bidding on this question has closed" |
| The participant does not already hold the highest bid | "you already hold the highest bid" |
| The amount is exactly the next legal amount | "the next legal bid is N" |
| The amount is not more than the participant's balance | "you have B; this bid is N" |
| Winning would not exceed the ownership cap (if one is set) | "you already own the maximum of N questions" |
| The participant was selected for Phase 2 | not eligible to bid |

A refused bid changes nothing: not the lot, not the clock, not the balance.

The screen reflects the same checks in advance. The button is unavailable and says why:
"Paused", "You're winning", or "You'd need 30 more". The screen is a convenience; the rules
hold even if a participant bypasses it.

### 8.5.3 The clocks

Each open lot has **one live clock**:

1. **Opening window** (default 30 seconds) runs from when the lot opens until the **first** bid.
   - If it reaches zero with no bid, the lot closes **unsold** and the next lot opens.
   - The ring is labelled "to open bids".
2. **Bid countdown** (default 15 seconds) starts at the first bid and **restarts from the full
   duration on every new bid**.
   - If it reaches zero with no newer bid, the lot is **sold** to the highest bidder.
   - The ring is labelled "to close" and visibly refills on each bid.

**Why the countdown restarts:** with a fixed timer the auction becomes a reflex contest decided
by who clicks last. With a restarting countdown, bidding last never wins by timing alone; only
bidding highest wins.

**A bid arriving after the clock reached zero is refused**, even if the sale has not yet been
recorded. The clock is the rule, not the moment the sale appears on screen.

**If the bid countdown is set to 0,** lots do not close by themselves after bids. They stay open
until an organiser closes them, and the ring reads "manual close".

### 8.5.4 What participants see and are told

- A bid they place: "Bid placed: 120. You hold the highest bid. The countdown restarted."
- When they lose the lead: "You've been outbid — Q7 is now at 130."
- When they cannot afford the next bid: "not enough for the next bid" / "You'd need 30 more".
- While they lead: "Nobody has outbid you. If the ring empties, the question is yours."
- Before any bid: "Be the first: the countdown starts on the first bid."
- When they win: a notification "You won Q7 for 130". The question appears in their questions,
  and their balance drops by 130.
- When they lose a lot: nothing changes for them. Their balance was never touched.
- Every change to the auction reaches every screen **within about one second**, in the same
  order for everyone.

## 8.6 Offline auctions in detail

1. A lot opens with **no clock**. It stays open until an organiser records its result.
2. The room bids out loud. The auctioneer runs the room.
3. An organiser records either:
   - **a sale**: the winner and the price; or
   - **unsold**: nobody bid, or nobody bid enough.
4. **The product refuses only the impossible.** A sale is refused if:
   - the price is **below the base coins** ("the base price is 100 coins"). The base price was
     published, and a lower sale is a different deal from the one bid on;
   - the price is **more than the winner's balance** ("they have 120, and this sale is 137");
   - the winner is **disqualified**;
   - the sale would exceed the **ownership cap**;
   - the auction is **paused** ("resume it before recording a sale");
   - the lot is not open.
5. **Above the base coins, any whole amount is accepted.** A jump bid of 137 on a 100 base is
   whatever the room called. The online increment does not apply to a hall.
6. A recorded sale charges the winner, grants ownership, notifies the winner and updates every
   screen, exactly as an online sale does. The record of the sale is identical whichever way it
   happened.
7. The next lot opens immediately after a result is recorded.
8. Participants' offline screen: "The auctioneer runs this in the room. Bid out loud; an organiser
   records each sale and this board follows." It shows each participant's own balance, never
   anyone else's. The organiser recording sales sees everyone's balance and question count, so
   they can tell who can afford what.

## 8.7 Settlement: what "sold" and "unsold" do

**Sold** (online countdown ended, organiser closed it, or offline sale recorded):

1. The winner's balance is reduced by exactly the winning price, in one indivisible step with
   everything below.
2. The winner becomes the question's **sole owner**. The moment of acquisition is recorded; solve
   time is measured from it.
3. The lot becomes closed, and the question's status becomes sold.
4. The winner is notified. Every screen updates the running order and the leaderboard.
5. The next lot opens.

**Unsold** (opening window ended with no bid, organiser closed a lot with no bids, or offline
unsold recorded):

1. No coins change hands and no ownership is created.
2. The lot closes as unsold. The question stays unsold and **will be offered again in Auction 2**
   (if this was Auction 1).
3. The next lot opens.

## 8.8 Pause and resume

Organisers can **pause the whole auction**, for example for a projector failure or an argument
about a bid.

- While paused: **no bid is accepted, no lot settles, no new lot opens, and offline sales cannot
  be recorded.**
- Participants see "Paused" on the button and "The organisers have paused the auction. The clock is
  stopped and nothing is lost — bidding resumes with the time that was left."
- The pause takes effect exactly between bids. No bid can land "during" the moment of pausing.
- **On resume, every running clock gets back exactly the time the pause lasted.**
  > A lot had 9 seconds left on its countdown at 14:00:00. It is paused until 14:03:20.
  > On resume it has 9 seconds left again, ending at 14:03:29.
- Pausing an already paused auction, or resuming one that is not paused, is refused.
- Two organisers pausing at the same moment pause it once.

## 8.9 Organiser controls during an auction

All require a reason and are recorded. Full detail is in
[17-organiser-controls-and-corrections.md](17-organiser-controls-and-corrections.md).

| Control | Effect |
|---|---|
| **Close bidding now** | Settles the open lot immediately (sold to the top bidder, or unsold if no bids), then opens the next |
| **Timer off** | The open lot's clock stops; it closes only by hand. Screen reads "no timer — closes by hand" |
| **Restart timer** | The live clock restarts from its full setting (opening window if no bids, countdown otherwise). Refused if that setting is 0 |
| **Add / remove seconds** | Moves the live clock. It can never be moved into the past (at least 1 second remains); closing is its own action. Refused if the timer is off |
| **Retract top bid** | Removes the highest bid (for example a mistaken click). The previous bidder becomes the highest again and the bid countdown restarts. If it was the only bid, the lot returns to its opening window. No coins change hands. The retracted bidder is notified with the reason |
| **Withdraw a lot** | Takes a pending or open question off the block. Nothing is sold, no coins change hands, and bids are kept for the record. If it was open, the next lot opens. A settled lot cannot be withdrawn ("take the question back instead") |
| **Restore a lot** | Puts a withdrawn question back at the **end** of the current queue, fresh, as if never offered |
| **Reorder** | Changes the order of questions **not yet offered** in this round. Everything already offered keeps its place. The new order must list every pending question exactly once |
| **Pause / resume** | See §8.8 |
| **Record sale / unsold** | Offline mode only; see §8.6 |
| **Take back a question** | See [09-coins-and-ownership.md](09-coins-and-ownership.md) §9.7 |

The **auction running order for the contest as a whole** (the order used when Auction 1's lots are
created) can be edited only **until lots have been created**. After that it is fixed, because
bidders planned their coins around it.

## 8.10 Participants who cannot take part

- **Not selected for Phase 2:** they see the "not selected" screen, and bidding is not available to them.
- **Staff:** they see the same public auction floor, with "Organisers observe here; controls are on
  the admin dashboard".
- **Disqualified:** they see a warning that they are not eligible, and every bid is refused.
- **Blacked out:** **bidding is never blocked by a Blackout.** A blacked-out participant may bid as normal, and bids they
  hold are unaffected. (How the Blackout screen and the auction floor appear together is **Undefined**; see
  [22-open-questions.md](22-open-questions.md).)

## 8.11 Owning nothing

Losing every bid is a **legitimate, announced outcome**. A participant who wins nothing has nothing to
solve and no hints to buy. The coding screen says so plainly: "There is nothing to solve this round.
Losing every bid is a legitimate outcome."

Organisers can see such participants (coins, no questions). They may, **at their discretion**, assign
an unsold question to them at a price they set, with a reason. That is a remedy, not a right. The
ownership cap, if set, is the organisers' tool for preventing the situation in advance.

## 8.12 Auction timing boundary cases

| Situation | Outcome |
|---|---|
| A bid arrives when the countdown shows 0.2 s on the bidder's screen but the server clock has already passed the deadline | Refused: "bidding on this question has closed" |
| A bid arrives 0.1 s before the deadline by server time | Accepted; the countdown restarts from full |
| A bid and an organiser's "add 30 seconds" arrive together | Both apply, in the order the server received them; the lot cannot be settled over either |
| The deadline passes, but the sale has not appeared on screens yet | No bid can be accepted; the sale will be recorded for the current highest bidder |
| An organiser closes a lot at the same moment the countdown expires | The lot settles exactly once |
| Two participants press Bid 110 at the same moment | Exactly one is accepted. The other is refused with "the next legal bid is 120" and may bid again |
| Twenty participants press Bid at once | Exactly one accepted bid per rung; all others refused with the new next amount |
| The highest bidder's balance drops below their bid before the lot closes (for example they buy a hint) | **Undefined.** See [22-open-questions.md](22-open-questions.md) |
