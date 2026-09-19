# 9. Coins and Ownership

## 9.1 The two currencies

Phase 2 has **two separate currencies**, and they never convert into each other.

| | **Coins** | **Points** |
|---|---|---|
| What they are | The spendable currency | The reward for solving |
| How you get them | Everyone starts with the same **starting coins** (an organiser setting, default 1,000). Organisers may also adjust or refund them | Only by **solving** a question you own: it pays its **points reward** |
| What they buy | Questions at auction · hints · powerups (Blackout, Shield) | **Nothing.** Points are never spent |
| Effect on the leaderboard | **None.** Coins never rank anyone | **They are the ranking.** Most total points wins |
| At the end of the contest | Unspent coins are worth nothing | Points are the result |
| Transferable? | Never | Never |

**The trade-off the format is built on:** coins are one pool for three different things. A Shield
is a question you chose not to bid on. A hint is a powerup you chose not to buy. How many coins a
participant paid for a question makes **no difference** to the points it pays.

Both are **whole numbers**. Neither can be fractional.

**Who sets the two numbers on a question:** the administrator or evaluator who creates the
question sets its **base coins** (its opening auction price) and its **points reward** (what it
pays when solved), exactly as they set its title, statement and limits. See
[17-organiser-controls-and-corrections.md](17-organiser-controls-and-corrections.md) §17.5.

## 9.2 Coin rules

1. A coin balance is a **whole number**. No operation can produce a fraction.
2. A coin balance is **never negative**. Any action that would make it negative is refused, and
   nothing about that action happens.
3. **Every participant starts with the same coins**: the starting coins setting (default 1,000)
   at the moment their account was created.
4. Coins are **never transferred** between participants, by any action, for any reason.
5. A coin balance changes **only** through:

| Change | Direction | Who causes it |
|---|---|---|
| Starting coins | + | Registration, or an organiser creating the account |
| Winning a question | − exactly the winning price | Auction settlement, offline sale, organiser assignment |
| Buying a hint | − the hint's price | The participant |
| Buying a powerup | − the powerup's price | The participant |
| Refund | + | Organiser: void, take back, rejudge outcome |
| Adjustment | + or − | Organiser, with a reason |

6. **Placing a bid does not change the balance.** Only winning does.
7. **Every change is recorded** in the participant's ledger: the amount, the reason, a
   reference (which question, hint or powerup) and the balance left afterwards.
8. The participant's current coins are visible to them **on every contest screen** and
   update within about a second of any change.
9. A participant can **never** see another participant's coins. Organisers can see everyone's.

## 9.3 Points rules

1. A participant's **total points** is the sum of the **points rewards** of the questions they
   currently own and have solved, excluding void questions.
2. Points are earned **only** by solving. Nothing else pays points: not buying, not bidding, not
   holding coins, not using powerups.
3. **Points are never spent**, on anything, ever. There is nothing to buy with them.
4. **Points are never transferred.**
5. Points **follow the question**. If a question stops counting for a participant — it is voided,
   taken back, transferred away, or a rejudge leaves it without an accepted submission — its
   points leave that participant's total at once, and their rank drops accordingly.
6. A participant starts with **0 points**, including a participant an organiser creates
   mid-contest.
7. Points are **whole numbers** and are never negative.
8. Total points, and therefore the leaderboard, are always **worked out from the current facts**
   (what is owned, what is solved, what is void). See
   [11-scoring-and-leaderboards.md](11-scoring-and-leaderboards.md).

## 9.4 Coin purchases racing each other

A participant's purchases are processed strictly one after another. The second always sees the
balance the first left behind.

> Alice has 100. Alice clicks "Buy hint (60)" and, at the same instant, in another window, "Buy
> Shield (60)". Exactly one succeeds and the balance becomes 40. The other is refused ("you have
> 40; this costs 60"). The balance never becomes −20.

## 9.5 Ownership rules

1. **Each question has at most one owner at any time.** Two owners is impossible, even if two
   sales are attempted at the same instant.
2. Ownership is created by: an online sale, an offline sale recorded by an organiser, or an
   organiser assigning an unsold question.
3. An owner may **read** the statement, samples and hints, **submit**, and **earn its points** by solving it.
4. A non-owner can do none of these. The product must refuse them even if they bypass the screen.
   Asking to open a question you do not own gives "you do not own this question". It is not
   treated as "hidden but present".
5. Ownership records **the price paid** and **the moment of acquisition**. Solve time is measured
   from that moment.
6. Participants cannot sell, return, swap, share or transfer ownership.
7. **Ownership cap:** if an organiser sets one, a participant who already owns that many questions
   cannot bid (online) or be recorded as winning (offline). Default: no cap. Coins are then the
   only limit.
8. Losing ownership (take back, void or transfer) removes the question from that participant's
   list, stops them submitting, and removes its points and solve time from their standing.
   Their past submissions are kept for the record.

## 9.6 Hints (coin side)

Full behaviour is in [10-problems-and-submissions.md](10-problems-and-submissions.md) §10.8. On
the coin side:

- Hints are priced individually, and the price is shown before buying.
- The price is charged and the hint revealed together, in one indivisible step.
- A hint is never charged twice, even on a double click.
- Hint purchases are final for the participant.

## 9.7 Organiser coins and ownership corrections

Every correction below requires a reason, is recorded with who and when, and notifies the affected
participant.

### 9.7.1 Adjust a coin balance

Add or subtract any whole number of coins. Refused if the result would be negative. The participant
is told "An organiser adjusted your balance by +50. Reason: …".

Points cannot be adjusted directly: they are worked out from what a participant owns and has
solved. An organiser changes someone's points by changing those facts (a rejudge, a void, a
take-back, a transfer). See [22-open-questions.md](22-open-questions.md) U11.

### 9.7.2 Assign an unsold question

For the participant who owns nothing, or any other discretionary remedy.

- Only a question whose status is **unsold** can be assigned.
- The organiser sets the **price in coins** (which may be 0). It is refused if the price exceeds the
  participant's coins.
- The participant is charged, becomes owner **from now**, and is notified: "An organiser assigned
  you Q12."

### 9.7.3 Take back a question

For **a wrong sale of a good question**: the wrong person was recorded, a mistaken bid won, and so on.

- The organiser chooses independently:
  - **refund the price** (yes/no);
  - **refund the hints** the owner bought for it (yes/no);
  - **relist** it, meaning put it back at the end of the current auction's queue (yes/no).
- The owner loses the question and is notified: "Q7 was taken back by the organisers and 110 was
  refunded to you. Reason: …"
- The question becomes **unsold** and can be sold again (in this auction if relisted, or in Auction 2).
- **If hints are refunded, those hint purchases are cancelled**, so the participant would have to
  buy them again if they later won the question back. Otherwise they would get them free.
  **If hints are not refunded**, the purchases stay on record.
- The former owner's submissions are kept but no longer count.

### 9.7.4 Void a question

For **a broken or unusable question**.

- The question leaves the contest **for everyone**: status void, pays no points to anyone, can never
  be sold again.
- By default the owner is refunded **both the price and every hint they bought for it**, since coins
  spent on an unsolvable question bought nothing. The organiser may choose not to refund either part.
- Hint purchases stay on the record. The question can never be won again, so there is nothing to
  unlock for free.
- An announcement is made to everyone: "Question Q9 has been voided. <reason>".
- The owner is notified with the refund amount.
- Standings update at once: the question's **points reward** and solve time leave its owner's total.

### 9.7.5 Rejudge outcome

After a question is corrected and its submissions rejudged, the organiser explicitly chooses, with a
reason, one of:

| Outcome | Effect on the owner |
|---|---|
| **Let the verdicts stand** | Nothing else changes. They keep the question and may keep attempting it. Notified that the question was corrected and the verdicts stand |
| **Refund** | They are refunded the coins they paid **and keep the question**, so its points still count if it is solved. Notified |
| **Void** | As §9.7.4 |

### 9.7.6 Transfer ownership

Move a sold question to a different participant **without coins changing hands**.

- The new owner's **solve time starts from the moment of transfer**.
- The previous owner loses the question and its points. Their submissions stay on record but no
  longer count. Hints they bought stay with them and are not refunded.
- The new owner does not inherit the previous owner's hint purchases.
- Both are notified.

## 9.8 Examples

> **Winning and solving.** Bob has 1,000 coins and 0 points. Bob wins Q3 (base coins 200, points
> reward 300) for 240 coins: 760 coins left, and the ledger shows "question won · Q3 · −240 · 760".
> Bob solves Q3 at 10:40, and is paid its **300 points**. Bob's coins do not change when the points
> arrive: solving pays points, never coins.

> **Hint, then the question is voided.** Bob buys hint 1 (30 coins) and hint 2 (50 coins) for Q3:
> 680 coins. Q3 is then found to be broken and is voided with the default refunds. Bob gets
> 240 + 30 + 50 = **320 coins** back (1,000 again) and **loses Q3's 300 points**, dropping back to 0.
> Q3 disappears from Bob's questions, and the announcement tells everyone.

> **Take back without refund, relisted.** Charlie was recorded as winning Q5 for 100 by mistake in an
> offline auction. Olivia takes Q5 back with "refund price: yes, refund hints: no, relist: yes".
> Charlie's coins go up by 100, and if Charlie had solved Q5, its points leave Charlie's total. Q5
> goes to the end of the current auction's queue and will be offered again.

> **Transfer.** Q8 was sold to Dana at 14:00, but the room's actual winner was Alice. Olivia first
> charges Alice (adjust −150 coins) and refunds Dana (adjust +150 coins), then transfers Q8 to Alice.
> Alice's solve time for Q8 starts at the moment of transfer, 14:05. Q8's points now belong to
> whoever solves it as its owner: Dana's claim on them, solved or not, is gone.

> **Coins do not rank.** Dana never bids and ends with all 1,000 coins and 0 points. Charlie spends
> every coin, solves two questions worth 150 and 250, and ends with 0 coins and 400 points. **Charlie
> is ahead of Dana.** Unspent coins are worth nothing.
