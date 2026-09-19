# 11. Points and Leaderboards

**Points are the result of the contest. Coins are not.** A participant's standing is their total
points; how many coins they hold, spent or saved, never ranks them ([09-coins-and-ownership.md](09-coins-and-ownership.md) §9.1).

There are two leaderboards, with two separate totals that never mix:

| | Ranks by | Used for |
|---|---|---|
| **Phase 1 leaderboard** | Phase 1 points (puzzle marks and hack points) | Choosing who advances; then only to break an exact Phase 2 tie |
| **Phase 2 leaderboard** | Phase 2 points (rewards from solved questions) | The contest result |

Phase 1 points are **never added** to Phase 2 points, and neither can be spent. This file covers the
Phase 2 leaderboard in full; Phase 1 scoring is in
[07-phase1-qualifying-round.md](07-phase1-qualifying-round.md) §7.5 and summarised in §11.8.

## 11.1 Points

1. Each question carries a **points reward**, set by its author and stated before the auction.
2. A participant earns a question's **full points reward** if they **solve** it: they currently own it, it is
   not void, and at least one of their submissions for it currently has the verdict Accepted.
3. **No partial credit.** Passing 19 of 20 tests earns nothing.
4. **A participant's total points = the sum of the points rewards of the questions they have solved.**
5. **Coins do not affect points.** Paying 500 or 100 coins for a question makes no difference to the
   points it pays, and unspent coins are worth nothing at the end.
6. **Points are never spent.** Buying hints and powerups costs coins, so no purchase can ever reduce a
   participant's points or their rank.
7. **Wrong submissions cost nothing.** There is no penalty of any kind.
8. **A solve is sticky.** A later wrong submission never un-solves a question. Only a rejudge that
   changes verdicts, or losing ownership, can remove a solve.

## 11.2 Solve time

**Solve time for one question** = (server receipt time of the participant's earliest submission on that
question whose current verdict is Accepted) − (the moment the participant acquired the question).

**Total solve time** = the sum of solve times over the questions the participant has solved.

Rules and reasons:

- **Measured from acquisition, not contest start.** A question bought in Auction 2 cannot be attempted
  before roughly minute 100. Timing from contest start would make buying late strictly worse and kill
  Auction 2.
- **Measured at submission, not at verdict.** Judging delay never affects fairness.
- **Wrong submissions add nothing.**
- **Later Accepted submissions never move it.**
- **After a rejudge** it is recomputed: the earliest submission that is *currently* Accepted counts.
- **If ownership is transferred**, the new owner's clock starts at the transfer.
- **A Blackout does not pause it.** Time lost while blacked out is not given back.

> Alice wins Q1 at 10:05 and has a first Accepted submission received at 10:25: 20 minutes.
> Alice wins Q9 in Auction 2 at 12:10, and the first Accepted arrives at 12:18: 8 minutes.
> Total solve time: **28 minutes**.

## 11.3 Ranking

Participants are ordered by, in turn:

1. **More points.**
2. **Lower total solve time.**
3. **Better (numerically lower) Phase 1 rank.** Phase 1 points never add to the Phase 2 total, but the
   Phase 1 rank separates an exact tie so a prize does not rest on joint first place. A participant with no Phase 1 rank comes after
   those with one.
4. If all three are equal, the participants **share the same rank**. The rules say **organisers decide,
   and record why**. (For display, tied participants are listed alphabetically.)

Participants with **no solves** have 0 points and total solve time 0. They are ordered among themselves by
Phase 1 rank.

**Disqualified participants do not appear** on the Phase 2 leaderboard. If requalified, they reappear with
their standing recomputed.

### Worked example

| Participant | Solved (points reward) | Solve times | Points | Total time | Phase 1 rank | **Rank** |
|---|---|---|---|---|---|---|
| Alice | Q1 (100), Q9 (200) | 20 m, 8 m | 300 | 28 m | 5 | **2** |
| Bob | Q3 (300) | 25 m | 300 | 25 m | 9 | **1** |
| Charlie | Q4 (100), Q6 (100) | 10 m, 15 m | 200 | 25 m | 2 | **3** |
| Dana | Q5 (200) | 25 m | 200 | 25 m | 7 | **4** |

- Bob and Alice both have 300. Bob's 25 m beats Alice's 28 m.
- Charlie and Dana both have 200 and 25 m. Charlie's Phase 1 rank 2 beats Dana's 7.

## 11.4 What the Phase 2 leaderboard shows

For every listed participant: **rank, display name, total points, number of questions solved, total solve time**
(minutes and seconds). The viewer's own row is highlighted, with a summary "You are #3 — 300 points · 2
solved · 28m 00s". The top three ranks are visually distinguished. The title notes the tie rule: "Ties:
lower solve time, then Phase 1 rank."

**Information about another participant that can be viewed:** only those five fields. **Never** their
questions, code, hints, **coins**, bids beyond the public auction record, or powerup holdings. Coins are
not on the leaderboard at all, because they are not what ranks anyone.

**Actions that can be started from a leaderboard entry: none.** The leaderboard is information only.
Targeting another participant with a powerup is done from the marketplace's target list, not from here.

## 11.5 Visibility modes

Organisers set the Phase 2 leaderboard's visibility (default **live**) and **announce it before
Auction 1**, because it changes bidding strategy.

| Mode | What participants see | Own rank on coding and end screens |
|---|---|---|
| **Live** | Current standings, updating within about a second of any change | Shown |
| **Frozen** | Standings **as of the freeze moment**. A clear notice: "Leaderboard frozen — shown as of 14:30. Results after that are not reflected until it is unfrozen." | Shown, as of the freeze |
| **Hidden** | "Standings are hidden — The organisers turned it off for this contest." Never an empty table | Not shown ("leaderboard hidden") |

**Frozen, precisely:** only submissions **received before** the freeze moment count. A submission received
before the freeze but judged Accepted after it **does** count. A submission received after the freeze does
not count until the board is unfrozen. Sales, voids, take-backs, transfers and rejudges are reflected
immediately, because they change what existing submissions mean, not which submissions exist.

The freeze moment is the moment an organiser switched to frozen. Switching away and back to frozen sets a new
freeze moment. Unfreezing (switching to live) reveals everything at once. Nothing is lost while frozen.

**Staff always see full, current standings**, whatever the mode.

## 11.6 When points and ranks change

| Event | Effect on the leaderboard |
|---|---|
| A submission is judged Accepted for the first time on a question | Owner's points, solved count and time change; ranks may shift |
| A later Accepted, or any non-Accepted verdict | No change |
| A question is sold | No points change (ownership alone earns nothing); the winner's coins drop by the price |
| A rejudge changes verdicts | Recomputed from the new verdicts |
| A question is voided | Its owner loses its points and time |
| A question is taken back or transferred | The former owner loses its points and time; a new owner's clock starts |
| A participant is disqualified / requalified | Removed from / returned to the board |
| A Phase 1 result changes (a mark, an override) | Can change Phase 1 ranks and therefore Phase 2 tie order |
| A Blackout or Shield | No direct effect on points. Buying one costs coins, which are not ranked, so a purchase never changes anyone's rank |
| Visibility mode changes | What participants see changes immediately |

Standings are always **derived from the current facts**: owned questions, current verdicts, acquisition times.
Nothing is a stored running total that could fall out of step. Several events affecting the same participant at
once (for example a rejudge and a void) therefore give the same standings regardless of the order they are
processed in.

## 11.7 Behaviour while the leaderboard is open

- The page **updates by itself** when anything that affects standings happens. There is no refresh button to press.
- A participant watching their rank drop from #2 to #3 as someone else solves sees the change within about a
  second, with their own row still highlighted.
- If the organisers switch to hidden while the page is open, the table is replaced by "Standings are hidden".
- If the connection drops, the page keeps the last standings shown. The connection banner appears, and the
  standings refresh on reconnection.

## 11.8 Phase 1 leaderboard (summary)

- **Ranked by** total Phase 1 points (a separate total from Phase 2 points, and also unspendable); **ties** by earlier submission time (the later of the participant's two
  finish presses); no finish press ranks after those who pressed; then alphabetical. Ranks are never shared.
- Shows rank, name, points (with a provisional marker if anything is ungraded or a checker failed), and to
  staff the submission time and advancement status. It also shows the selection basis.
- **Visibility for participants** is a separate organiser setting (default **hidden**).
- A participant can **always** see their own Phase 1 results once Section A has closed.
- Disqualified participants are listed last and unranked (staff view) and never shown with a rank.
