# Auction-Based Coding Competition — Rules and Description

**Status:** rules agreed; all pricing parameters still to be set
**Audience:** participants (Sections 1–9) and organisers (Sections 10–12)
**Related:** [decisions.md](decisions.md) · [requirements-backend.md](requirements-backend.md)

---

## 1. What this competition is

A coding competition where **you do not get to attempt every question — you have to
buy the ones you want.**

Every participant starts with the same amount of virtual money. Questions of varying
difficulty are auctioned one at a time. You bid against everyone else, and the
highest bidder wins the **exclusive** right to attempt that question. Nobody else can
see it or solve it.

You then solve what you bought. If you get stuck, you can spend money on hints for
questions you own — at any point. Later, a second auction offers whatever went unsold
in the first.

Your score comes only from questions you **solve**, weighted by difficulty. Money left
over at the end is worth nothing.

### What makes it different

An ordinary contest tests whether you can solve problems. This one also tests
**judgement**:

- Is this Hard question worth 40% of my money, or should I save it for two Mediums?
- I'm stuck — do I buy a hint, or spend that money on another question entirely?
- Everyone else wants this problem. Do I drive the price up, or let them overpay?

Because each question has exactly one owner, you are never racing someone else on the
same problem. You are competing on **what you chose to buy and what you managed to
solve**.

---

## 2. At a glance

| | |
|---|---|
| Competitors | ~20 **individuals** — one person, one account |
| Questions | 25, across Easy / Medium / Hard |
| Phases | Auction 1 → Coding Round 1 → Auction 2 → Final Round |
| Coding Round 1 | 1 hour 30 minutes |
| Starting money | identical for everyone *(amount TBD)* |
| Question ownership | **exactly one participant per question** |
| Scoring | difficulty score per solved question; solving is all-or-nothing |
| Tiebreak | lowest **sum of solve times**, each measured from when you won the question |
| Venue | proctored exam hall, organiser-controlled machines |
| Network | contest server on the hall network only — no internet access |
| Leaderboard | organiser's choice: live, frozen near the end, or hidden |

---

## 3. Phases

### Phase 1 — First auction

Questions are auctioned. You bid with virtual money. Highest bidder owns the question
exclusively.

### Phase 2 — Coding Round 1 · 1 h 30 m

Solve the questions you own. You may submit as many times as you like, and you may
buy hints for your questions at any time.

**You may also code and submit during the auctions themselves.** The phases govern
when bidding happens, not when you are allowed to work — so if you run out of money
in the second auction, you can keep solving instead of watching.

### Phase 3 — Second auction

Questions that went unsold in the first auction are re-offered, at the same base
price. With 25 questions and 20 participants, expect few leftovers — this round is
mostly a chance to reconsider how much of your remaining money is worth spending on
hints rather than a second question.

### Phase 4 — Final round

Attempt newly acquired questions and keep working on any question you own. The
contest ends when this round closes.

---

## 4. Auction rules

1. **Everyone starts with the same balance.**
2. Questions are auctioned **one at a time, in sequence**. The running order is
   decided by the organisers and **published before the auction begins**, so you can
   plan a budget across the whole set.
3. Each question has a **base price** set by difficulty. Bidding opens there. The
   question's difficulty and score are shown; its statement is not — that is what you
   are bidding for.
4. Every bid must raise the current highest by **exactly the increment X**. You cannot
   raise by more, or by less.
5. **You cannot bid more than your available balance.** Money already committed to
   won questions is gone.
6. **How bidding closes:** the question opens at its base price. The first bid starts
   a countdown. **Every higher bid restarts the countdown.** When the countdown runs
   out with no new bid, the question is sold to the highest bidder. You cannot win by
   bidding last — only by bidding highest.
7. The **highest bidder when bidding closes wins**, and the bid amount is deducted
   immediately.
8. A won question belongs to that participant **alone**. Nobody else may see its
   statement, attempt it, or score from it.
9. **All auction outcomes are final.** No refunds, no undoing a confirmed bid.
10. **Nothing is transferable.** You cannot give, sell, trade or share money,
   questions or hints with another participant.
11. If **no bid at all** is placed within a short opening window, the question is
    declared unsold and the auction moves on.
12. Questions that receive no bids remain unsold and are re-offered in the second
    auction **at the same base price**.
13. Bidding up a question you do not intend to win is permitted — but you risk winning
    it, and you pay if you do.

> **Money is not score.** Unspent balance at the end of the contest is worth zero
> points. Hoarding loses.

---

## 5. Ownership

- You may attempt **only** questions you own.
- You cannot read the statement of a question you do not own.
- Ownership is permanent for the contest — you cannot sell a question back or swap it.
- There is **no limit on how many questions you may own** unless the organisers set
  one. Your balance is the only constraint — six cheap questions and one expensive
  one are both valid strategies, and both mean spending your money.
- Because each question has a single owner, **no two participants solve the same
  problem**. Your score reflects your own purchases and your own solutions.

---

## 6. Writing and submitting code

### Languages

C · C++ · Java · Python · PyPy · JavaScript

### Limits

- **Time limit: 1 second per testcase**, unless a question states otherwise
- Memory limit as stated per question
- **The time limit is the same for every language.** It is set with C++ in mind.
  Interpreted languages are genuinely at a disadvantage on tight problems — PyPy is
  provided for this reason. **Factor this into your bidding.**

### Environment

You write code **in the browser**. There is no local compiler, no terminal, no
personal editor and no local testing. Everything is compiled and run on the server.
Plan accordingly — you cannot bring your own templates or debug locally.

### Submission rules

1. You may submit **as many times as you like**. Wrong submissions carry **no penalty**.
   You may keep submitting after solving a question; it stays solved, and your
   recorded solve time remains that of your first accepted submission.
2. You may have **one submission being judged at a time**. This is enforced per
   participant, not per browser window.
3. After a submission finishes — whether it completes or you replace it — there is a
   **3 second cooldown** before you can submit again.
4. **You may be signed in on only one machine at a time.** Signing in elsewhere ends
   your previous session.
5. These are technical limits to keep the judge fair and responsive. They do not
   affect your score.

---

## 7. Verdicts and what you are told

Your submission is judged against **sample testcases first**, then hidden testcases,
stopping at the first failure.

| Verdict | Meaning |
|---|---|
| **Accepted** | every testcase passed — the question is solved |
| **Wrong Answer** | output was incorrect |
| **Time Limit Exceeded** | too slow |
| **Memory Limit Exceeded** | used too much memory |
| **Runtime Error** | crashed or exited abnormally |
| **Compilation Error** | did not compile |
| **Internal Error** | **our** fault, not yours — never counted against you |

**You are told the verdict and the number of the testcase that failed.** You are
never shown the contents of a hidden testcase or its expected output — not for free,
and not for any price.

**Sample testcases are always visible and free.** Use them to confirm your output
format before spending anything.

---

## 8. Hints

You may buy hints for questions **you already own**, at **any time** once you own them
— during a coding round or during an auction. You do not have to wait for the second
auction.

Hints are written by the problem setter and priced individually. They typically nudge
you toward the right approach — useful when you are stuck with no idea where to start.

### Rules

1. Hints apply only to questions you own.
2. Prices are shown before you buy. **Purchases are final.**
3. Once bought, a hint stays visible for the rest of the contest and is never charged
   twice.
4. Hints cannot be transferred or shared.
5. Money spent on hints is money not available for questions. That is the trade.

> **Hidden testcases are never for sale.** No amount of money reveals a hidden
> testcase or its expected output. Hints tell you how to think about the problem, not
> what the answer is.

## 9. Scoring and ranking

1. Each question carries a **score based on its difficulty**, stated before the auction.
2. You score a question's full value if you **solve** it — meaning an Accepted verdict.
   There is **no partial credit** for passing some testcases.
3. Your final score is the sum of the scores of the questions you solved.
4. **How much you paid does not affect your score.** A bargain and an overpayment are
   worth the same points.
5. Unspent money is worth nothing.
6. **The highest final score wins.**

### Tiebreak

If two or more participants finish on the same score, the one with the **lowest total
solve time** ranks higher.

**Your solve time for a question is measured from the moment you won it at auction**
to the moment you first submitted an accepted solution. Your total is the sum across
every question you solved.

Measuring from when you acquired the question means buying in the second auction costs
you nothing on the tiebreak — you are judged on how fast you solved what you owned,
not on when you happened to acquire it.

**Wrong submissions add nothing to your time.** There is no penalty for them.

Once a question is accepted it stays accepted — a later wrong submission never
un-solves it, and your solve time is fixed by your **first** accepted submission.

---

## 10. Corrections and incidents

*(Organiser policy — participants should know it exists.)*

### If a question turns out to be broken

Organisers may correct a question during the contest. When that happens:

- **Every submission to that question is automatically re-judged.**
- Verdicts may change, including from Accepted to not-Accepted.
- Because each question has only one owner, only that participant is affected. They
  keep the question and may continue attempting it.
- **Organisers decide, case by case, whether to also refund or void** — for example
  if a correction lands too late for the owner to realistically re-attempt. That
  decision is recorded with a reason.
- The affected participant is notified that their verdict changed.
- An announcement is made to everyone.

### If a question is unusable

Organisers may **void** it. A voided question scores nothing for anyone, and its
owner is refunded what they paid.

### If your machine fails

All your work is stored on the server. Sign in on a spare machine and continue —
your balance, questions, hints and submissions will all be intact.

---

## 11. Signing in

You register yourself at your machine when you arrive. Registration closes before the
first auction — the roster must be final before bidding starts, since everyone begins
with the same balance.

You may be signed in on **one machine at a time**. If your machine fails, sign in on a
spare and everything will be exactly as you left it.

---

## 12. Organiser authority

Organisers can override any part of the system: adjust balances, reverse or void a
purchase, correct ownership, change any parameter, close bidding by hand, extend or
end a phase, rejudge, void a question, and correct standings.

Every such action is recorded with who did it, when, and why. Organiser decisions are
final.

---

## 13. Conduct

1. Standard competitive programming rules apply.
2. Work alone. No collaboration, no sharing of code, solutions, hints or testcase
   content between participants.
3. No outside resources. Machines are restricted to the contest system.
4. One account per participant, signed in on one machine at a time. Sharing accounts
   or credentials is prohibited.
5. No attempt to interfere with the contest system, other participants' machines, or
   the judging service.
6. Organiser decisions on conduct are final.

---

## 14. Parameters still to be set

**These are not yet decided and must be fixed before the contest.** They determine
whether the auction is interesting or broken.

| Parameter | Notes |
|---|---|
| Starting balance | too high and the auction has no tension; too low and nobody can buy anything |
| Base price — Easy / Medium / Hard | should roughly track score, or difficulty becomes a bad deal |
| Bid increment **X** | too large and bidding is coarse and luck-driven; too small and auctions drag |
| Score — Easy / Medium / Hard | the spread determines whether Hards are worth the money |
| Written hint prices | too cheap and Hard questions become Easy for anyone with cash |
| Bid countdown duration | how long after the last bid before a question sells |
| Auction running order | which question goes first — published before bidding |
| Opening window | how long a question stays open before the first bid, if nobody bids |
| Final round duration | not yet fixed |

### Two things worth testing before contest day

**Run a paper simulation.** Five people, fake money, ten questions, no software. You
will discover in twenty minutes whether your pricing produces interesting decisions
or an obvious dominant strategy.

**Calibrate difficulty within each tier.** Two people pay comparable amounts for
different "Hard" questions. If one Hard is markedly easier than another, that is a
permanent advantage with no way to correct it mid-contest. Have someone solve all 25
and rank them before the auction.
