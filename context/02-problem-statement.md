# 2. Problem Statement

## 2.1 The existing problem

A university team wants to run a programming competition whose central idea is
**scarcity**. Questions are bought, not given. Each one belongs to a single person.
Coins must be spent wisely, and participants can interfere with each other in
limited, rule-bound ways. The competition also needs a qualifying round that is not
pure programming: logic puzzles and "find the bug" hacking.

Existing contest systems are built on the opposite assumption. Every participant can
see every problem, and the only competition is who solves more, faster. None of
them models:

- a question that exactly **one** participant may see and attempt;
- **coins** spent on questions, hints and powerups, which must stay exact to the last coin,
  alongside **points** that are earned by solving and never spent;
- an **auction** with a countdown that restarts on every bid;
- **tiebreaks measured from the moment a question was acquired**, not from contest start;
- **effects one participant applies to another**, such as locking them out for 60 seconds;
- a qualifying round mixing multiple-choice, short answers marked on reasoning, and
  input-crafting against a flawed program.

## 2.2 Who experiences the problem

- **Organisers.** Without a purpose-built product they must run the auction by
  hand, record every sale and balance in a spreadsheet, and manually decide who may
  read which question. They must also time rounds on a wall clock, mark answers on
  paper and settle disputes from memory. Every one of these steps is a place for an
  error that cannot be undone on the day.
- **Participants.** They need to trust that the coin count is exact, that nobody else can read
  a question they paid for, and that clock and judge treat everyone equally. They
  also need their work to survive a machine failure.
- **Evaluators.** They need to mark the same question consistently across twenty
  people, without accidentally changing anything else.

## 2.3 Why it matters

- **Fairness is the whole point.** The format rewards judgement. If coins can be
  wrong, if a question can leak to someone who did not buy it, or if a local clock
  can gain someone a second, the contest measures nothing.
- **There is no second attempt.** The event happens once, in one room, on one day.
  A mistake discovered afterwards cannot be fixed by rerunning the day.
- **Disputes are inevitable.** Someone will say "my code works" or "I bid first". The
  organisers need a complete, timestamped record to answer them.
- **Scale is small but simultaneous.** Twenty people pressing Bid in the same second
  must produce one well-defined result, not twenty contradictory ones.

## 2.4 What happens without this product

| Situation | Without the product |
|---|---|
| Two people bid at the same moment | The auctioneer guesses who was first |
| A participant's machine crashes | Their code and answers may be lost |
| A question turns out to be broken mid-contest | Nobody can tell which submissions to re-check or who is affected |
| A participant buys a hint | Someone must hand them a slip of paper and deduct coins on a spreadsheet |
| Two participants tie | The organisers argue about who finished first |
| Someone reads a neighbour's question | Nothing technical prevents it |
| An organiser corrects a balance | Nobody later knows who changed it, when, or why |

## 2.5 What the product is intended to enable

1. A contest in which **ownership, coins, timing and scoring are enforced by the
   product**, not by people remembering to check.
2. A day organisers can run from one console, moving everyone through the phases
   together.
3. Participants who always know their balance, what they own, the time left, and
   why an action is or is not available.
4. **Complete recovery from client failures**: a crashed machine costs minutes,
   never work.
5. **Unlimited organiser authority with a complete audit trail**, so no rule can trap
   the contest in a bad state and every intervention can be justified afterwards.
6. Controlled interaction between participants (powerups) that adds strategy
   without letting anyone cause permanent harm.

## 2.6 Assumptions that are explicitly part of the product

These are facts to design around. Do not question them without an explicit
decision from the organisers.

1. **Individuals, not teams.** One person, one account, one seat.
2. **In-person, supervised.** Participants are in a proctored hall on organiser
   machines.
3. **No internet access.** The contest server is reachable only on the hall network.
4. **Scale.** About 20 participants and about 25 Phase 2 questions, so roughly 1.25
   questions per participant. The second auction therefore has few leftovers and is
   mostly a chance to spend on hints and powerups.
5. **Each Phase 2 question has exactly one owner.** This is the load-bearing rule.
6. **Programs read standard input and write standard output**, in the style of
   typical competitive programming. Participants never fill in a function stub.
7. **Coins and points are whole numbers.** No fractions, anywhere.
8. **Scoring in Phase 2 is all-or-nothing per question.** There is no partial credit
   for passing some tests.
9. **Wrong submissions carry no penalty.** Submission limits exist only to keep the
   judge responsive.
10. **Hidden testcases are never revealed to participants**, for free or for coins.
11. **Organisers can override anything**, and every override is recorded with who,
    when and why.
12. **Pricing values** (starting coins, base coins, increments, hint prices,
    powerup prices) are set by organisers per contest. The product fixes the
    *structure*, not the numbers.
13. **Phase 1 points do not carry into Phase 2.** Everyone who advances starts on
    identical coins. Phase 1 rank is used only to break an exact final tie.

## 2.7 Assumptions that must NOT be made

| Do not assume | Why |
|---|---|
| That participants can see or attempt all questions | They see only what they own |
| That the contest advances automatically when a timer ends | Organisers advance every phase; a deadline only closes work |
| That the participant's computer clock is correct | All timing is server time |
| That a disabled button is sufficient protection | Every rule holds even if a participant bypasses the screen |
| That coins are reserved when you bid | Coins move only when you win; one question is on the block at a time |
| That the fastest click wins an auction | The highest bid wins; every bid restarts the countdown |
| That a later wrong submission can un-solve a question | A solve is sticky |
| That a failed evaluation (judge fault) counts against the participant | An internal error is never the participant's fault |
| That a Shield must be switched on | A Shield works automatically while held |
| That two simultaneous Blackouts collapse into one | They add up end to end |
| That a Blackout pauses the victim's clock | Time lost to a Blackout is not given back |
| That results can be recomputed after the fact from memory | The product keeps every submission, bid, purchase and override |
| That evaluators can change the contest | They mark answers; they do not move phases, coins or ownership |
| That leaderboard visibility is fixed | Organisers choose live, frozen or hidden |
| That Phase 1 decides advancement automatically | An organiser selects who advances; there is no automatic top-N |
| That the product is used over the internet | It runs on an isolated hall network |
