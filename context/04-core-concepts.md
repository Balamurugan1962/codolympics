# 4. Core Concepts

Each concept below has one meaning throughout this folder. Where two concepts are
easily confused, the difference is stated explicitly at the end of the entry and in
§4.9.

---

## 4.1 The contest

### Contest
The single competition the product is running. There is exactly one contest at a
time. It has one current **phase**, one set of **settings**, one roster of
participants, and one history.

### Phase
The stage the contest is in. Exactly one phase is current at any moment. In order:

| Phase | Belongs to | Has a deadline? |
|---|---|---|
| Registration | before the competition | No |
| Section A · Puzzles | Phase 1 | Yes (default 45 min) |
| Section B · Hacking | Phase 1 | Yes (default 45 min) |
| Review | between phases | No |
| Auction 1 | Phase 2 | No |
| Coding round 1 | Phase 2 | Yes (default 90 min) |
| Auction 2 | Phase 2 | No |
| Final round | Phase 2 | Yes (default 60 min) |
| Ended | after the competition | No |

"Phase 1" and "Phase 2" are the two halves of the competition. The rows above are
the phases the contest steps through. When this folder says "round" it means one of
the Phase 2 phases (Auction 1, Coding round 1, Auction 2, Final round).

### Deadline (phase deadline)
The server-time moment at which a timed phase's work closes. When a phase with a
duration begins, its deadline is set to "start time + duration". A deadline passing
**closes the work of that phase**: answers, hack attempts or submissions stop being
accepted. It does **not** advance the contest. Only an organiser advances.
Organisers may extend a deadline.

### Contest settings
The organiser-controlled values that shape the contest: starting coins, bid
increment, bid countdown, opening window, ownership cap, phase durations, Phase 1
selection basis, leaderboard visibility for each phase, auction mode, and whether the
marketplace is open. See [06-contest-lifecycle.md](06-contest-lifecycle.md) §6.8 for
defaults.

### Announcement
A message from organisers to **everyone**. It takes over the screen of anyone who
has the contest open when it arrives, and stays until that person acknowledges it.
It remains readable for the rest of the contest.

### Notification
A message to **one participant** about something that happened to them: they won a
question, were refunded, were blacked out, had a Shield absorb an attack, were
selected, were disqualified, or had a verdict change. It appears as a short on-screen
message and is kept until read.

### Audit log
The permanent record of every organiser and evaluator action, and of every hint
purchase. Each entry has who, when, what, and a reason. It exists so that unlimited
organiser authority is always accountable.

---

## 4.2 People and accounts

### Account
A sign-in identity with a **display name**, a password and exactly one **role**.
Display names are unique regardless of capital letters: "Alice" and "alice" cannot
both exist.

### Participant
An account with the participant role: one individual competitor. A participant has
a **coin balance**, a **points** total, a **preferred language**, Phase 1 progress, and optionally an
advancement decision and a disqualification.

### Evaluator / Administrator
Staff roles. See [03-users-and-roles.md](03-users-and-roles.md).

### Session
A signed-in presence on one machine. **A participant may have only one session.**
Signing in on another machine ends the previous one. Staff may have several.

### Preferred language
The programming language a participant's editor opens in. It is a convenience, not a
restriction. Any offered language can be chosen on any question at any time.

### Advanced / Selected
A participant whom an organiser selected, at the end of Phase 1, to take part in
Phase 2. A participant who was not selected keeps their account and their Phase 1
results but takes no part in Phase 2.

### Disqualified
A participant removed from competition for malpractice by an administrator, with a
reason. A disqualified participant cannot act, is removed from the leaderboards,
cannot be targeted by powerups, and cannot advance. Their records are kept.
Disqualification is reversible (**requalify**), also with a reason.

---

## 4.3 Phase 1 concepts

### Section A (Logical Puzzles)
The first timed part of Phase 1: multiple-choice and short-answer questions on
patterns, detective problems and constraint puzzles. No programming.

### Puzzle (Section A question)
One Section A question. It has a title, a body, a category (pattern, detective or
constraint), an **answer type**, a **grading mode**, a points value, and optionally
an explanation worth separate points.

### Answer type
How a puzzle is answered: pick one option; pick several options; type a short
answer; type a number; put items in order; list several entries; or write freely.
See [07-phase1-qualifying-round.md](07-phase1-qualifying-round.md) §7.2.

### Grading mode
How a puzzle is scored: **auto** (compared with an answer key), **validator** (each
submitted entry checked by an organiser-supplied checking program after the section
closes), or **manual** (read and marked by an evaluator).

### Explanation
An optional written justification attached to a puzzle, worth its own points, always
marked by an evaluator on the correctness of the reasoning.

### Format hint
An organiser-supplied description of the shape an answer must take, such as "four
digits, no spaces". The product rejects entries of the wrong shape as they are
typed. It never says whether a well-formed entry is correct while the section is open.

### Section B (Hacking)
The second timed part of Phase 1. Participants are shown a problem and a **given
solution** that is wrong somewhere, and must submit a **test input** that makes it fail.

### Hacking question
One Section B item: a problem statement, constraints, time and memory limits, the
given (flawed) solution, points for a successful hack, and an optional penalty for a
failed attempt.

### Hack attempt
One test input submitted by a participant against one hacking question. It is judged
and ends as one of: **invalid input** (with the broken constraint named), **hacked**
(the given solution failed), **did not break it**, or **problem error** (the
question itself is broken; not counted).

### Finish (a section)
An explicit, irreversible action by which a participant ends their own participation
in a section early. It locks their answers for that section and records the time,
which is used to break Phase 1 ties.

### Review
The phase after Section B. Evaluators finish marking, and administrators select who
advances. Nobody can answer or hack.

### Provisional (score)
A Phase 1 total that may still change because something is ungraded or a validator
failed to run. Provisional totals are marked as such wherever they appear.

### Selection basis
A published statement, set by organisers before Phase 1 begins, of how they will
choose who advances (for example "top 12 by Phase 1 points, subject to conduct").

---

## 4.4 Phase 2: questions and auctions

### Question (coding question / problem)
A Phase 2 programming task. It has a title, a **difficulty** (Easy, Medium or Hard),
a **points reward**, **base coins**, a statement, time and memory limits, **sample
testcases**, **hidden testcases**, optional **hints**, and a position in the
**auction running order**. Its status is **unsold**, **sold** or **void**.

### Difficulty
The tier label: Easy, Medium or Hard. It is shown at auction and drives the default
base coins and points structure. It carries no rule by itself; the points reward and base coins are
what matter.

### Points reward (of a question)
The points a question adds to its owner's total when solved. Solving is
all-or-nothing.

### Base coins
The published opening price of a question at auction. The first bid must equal the
base coins. An offline sale may not be recorded below it.

### Sample testcase
A testcase whose input and expected output are shown free in the statement and
judged first. It exists so a participant can check their output format before
spending anything.

### Hidden testcase
A testcase whose contents are never shown to a participant. The participant sees how
many there are and, on failure, only the **number** of the test that failed.

### Hint
Author-written guidance for a question, with a price. Hints on a question unlock
strictly in order and are bought one at a time by the owner. A bought hint stays
visible for the rest of the contest and is never charged twice.

### Auction
A Phase 2 phase (Auction 1 or Auction 2) in which questions are offered for sale **one
at a time**. Auction 1 offers every non-void question. Auction 2 offers those still
unsold.

### Auction mode
How an auction is run, chosen in settings and fixed for the length of an auction
phase:

- **Online:** participants bid from their machines, and a countdown decides when a
  question is sold.
- **Offline:** the room bids out loud to an auctioneer, and an organiser records each
  result. Participants see the board but have no bid button.

### Running order
The organiser-defined order in which questions are offered, published before the
auction so participants can plan their budget.

### Lot
One question's turn on the block in one auction. A lot is **pending** (waiting its
turn), **open** (on the block now), **closed** (sold), **unsold** (closed with no
sale) or **withdrawn** (pulled off by an organiser). At most one lot is open at any
moment.

### Bid
An offer, during an online auction, to pay a stated amount for the open lot. A bid
must be exactly the **next legal amount**. It does not move coins. Only winning does.

### Bid increment ("X")
The fixed step every bid after the first must add to the current highest bid. Default 10.

### Next legal amount
The only amount a bid may be: the base coins if nobody has bid yet, otherwise the
current highest bid plus the increment.

### Opening window
How long a newly opened lot waits for its **first** bid (default 30 seconds). If no
bid arrives in time, the lot closes unsold and the next lot opens.

### Bid countdown
How long after the most recent bid a lot remains open (default 15 seconds). **Every
new bid restarts it from the full duration.** When it runs out with no newer bid, the
lot is sold to the highest bidder. A countdown of 0 means lots close only when an
organiser closes them.

### Pause (auction)
An organiser hold on the whole auction. While paused, no bid is accepted, no lot is
settled and no new lot opens. On resume, every running clock gets back exactly the
time the pause lasted.

### Ownership
The exclusive right of one participant to read, attempt and score from one question.
It is created when a lot is sold (or an organiser assigns or records a sale). It
records the price paid and the **moment of acquisition**, from which solve time is
measured.

### Ownership cap
An optional organiser limit on how many questions one participant may own at once.
Default: no cap.

### Take back
An organiser correction for a **wrong sale of a good question**. The owner loses the
question (optionally refunded), and the question returns to unsold (optionally
back into the current auction's queue).

### Void (a question)
An organiser correction for a **bad question**. It leaves the contest for everyone,
scores nothing, is announced, and its owner is refunded the price and hints by
default. A void question can never be sold again.

---

## 4.5 Phase 2: solving

### Submission
One attempt at a question: the source code, the language, and the server time at
which it was received. Every submission is kept for the whole contest.

### Judging / evaluation
The process of running a submission against the question's testcases (samples first,
then hidden) and producing a **verdict**. It stops at the first failing test.

### In flight
A submission that has been received but has no verdict yet (waiting, queued or
running). A participant may have **at most one** submission in flight at a time.

### Cooldown
A 3-second wait, after a participant's submission finishes or is cancelled, before
that participant may submit again. It affects timing only, never score.

### Verdict
The result of judging:

| Verdict | Meaning | Counts against the participant? |
|---|---|---|
| Accepted | Every testcase passed; the question is solved | — |
| Wrong answer | Output was incorrect on some test | No penalty, but not solved |
| Time limit exceeded | Too slow on some test | No penalty, but not solved |
| Memory limit exceeded | Used too much memory on some test | No penalty, but not solved |
| Output limit exceeded | Printed far too much on some test | No penalty, but not solved |
| Runtime error | Crashed or exited abnormally on some test | No penalty, but not solved |
| Compilation error | The code did not compile | No penalty, but not solved |
| Internal error | The judge failed; **not the participant's fault** | Never |
| Cancelled | The participant withdrew it before a verdict | Never |

### Solved
A question is solved when its owner has **at least one submission whose current
verdict is Accepted**. A later wrong submission never un-solves it.

### Solve time
For one solved question: the time from the moment the owner **acquired** the question
to the moment they **submitted** their earliest submission whose current verdict is
Accepted. Judging delay is never included.

### Total solve time
The sum of a participant's solve times over all their solved questions. Lower is
better. It breaks ties on points.

### Rejudge
Re-running every submission for one question, usually after the question was
corrected. Old verdicts are kept for the record, and new ones replace them for scoring.

### Draft
The code currently in a participant's editor for one question, saved automatically
so it survives a refresh or a machine swap.

---

## 4.6 Points and standings

### Phase 1 points
The sum of a participant's Section A marks (auto, validator, manual and explanation)
and Section B hack points, excluding voided questions.

### Total points (Phase 2)
The sum of the **points rewards** of questions a participant currently owns and has solved,
excluding void questions. Coins have no effect on it, and points can never be spent.

### Leaderboard
A ranked list of participants: one for Phase 1, one for Phase 2. Each has a
**visibility mode** set by organisers.

### Rank
A participant's position on a leaderboard after all tie-breaking rules are applied.
Rank 1 is best.

### Visibility mode (live / frozen / hidden)
- **Live:** participants see current standings.
- **Frozen:** participants see standings as they were at the moment of freezing.
  Submissions made after that moment are not reflected until the board is unfrozen.
- **Hidden:** participants see no standings, only a statement that they are hidden.

Staff always see full, current standings.

### Tiebreak
The ordered rules that separate equal totals. Phase 2: more points, then lower total
solve time, then better Phase 1 rank. Phase 1: higher points, then earlier finish
time. See [11-scoring-and-leaderboards.md](11-scoring-and-leaderboards.md).

---

## 4.7 Coins and points

### Coins
The spendable currency of Phase 2. Coins buy **questions** at auction, **hints** for owned questions,
and **powerups** in the marketplace. They never rank anyone, and unspent coins are worth nothing at
the end.

### Coin balance (balance)
A participant's current number of coins: a whole number, never negative. Every participant starts with
the same **starting coins** (default 1,000).

### Ledger
The permanent record of every change to a balance, with the amount, the reason and the
balance left afterwards. Reasons: starting coins, question won, hint, powerup,
refund, organiser adjustment.

### Points
The reward for solving. A question pays its **points reward** to its owner when they solve it. Points
are never spent, never transferred, and are the only thing the Phase 2 leaderboard ranks. A
participant's **total points** is the sum of the points rewards of the questions they currently own
and have solved (excluding void questions), so points leave a participant if the question stops
counting for them.

### Points reward
The points one question pays when its owner solves it, set by whoever authors the question. It was
called the question's "score" in earlier drafts.

### Starting coins
The coins every participant has when their account is created; an organiser setting (default 1,000).

### Refund
Coins returned to a participant by an organiser correction (void, take back, rejudge
outcome) or adjustment. It is recorded in the ledger.

### Transferable
Nothing is. No participant can give coins, questions, hints or powerups to another.

---

## 4.8 Marketplace, powerups and effects

### Marketplace
The place where participants spend **coins** — the same pool they bid with — on **powerups**.
Organisers open and close it. See [12-marketplace.md](12-marketplace.md).

### Marketplace open / closed
While closed, nothing can be bought. Items already held keep working. Opening the
marketplace does not by itself make any powerup usable; see *usable phases*.

### Powerup
A marketplace item that changes the contest experience of a participant. There are
exactly two: **Blackout** and **Shield**. Each is configured by organisers.

### Powerup settings
For each powerup: name, description, price, duration (Blackout only), whether it is
on sale (**enabled**), **hold limit** (the most a participant may hold at once;
default 3), **purchase limit** (the most a participant may ever buy in the contest;
default unlimited), and **usable phases** (the phases in which it may be used;
default Coding round 1 and Final round).

### Held / inventory
How many of each powerup a participant currently owns and has not yet spent.

### Blackout
An offensive powerup. Used on another participant, it covers that participant's screen
and refuses their contest actions (never bidding) for the Blackout's duration (default 60 seconds). It
cannot be used during the last *duration + half the duration* of a coding round (the **cut-off**).
It is spent when used, whether or not it lands.

### Shield
A defensive powerup. While held, it **automatically** absorbs the next Blackout aimed
at its holder and is spent doing so. There is nothing to switch on and no duration.

### Attacker / Target
The participant using a Blackout, and the participant it is aimed at.

### Land (a Blackout)
A Blackout lands when it is not absorbed by a Shield: the target becomes blacked out.

### Absorbed / Blocked (by a Shield)
A Blackout that met a Shield. The target is not affected, one Shield is spent, and the
attacker's Blackout is still spent.

### Blacked out (state)
The temporary state of a participant on whom one or more Blackouts have landed and not
yet expired. See [14-temporary-effects.md](14-temporary-effects.md).

### Active effect
A Blackout whose end time is still in the future (and the contest has not ended).
Shields are held items, not effects, and are never "active" in this sense.

### Stack
Several Blackouts on the same target placed **end to end**. Each new one starts when
the target's current blacked-out period would have ended. The total is the sum.

### Remaining time (of a blackout)
The time from now until the end of the last Blackout in a target's stack.

### Usable phase
A phase in which a given powerup may be used. Using a powerup outside its usable phases
is refused. It does not affect buying, and it does not affect a Blackout already
running.

---

## 4.9 Commonly confused pairs

| These | Differ in |
|---|---|
| **Phase 1 / Phase 2** vs **phase** | Phase 1 and Phase 2 are the two halves of the competition; a *phase* is one step the contest is currently in |
| **Deadline passing** vs **advancing the phase** | A deadline closes a phase's work automatically; advancing moves to the next phase and only an organiser does it |
| **Points reward** vs **total points** vs **Phase 1 points** | What one question pays; a participant's Phase 2 total; a participant's separate Phase 1 qualifying total |
| **Coins** vs **points** | Coins are spent (questions, hints, powerups) and never ranked; points are earned by solving, never spent, and rank the leaderboard |
| **Base coins** vs **points reward** | What a question costs to buy vs what it pays when solved. Both are set by its author, and they are independent |
| **Phase 1 points** vs **Phase 2 points** | Two separate unspendable totals. Phase 1 points choose who advances and then only break an exact final tie; Phase 2 points are the contest result |
| **Base coins** vs **price paid** | The published opening price vs what the winner actually paid |
| **Bid** vs **sale** | A bid is an offer and moves no coins; a sale settles the lot and charges the winner |
| **Unsold** vs **withdrawn** vs **void** | Unsold: offered with no sale, can return in Auction 2. Withdrawn: pulled off the block by an organiser, nothing sold, can be restored. Void: the question is bad and leaves the contest permanently |
| **Take back** vs **void** | Take back: the sale was wrong, the question is fine and becomes unsold. Void: the question is broken and gone for everyone |
| **Sample** vs **hidden** testcase | Samples are shown free; hidden tests are never shown |
| **Hint** vs **powerup** | A hint is text about one question you own. A powerup affects contest interaction and is bought in the marketplace |
| **Announcement** vs **notification** | Everyone, screen-blocking, stays until acknowledged; vs one participant, a short message |
| **Wrong answer** vs **internal error** | The participant's program was wrong; vs the judge failed and it is never counted |
| **In flight** vs **cooldown** | A submission awaiting a verdict; vs the 3 seconds after one ends before another is allowed |
| **Solve time** vs **time taken in the contest** | Solve time is measured from acquiring the question, not from contest start |
| **Blackout** (item) vs **blacked out** (state) | The item you buy and use; vs the temporary state of the person it lands on |
| **Held Shield** vs **active effect** | A Shield is an item waiting to absorb; only Blackouts are timed effects |
| **Marketplace closed** vs **powerup not usable now** | Closed stops buying; "not usable now" stops using in this phase. They are independent |
| **Disabled powerup** vs **marketplace closed** | Disabled: this one item disappears from sale and a held Blackout of that kind cannot be used (a held Shield still absorbs). Closed: nothing can be bought, but held items still work where usable |
| **Not selected** vs **disqualified** | Not selected: did not qualify for Phase 2, no wrongdoing. Disqualified: removed for malpractice, reversible, recorded with a reason |
| **Frozen** vs **hidden** leaderboard | Frozen shows standings as of a moment; hidden shows none |
| **Finish (a section)** vs **section closing** | Finish is one participant ending early; closing is the deadline for everyone |
