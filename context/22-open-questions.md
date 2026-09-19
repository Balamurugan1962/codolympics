# 22. Open Questions, Undefined Behaviour and Known Differences

This file exists so that nobody invents a rule. It has three parts:

- **§22.1 Undefined:** situations the rules do not decide. Do not assume an answer. Ask the organisers.
- **§22.2 Known differences:** places where the product as it stood on 2026-09-15 does not yet match a
  requirement in this folder. The requirement is the source of truth; the difference is work to do.
- **§22.3 Resolved contradictions:** earlier wordings that were superseded, so older documents are not
  mistaken for current rules.

Each item says what is unclear, why it matters, and what the product does today (where relevant), so a
decision can be made quickly.

---

## 22.1 Undefined: decisions needed

### U1. Buying hints after the contest has ended
- **Question:** may a participant buy a hint once the contest is Ended?
- **Why it matters:** it cannot help them score, but it spends coins and appears in the record.
- **Today:** not prevented.
- **Suggested direction:** refuse purchases once Ended.

### U2. Buying powerups outside Phase 2, or after the contest has ended
- **Question:** buying depends only on "marketplace open". Should it also depend on the phase?
- **Today:** if an organiser leaves the marketplace open, purchases work in any phase, including Registration,
  Phase 1 and Ended.
- **Suggested direction:** organisers open it only in Phase 2. Decide whether the contest should also refuse purchases
  in Ended.

### U3. Participants who were not selected, and the marketplace and leaderboard
- **Questions:** may a non-selected participant buy powerups, use a Blackout, or be targeted by one? Should they be listed
  on the Phase 2 leaderboard (with 0 points)?
- **Why it matters:** a non-selected person could otherwise disrupt Phase 2, or be pointlessly targeted, and clutters the
  standings.
- **Today:** the marketplace is reachable by all participants, the target list includes non-selected participants, and
  the Phase 2 leaderboard lists them with 0.
- **Suggested direction:** Phase 2 features (marketplace, targeting, Phase 2 leaderboard) cover only Phase 2 participants.

### U4. Which actions a Blackout refuses beyond the core four
- **Question:** submitting, buying hints, saving Section A answers and submitting hacks are refused (bidding never is). Should
  buying or using powerups, finishing a section, saving a code draft, and cancelling a submission also be refused for a
  blacked-out participant who reaches them without the Blackout screen?
- **Why it matters:** in normal use the screen prevents all of these. A participant bypassing the screen could
  counter-attack or buy a Shield while blacked out.
- **Today:** those four (and, contrary to the rule, bids) are refused. The others are not refused by the contest itself.

### U5. The highest bidder can no longer afford their bid when the lot closes
- **Situation:** Bob holds the top bid of 500 with a balance of 500, then buys a hint for 50 before the countdown ends.
- **Question:** what happens at close? Options: refuse spending that would drop a participant below their standing top
  bid; sell to the next highest bidder; mark unsold; or leave it to an organiser.
- **Why it matters:** the sale cannot charge more than the balance, so today the lot cannot settle. It stays on the block
  with bidding closed until an organiser retracts the bid or adjusts the balance.
- **Suggested direction:** decide a rule. The simplest is to refuse any spend that would take the top bidder's balance
  below their standing bid.

### U6. The highest bidder is disqualified before the lot closes
- **Question:** does the lot still sell to them, pass to the next bidder, or become unsold?
- **Today:** nothing special happens. Organisers should retract the bid.

### U7. Advancing the phase while a lot is still on the block
- **Question:** if an organiser advances out of an auction while a question is open, should the lot be settled, withdrawn,
  or should advancing be blocked?
- **Why it matters:** today the lot is left unsettled and is only settled when the next auction begins. That delays the
  next auction's first lot, and can sell a question to a bidder long after the bidding happened.
- **Suggested direction:** block advancing (or warn loudly) while a lot is open, and settle or withdraw it first.

### U8. What "frozen" means for the Phase 1 leaderboard
- **Question:** the Phase 1 leaderboard offers live/frozen/hidden, but no freeze moment is recorded for it.
- **Today:** "frozen" behaves like "live" for Phase 1.

### U9. Finishing a section after its deadline
- **Question:** should a Finish press after the deadline (before the organiser advances) count as the submission time for
  the Phase 1 tiebreak?
- **Today:** it is recorded and counts. It changes no answers.

### U10. Breaking an exact Phase 2 tie
- **Rule:** if points, total solve time and Phase 1 rank are all equal, "organisers decide, and record why".
- **Question:** how is that decision entered and shown? There is no dedicated control. In practice Phase 1 ranks are never
  shared, so the case needs both participants to lack a Phase 1 rank.

### U11. "Reverse a purchase" and "correct standings"
- **Rule:** organisers can reverse or void a purchase and correct standings.
- **Question:** there is no dedicated control to reverse a single hint or powerup purchase, or to set a standing directly.
  Today organisers approximate these with coin adjustments, take-back (with hint refund), void, transfer and score
  overrides. Decide whether dedicated controls are needed.

### U12. Importing the same setup file twice
- **Question:** does importing a setup file into a contest that already has that content duplicate it (for example Phase 1
  questions), or recognise and skip it?
- **Suggested direction:** import once, into a fresh contest.

### U13. What the setup file should carry
- **Question:** should powerup configuration, auction mode, and marketplace open/closed be included in the exported setup?
- **Why it matters:** the organisers' stated workflow is "set everything, export, import on contest day and start". Today
  these three must be set again after importing.

### U14. Disabling Shields while participants hold them
- **Question:** should switching Shields off also stop held Shields from absorbing?
- **Today:** held Shields keep absorbing. Only buying stops.

### U15. Evaluators and live content
- **Questions:** once the contest is running, may evaluators still edit a coding question's points reward, base coins or hints?
  May they see who advances? (An earlier requirement said evaluators "cannot see or alter who advances".)
- **Today:** evaluators can edit question details and see advancement status. They cannot change the selection.

### U16. A participant viewing their own ledger
- **Question:** an earlier requirement says "a ledger of every debit is available to me and to admins". Should participants
  see their own coin history?
- **Today:** only organisers can see ledgers.

### U17. Negative hacking totals
- **Question:** with a per-miss penalty set, can a participant's Section B points, or Phase 1 total, go below zero?
- **Today:** yes. Nothing floors them at zero. Section A has no negative marking by rule. Section B has no stated floor.

### U18. Changing the starting coins after registration has begun
- **Question:** should the product warn or refuse, since it breaks "everyone starts equal"?
- **Today:** allowed silently. Existing balances are unchanged.

### U19. Unused powerups at the end
- **Question:** do unused powerups have any meaning after the contest (for example in exported results)?
- **Today:** they simply remain held, with no effect or value.

### U20. The window whose session ended because the participant signed in elsewhere
- **Requirement:** that window explains why, rather than failing silently.
- **Question:** confirm the explanation is shown on every screen, not only on the sign-in page's note.

### U22. Stacking a Blackout just before the end-of-round cut-off
- **Rule:** a Blackout cannot be used in the last *duration + duration ÷ 2* of a coding round, so a single Blackout
  always ends with half its duration left.
- **Question:** a Blackout used just before the cut-off on someone **already** blacked out starts when their current
  period ends, so it can run past the deadline. Should such a use be refused (for example: refuse if the resulting end
  would be later than *deadline − duration ÷ 2*), or allowed?
- **Why it matters:** without a decision, stacking defeats the purpose of the cut-off.

### U23. How a Blackout appears during an auction
- **Rule:** a Blackout never blocks bidding.
- **Question:** if a participant is blacked out while an auction is running (possible only if organisers make Blackouts
  usable in an auction, or advance early out of a coding round while one is running), what does their screen show? Is the
  auction floor left usable beneath or beside the Blackout screen, or does the Blackout screen not appear on the auction
  floor at all?

### U24. The cut-off in Phase 1 sections
- **Question:** if organisers make Blackouts usable in Section A or Section B (both have deadlines), does the
  end-of-round cut-off apply there too?

### U21. Optional and out-of-scope items
- **Reporting focus loss** (a participant's window losing focus, reported to organisers as advisory only) was a "could have"
  and is not part of the current product.
- **Automatic backups** of contest state are an operational requirement (recovery within a bounded interval after a server
  failure). They are outside the scope of this product description, but organisers should confirm they are in place and have
  been tested before the day.

---

## 22.2 Known differences between these requirements and the product today

| # | Requirement (this folder) | The product today |
|---|---|---|
| D1 | A participant **created by an organiser during Phase 2** is a Phase 2 participant immediately (decided 2026-09-15; [06](06-contest-lifecycle.md) §6.7.1) | They are treated as not selected until an organiser adds them to the advancing set, and see the "not selected" screen |
| D2 | A participant **not selected** cannot bid or take part in Phase 2, even by bypassing the screen (I-7) | The screen hides bidding from them, but the contest itself does not refuse their bids |
| D3 | Setup export/import supports "set everything, export, import and start" ([17](17-organiser-controls-and-corrections.md) §17.9) | Powerup configuration, auction mode and marketplace state are not carried (U13) |
| D4 | Every leaderboard setting a participant sees must mean what it says, including Phase 1 "frozen" ([21](21-ux-expectations.md) §21.7) | Phase 1 "frozen" acts as live (U8) |
| D7 | **Two currencies** (decided 2026-09-18): spendable **coins** for questions, hints and powerups, and unspendable **points** earned by solving, which rank the leaderboard ([09](09-coins-and-ownership.md) §9.1) | One currency only: a single balance is spent on everything, and the leaderboard ranks the sum of each question's "score". The split, and the per-question **points reward** as a separate number from **base coins**, are not built yet |
| D5 | A Blackout **never blocks bidding** ([13](13-powerups.md) §13.2) | Bids from a blacked-out participant are refused, and the Blackout screen covers the auction floor |
| D6 | Blackouts **cannot be used in the last *duration + duration ÷ 2*** of a coding round (decided 2026-09-15) | No cut-off exists; a Blackout can be used up to the final second |

---

## 22.3 Resolved contradictions in older documents

| Topic | Older wording | Current rule |
|---|---|---|
| Solve time after a rejudge | "First AC always sets the solve time — even if a rejudge invalidated it" | Solve time runs to the **earliest submission whose current verdict is Accepted**, so it is recomputed after a rejudge (confirmed 2026-09-12). See [11](11-scoring-and-leaderboards.md) §11.2 |
| First successful hack | "The first person-hack that breaks a given solution scores"; "nobody wastes the section re-breaking it" | Scoring is **once per participant per solution**. Other participants can still score on the same solution. See [07](07-phase1-qualifying-round.md) §7.3.4 |
| Auction increments | "Every bid must raise the current highest by exactly X" (first bid unclear) | The **first bid equals the base coins**; every later bid is exactly +X. Offline sales may be any amount at or above base |
| Section B opening | "Section B is opened by an administrator" (implying Section A opens itself) | **Every** phase, including Section A, is opened by an administrator |
| Hints "in the second auction" | Early framing of Auction 2 as the hint round | Hints are purchasable **whenever the question is owned**, in any Phase 2 phase |
| Hidden testcase reveals | Paid reveals of failing tests were once designed | **Removed.** Hidden testcases are never revealed at any price |
| Team registration | An early draft mentioned teams | **Individuals only** |
| Realtime updates | Earlier designs used a push stream | Only the outcome matters: every screen reflects changes within about a second without refresh |
