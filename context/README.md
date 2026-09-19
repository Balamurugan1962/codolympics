# Codolympics — Product Context

This folder is the **source of truth for what the product is supposed to do and why**.
It describes the problem, the people, the rules, the behaviour and the edge cases of
Codolympics, a two-phase coding competition in which participants spend **coins** to buy the right to
attempt questions at auction, and earn **points** by solving them.

It deliberately says nothing about how the product is built: no languages, frameworks,
databases, endpoints, file layouts or algorithms. Where a sentence could be read as
either a product rule or an implementation hint, read it as a product rule. The
product must behave this way; how it achieves that is outside this folder.

---

## How to read this folder

Read the files in order the first time. Each one assumes only the files before it.

| # | File | What it answers |
|---|---|---|
| 1 | [01-product-overview.md](01-product-overview.md) | What the product is, who it is for, where it is used, how a contest day runs |
| 2 | [02-problem-statement.md](02-problem-statement.md) | The real-world problem, what happens without the product, assumptions that do and do not hold |
| 3 | [03-users-and-roles.md](03-users-and-roles.md) | Participants, evaluators, administrators: what each sees and can do |
| 4 | [04-core-concepts.md](04-core-concepts.md) | Precise definitions of every domain concept, and how similar ones differ |
| 5 | [05-user-journey.md](05-user-journey.md) | The whole experience from arriving in the hall to after the contest |
| 6 | [06-contest-lifecycle.md](06-contest-lifecycle.md) | Phases, timing, deadlines, what is allowed and visible in each phase |
| 7 | [07-phase1-qualifying-round.md](07-phase1-qualifying-round.md) | Section A puzzles, Section B hacking, grading, selection |
| 8 | [08-auction.md](08-auction.md) | Lots, bidding, the countdown, online and offline auctions, auction controls |
| 9 | [09-coins-and-ownership.md](09-coins-and-ownership.md) | The two currencies (coins and points), what changes each, exclusive ownership, refunds |
| 10 | [10-problems-and-submissions.md](10-problems-and-submissions.md) | Reading a question, submitting, judging, verdicts, hints |
| 11 | [11-scoring-and-leaderboards.md](11-scoring-and-leaderboards.md) | Points, solve time, ranking, ties, live/frozen/hidden boards |
| 12 | [12-marketplace.md](12-marketplace.md) | What can be bought, limits, ownership of items, invalid actions |
| 13 | [13-powerups.md](13-powerups.md) | Blackout and Shield in full detail |
| 14 | [14-temporary-effects.md](14-temporary-effects.md) | Start, duration, stacking, expiry and contest end for timed effects |
| 15 | [15-concurrency-and-conflicts.md](15-concurrency-and-conflicts.md) | What happens when people act at the same moment |
| 16 | [16-state-transitions.md](16-state-transitions.md) | Every important state, what moves it, what is available in it |
| 17 | [17-organiser-controls-and-corrections.md](17-organiser-controls-and-corrections.md) | Every override, correction and control an organiser has |
| 18 | [18-edge-cases.md](18-edge-cases.md) | Unusual and boundary situations with expected behaviour |
| 19 | [19-rules-and-invariants.md](19-rules-and-invariants.md) | Statements that must always be true |
| 20 | [20-scenarios.md](20-scenarios.md) | Complete worked scenarios, ordinary and complicated |
| 21 | [21-ux-expectations.md](21-ux-expectations.md) | What users must understand from the experience |
| 22 | [22-open-questions.md](22-open-questions.md) | What is intentionally undefined, and where the rules and the product disagree |
| 23 | [23-glossary.md](23-glossary.md) | Short definitions of every term |

If you only need one answer, go straight to the file named for it, then check
[19-rules-and-invariants.md](19-rules-and-invariants.md) and
[22-open-questions.md](22-open-questions.md) before relying on it.

---

## Conventions

- **must / must not**: required behaviour. If the product does otherwise, the product is wrong.
- **should**: strongly expected behaviour. A deviation needs a reason.
- **Default:** the value used until an organiser changes it. Every default in this
  folder can be changed by an administrator unless the text says otherwise.
- **Undefined.**: the rules do not decide this case. Do not invent a rule. Each such
  case is also listed in [22-open-questions.md](22-open-questions.md).
- **Server time**: every deadline, countdown, "before" and "after" in this folder is
  measured by the contest's own clock, never by a participant's computer.
- **Organiser** and **administrator** mean the same role. **Staff** means
  administrators and evaluators together.
- Example people are **Alice, Bob, Charlie and Dana** (participants), **Olivia**
  (an administrator) and **Evan** (an evaluator). Everyone is referred to as
  "they".
- Example numbers (coin prices, durations, points rewards) are illustrations unless they are
  marked as defaults.
- **Coins** are the spendable currency; **points** are the reward for solving and the only thing that
  ranks anyone. They never convert into each other. See
  [09-coins-and-ownership.md](09-coins-and-ownership.md) §9.1.

## Where this came from

The content was consolidated from the project's agreed rules, its decision ledger,
its requirement documents and the behaviour of the product as it stands on
2026-09-15. Where those sources disagreed, the more recent confirmed decision wins,
and every remaining disagreement is written down in
[22-open-questions.md](22-open-questions.md) rather than silently resolved.
