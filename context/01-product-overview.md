# 1. Product Overview

## 1.1 What the product is

Codolympics runs one in-person programming competition from start to finish. It
has two phases.

1. **Phase 1, the qualifying round.** Every registered participant answers logic
   puzzles (Section A). They then try to break deliberately flawed programs by
   finding inputs that make them fail (Section B). Organisers use the results to
   select who goes through.
2. **Phase 2, the auction contest.** Selected participants receive identical amounts of
   **coins** (default 1,000, set by the organisers). Coding questions are auctioned one at a
   time. The highest bidder wins the **exclusive** right to attempt a question: nobody else can
   read it, solve it or earn from it. Participants then solve what they bought, and **each
   solved question pays its owner the question's points reward**. They can spend coins on hints
   and on **powerups**, which temporarily lock another participant out of the contest (Blackout)
   or protect against that (Shield). A second auction offers what went unsold, and a final
   coding round ends the contest.

   **Two currencies, and this is the heart of the format:** **coins** are spent — on questions,
   hints and powerups — and rank nobody. **Points** are earned only by solving, are never spent,
   and are the result: whoever ends with the most points wins. The author of each question sets
   both numbers: its **base coins** (what it costs to buy) and its **points reward** (what it
   pays when solved). Leftover coins are worth nothing, so hoarding loses.

The product serves everyone involved:

- the **participant** registering, answering, hacking, bidding, coding, buying and
  attacking;
- the **evaluator** marking written answers;
- the **administrator** authoring content, driving the contest through its phases,
  watching health, and correcting anything that goes wrong.

## 1.2 What problem it solves

An ordinary coding contest tests one thing: can you solve problems. Codolympics
also tests **judgement under scarcity**:

- Is this Hard question's points reward worth 40% of my coins, or should I save for two Mediums?
- I am stuck. Do I buy a hint, or spend those coins on another question?
- Someone else clearly wants this question. Do I drive the price up or let them overpay?
- Do I spend coins on a Shield, or accept the risk of being blacked out?

No off-the-shelf contest platform can run this format, because they all assume every
participant may attempt every problem. Here **each question has exactly one owner**.
That single rule changes ownership, scoring, fairness, tiebreaks, rejudging and the
user interface. Organisers would otherwise have to run the auction on paper, track
coins in a spreadsheet, and manually stop people from reading questions they did
not buy. [02-problem-statement.md](02-problem-statement.md) covers this in depth.

## 1.3 Who it is for

| Who | What they want |
|---|---|
| **Participants** (about 20 individual students or programmers, one person per account) | A fair contest in which their choices and their code decide the outcome |
| **Evaluators** (a few staff members) | A single place to mark written answers consistently, without being able to change the contest |
| **Administrators / organisers** (a few staff members) | To run a complex multi-phase event on the day without paper, spreadsheets or improvisation, and to fix anything that goes wrong with a record of why |

## 1.4 The environment it is used in

These facts are part of the product. They are not incidental.

- **One room, one day.** A proctored exam hall. Participants are physically present
  and supervised.
- **Organiser-controlled machines.** Each participant sits at a machine the
  organisers prepared. The product is the only thing on screen, in a locked-down
  browser.
- **No internet.** The contest server is on the hall's own network. Nothing the
  product shows may depend on outside resources.
- **No personal tools.** Participants cannot use their own editor, compiler,
  templates or local tests. All code is written in the product's editor and run on
  the contest server. Participants are told this in advance.
- **Proctors are the real anti-cheating control.** Software checks back them up.
  They do not replace them.
- **Scale.** Around 20 participants and around 25 Phase 2 questions. The product
  must behave identically under that load and must never lose work.

## 1.5 What makes the experience different from a normal coding platform

| Normal coding platform | Codolympics |
|---|---|
| Everyone can see and attempt every problem | You may only see and attempt questions **you won at auction** |
| One currency, or none at all | **Two:** **coins** are spent (questions, hints, powerups); **points** are earned by solving and rank the contest |
| Score depends only on what you solve | **Points** depend on what you **chose to buy** and what you solved |
| Wrong submissions often cost penalty time | Wrong submissions cost **nothing**; there is no penalty |
| Ties broken by penalty time from contest start | Ties broken by the **sum of solve times**, each measured **from when you won that question** |
| You race others on the same problem | You never race anyone on the same problem; nobody else has it |
| Hints, if any, are free or absent | Hints are **author-written text you buy** with the same coins you bid with |
| Leftover budget is meaningless | Leftover **coins** are worth nothing, so hoarding loses; only **points** count |
| Other participants cannot affect you | Other participants can **black you out** for a while, unless you hold a Shield |
| The schedule runs itself | **Organisers open every phase**; nothing moves on its own |
| Hidden testcases may be revealed after the contest | Hidden testcase contents are **never** shown to participants, at any price |

## 1.6 The overall lifecycle

```
Before the day      Organisers author puzzles, hacking questions, coding questions and hints;
                    prove each one works; set prices, durations, orders and rules;
                    export the whole setup as one file.

Contest day         Import the setup file into a fresh contest and check readiness.

Registration        Participants arrive, create accounts at their machines, and wait.
                    Organisers close registration.

PHASE 1             Section A · Logical puzzles   (timed)
                    Section B · Hacking            (timed)
                    Review · evaluators mark written answers, organisers select who advances

PHASE 2             Auction 1          questions offered one at a time
                    Coding round 1     solve what you own   (timed, default 90 minutes)
                    Auction 2          unsold questions offered again
                    Final round        keep solving          (timed, default 60 minutes)

Ended               Standings are final. Nothing more can be submitted.

After               Results exported for the record.
```

Throughout Phase 2, participants may also buy hints and use powerups, within the
rules in [10-problems-and-submissions.md](10-problems-and-submissions.md),
[12-marketplace.md](12-marketplace.md) and [13-powerups.md](13-powerups.md).

**An organiser moves the contest from each phase to the next.** A deadline passing
closes that phase's work, but the contest does not advance until an organiser
advances it. See [06-contest-lifecycle.md](06-contest-lifecycle.md).

## 1.7 What a participant is trying to accomplish

1. Qualify in Phase 1 by scoring well on puzzles and hacks.
2. In Phase 2, win questions they can actually solve, at prices that leave room for
   more questions, hints or powerups.
3. Solve their questions quickly, since solve time breaks ties.
4. Decide when a hint is worth its price.
5. Decide whether to disrupt a rival (Blackout) or protect themselves (Shield).
6. Finish with the most points.

## 1.8 What an organiser is trying to accomplish

1. Prepare a content set in which every question has been proven to work.
2. Run the day in order, on time, with everyone seeing the same state at the same moment.
3. Keep the contest fair: ownership enforced, hidden data hidden, coins exact.
4. Respond to anything that goes wrong (a broken question, a mistaken sale, a failed
   machine, a disruptive participant) with a correction that is recorded with a reason.
5. Publish results afterwards.
