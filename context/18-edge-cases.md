# 18. Edge Cases

Unusual and boundary situations, each with its expected behaviour. Cases that are genuinely undecided are
marked **Undefined** and listed in [22-open-questions.md](22-open-questions.md).

## 18.1 Joining, signing in and sessions

| # | Situation | Expected behaviour |
|---|---|---|
| E1 | A participant registers seconds before an organiser closes registration | The registration is fully processed first (the account exists with the starting coins), or it is refused as closed. Never a half-created account |
| E2 | A participant arrives after registration closed but before Section A starts | An organiser creates the account. It is identical to a self-registered one |
| E3 | A participant is created **during** Section A | Joins Section A with only the time remaining; 0 points so far ([06](06-contest-lifecycle.md) §6.7.1) |
| E4 | A participant is created **during** Coding round 1 | A Phase 2 participant immediately, with the same starting coins, 0 points and no questions; the same round deadline as everyone; can bid in Auction 2 |
| E5 | A participant is created during an auction, while a lot is open | Can bid on the open lot straight away, and on every lot after it |
| E6 | The starting coins setting was changed after some participants registered | Existing balances do not change. New accounts get the new value, so participants may not start equal. Organisers should set it before registration and fix differences with adjustments |
| E7 | Two people try to register "Alice" and "alice" | Same name: the second is refused |
| E8 | Someone registers "Ali-ce" | Refused as an invalid name (hyphens are not allowed) |
| E9 | A participant forgets their password | An organiser resets it |
| E10 | A participant signs in on a second machine while the first is still open | The first machine's session ends. Its next action fails as signed out, and it should explain why. All state is intact on the second machine |
| E11 | A participant's machine crashes mid-edit | On a spare machine they get their last saved draft (saved within moments of typing), all answers, balance, questions, hints, submissions and powerups |
| E12 | A participant disconnects (network) and returns | After a few failed checks a red "connection lost" banner appears. On reconnection the whole view refreshes from the contest, and any change that happened meanwhile (a verdict, a phase change, a Blackout) appears at once. Work typed while disconnected stays on screen, and drafts show "Not saved!" until a save succeeds |
| E13 | A participant's tab was hidden or asleep for 40 minutes | On return the view refreshes from the contest; nothing is trusted from before |
| E14 | A participant's computer clock is 5 minutes fast | Every countdown still shows server time |
| E15 | A staff member signs in on two machines | Allowed; both sessions stay open |

## 18.2 Phase boundaries and time

| # | Situation | Expected behaviour |
|---|---|---|
| E16 | An answer saves 0.2 s before Section A's deadline (server time) | Saved and counts |
| E17 | An answer arrives 0.2 s after the deadline | Refused. The answer as last saved counts. The screen shows it is closed |
| E18 | A participant was typing up to the last second | Only what was received before the deadline counts. The save status shows whether the last change reached the contest |
| E19 | Section A's deadline has passed but the organiser has not advanced | Answers stay refused. The screen says Section A is closed. Participants wait |
| E20 | An organiser extends Section A after its deadline passed | The section reopens until the new deadline. Answers can be changed again, except for participants who pressed Finish |
| E21 | A participant presses Finish after the deadline passed but before the organiser advanced | Their answers were already locked by the deadline. Finishing records a time but changes no answer. **Undefined:** whether a finish after the deadline should affect the Phase 1 tiebreak |
| E22 | A participant never presses Finish | Their answers count as last saved. For ties they rank after equal-points participants who did finish |
| E23 | Submission received at 89:59, verdict at 90:03 | Counts |
| E24 | Submission attempted at 90:01 | Refused, "this round has closed" |
| E25 | Coding round 1 closed, Auction 2 not yet open | Submissions refused. Once Auction 2 opens they are accepted again |
| E26 | A participant attempts to submit, bid, answer or hack after the contest ended | Refused. The ended screen shows nothing actionable |
| E27 | A participant tries to buy a hint after the contest ended | **Undefined** |
| E28 | A participant tries to buy a powerup after the contest ended while the marketplace was left open | **Undefined** |
| E29 | An organiser advances out of an auction while a question is still on the block | **Undefined.** Organisers should let it settle, close it or withdraw it first |
| E30 | An organiser advances to Auction 2 with a lot from Auction 1 never offered (still pending) | Its question is still unsold, so it is offered in Auction 2 |

## 18.3 Auction

| # | Situation | Expected behaviour |
|---|---|---|
| E31 | Nobody bids on a question | Unsold after the opening window. Offered again in Auction 2 at the same base coins |
| E32 | Nobody bids on it in Auction 2 either | Stays unsold for the rest of the contest. An organiser may assign it to someone at a set price |
| E33 | A participant bids exactly their whole balance | Allowed. If they win, their balance becomes 0 |
| E34 | A participant tries to bid 1 more than their balance | Refused: "you have B; this bid is N" |
| E35 | The only bidder on a lot retracts nothing and simply waits | They win when the countdown ends |
| E36 | A participant tries to outbid themselves | Refused: "you already hold the highest bid" |
| E37 | The highest bidder is blacked out during a lot | They may keep bidding, and they win if they are highest when the countdown ends. A Blackout never blocks bidding |
| E38 | The highest bidder is disqualified while holding the top bid | **Undefined.** Organisers should retract the bid |
| E39 | The highest bidder buys a hint or powerup, bringing their balance below their bid, before the lot closes | **Undefined.** The sale cannot charge more than they have. Organisers should retract the bid or adjust. Participants should not be able to reach this state unnoticed |
| E40 | The ownership cap is reached by winning the current lot | Their bids on later lots are refused with "you already own the maximum of N questions" |
| E41 | Countdown set to 0 | Lots with bids never close on their own; an organiser closes each one |
| E42 | An organiser "adds −30 seconds" to a lot with 10 seconds left | The lot is left with at least 1 second. It cannot be moved into the past |
| E43 | An organiser restarts the timer when the countdown setting is 0 | Refused: "the countdown is set to 0 in Settings, so there is nothing to restart" |
| E44 | A mistaken bid by Bob is retracted, and Alice held the bid before | Alice is the highest bidder again at Alice's earlier amount. The countdown restarts. Bob is notified with the reason |
| E45 | The only bid on a lot is retracted | The lot returns to no bids and its opening window restarts |
| E46 | A lot is withdrawn after bids | Nothing sold, no coins change hands, bids kept for the record. The next lot opens |
| E47 | A withdrawn lot is restored | Placed at the end of the queue, fresh, with no bids |
| E48 | An offline sale is recorded at 137 on a base of 100 with increment 10 | Accepted; the increment does not apply offline |
| E49 | An offline sale is recorded at 90 on a base of 100 | Refused: "the base price is 100 coins" |
| E50 | The organiser tries to switch from offline to online during Auction 1 | Refused: "finish or leave the auction round before changing how it is run" |
| E51 | A participant who was not selected tries to bid | Refused. Their screen never offers bidding |
| E52 | Every lot has been offered | No lot is open. Everyone waits for the organiser to advance |
| E53 | A participant wins nothing in either auction | A legitimate outcome, clearly explained on their screen. An organiser may assign an unsold question at their discretion |

## 18.4 Solving

| # | Situation | Expected behaviour |
|---|---|---|
| E54 | A participant opens a question they do not own by typing its address | "You don't own this question". Nothing about it is revealed |
| E55 | Submitting while a previous submission is judging | Refused, "your previous submission is still being judged". Code kept |
| E56 | Submitting 2 seconds after a verdict | Refused, "wait 1 s before submitting again" |
| E57 | Cancel, then immediately resubmit | Refused until 3 seconds after the cancel |
| E58 | Accepted, then a Wrong answer on a later submission | Still solved. Solve time unchanged |
| E59 | Accepted twice | Solve time from the earlier one |
| E60 | A rejudge turns the first Accepted into Wrong answer; a later submission is still Accepted | Still solved. Solve time now measured to the later Accepted submission |
| E61 | A rejudge turns every Accepted into Wrong answer | No longer solved. Its points and time are removed. The participant may try again |
| E62 | The judge returns an internal error | Not counted against the participant. Cooldown starts. They may resubmit |
| E63 | The judge is down for several minutes | Submissions wait and are retried. Participants are told their work is safe. Organisers see the judge as unreachable, prominently |
| E64 | The failing test is a sample | The explanation points to output format |
| E65 | A question has 0 hints | "No hints for this question" |
| E66 | A participant has exactly the hint's price | Allowed; balance becomes 0 |
| E67 | A participant has 1 less than the hint's price | Refused; nothing charged |
| E68 | The source is larger than 256 KB | Refused; code kept on screen |
| E69 | A participant owns a question that gets voided while they are editing it | It disappears from their questions. They are notified with the refund. Submitting is refused. Their editor content is not destroyed while the page is open |
| E70 | A participant is disqualified mid-submission | The submission may finish judging. They score nothing, because disqualified participants are not on the leaderboard |

## 18.5 Marketplace and powerups

| # | Situation | Expected behaviour |
|---|---|---|
| E71 | A participant targets themselves | Impossible from the screen (they are never listed). If attempted anyway: refused, "you cannot use that on yourself", nothing spent |
| E72 | A participant is targeted multiple times | Every Blackout that lands stacks end to end. Each Shield absorbs one. The screen names each attacker and shows the total remaining |
| E73 | Not enough coins for a powerup | Buy unavailable with "You have 90; this costs 150". A forced attempt is refused, and nothing is charged |
| E74 | Buying a disabled powerup | It is not listed. A forced attempt is refused: "not on sale" |
| E75 | Buying when already at the hold limit | Refused: "you can hold at most 3" |
| E76 | Buying beyond the lifetime purchase limit, even after using some | Refused: "you have used your 2 for this contest" |
| E77 | Using a Blackout in a phase where it is not usable | Refused, nothing spent. "not usable now" shown |
| E78 | Using a Blackout on a participant who is already blacked out | Stacks. Target list shows "already out" |
| E79 | Using a Blackout on a shielded participant | Absorbed. Both items spent. Target list showed "shielded" beforehand |
| E80 | Using a Blackout on a disqualified participant | Listed as "out of the contest" and cannot be chosen. A forced attempt is refused, nothing spent |
| E81 | A temporary effect expires | The screen lifts after the contest confirms; the participant is exactly where they were |
| E82 | Multiple temporary effects overlap | They cannot overlap; they queue end to end |
| E83 | Someone tries to use a Blackout 5 seconds before the Final round ends | Refused: inside the cut-off (last 90 s for a 60 s Blackout); nothing spent |
| E83a | A Blackout is used 1 second before the cut-off | Lands; ends with half its duration still left in the round (30 s for 60 s) |
| E83b | The round is extended while inside the cut-off | Blackouts become usable again until the new cut-off |
| E83c | A Blackout is used just before the cut-off on someone already blacked out, so the stack would run past the deadline | **Undefined** |
| E84 | A Blackout is still running when the contest is ended | It stops immediately. The screen lifts at the next check |
| E85 | A Blackout from Coding round 1 is still running when Auction 2 opens (the organiser advanced early) | It continues and still refuses submissions and hints, but **never bids**. How its screen coexists with the auction floor is **Undefined** |
| E86 | A participant refreshes, opens a new tab, or signs in elsewhere while blacked out | The Blackout screen is back at once with correct remaining time |
| E87 | The victim is offline for the whole Blackout | It expires on time. On return, no Blackout is shown |
| E88 | An organiser edits the Blackout duration mid-Blackout | The running Blackout is unaffected |
| E89 | An organiser disables Shields while participants hold them | Held Shields still absorb. Shields can no longer be bought (see [22](22-open-questions.md)) |
| E90 | The marketplace is closed while a participant holds a Blackout | They can still use it in usable phases |
| E91 | A participant tries to "activate" a Shield | Refused, nothing spent: "there is nothing to activate" |
| E92 | The same Blackout use is sent twice (double click or retry) | Used once; one landing or absorption |
| E93 | A participant who was not selected opens the marketplace | **Undefined** whether they may buy or use powerups, or be targeted |
| E94 | A blacked-out participant reaches the marketplace without the screen and buys or uses | **Undefined** whether the contest must refuse it (the screen prevents it in normal use) |

## 18.6 Leaderboards

| # | Situation | Expected behaviour |
|---|---|---|
| E95 | A participant's rank changes while their leaderboard is open | The table updates in place within about a second; their row stays highlighted |
| E96 | Leaderboard frozen, and a participant solves after the freeze | Not reflected for participants until unfrozen. Staff see it |
| E97 | Leaderboard frozen, a submission received before the freeze is judged Accepted after it | Reflected |
| E98 | Leaderboard hidden | "Standings are hidden", never an empty table. Own rank not shown on the coding screen |
| E99 | Two participants with identical points, total time and Phase 1 rank | They share a rank. Organisers decide with a recorded reason. (In practice Phase 1 ranks are never shared, so this requires both to lack a Phase 1 rank) |
| E100 | Nobody has solved anything yet | Everyone on 0, ordered by Phase 1 rank. "Scores appear once someone solves a question" if the list is empty |
| E101 | A question is voided that put its owner in first place | They drop immediately, and everyone's view updates |
| E102 | A participant who was not selected appears on the Phase 2 leaderboard | **Undefined** whether non-selected participants are listed (with 0) |

## 18.7 Organiser mistakes and conflicts

| # | Situation | Expected behaviour |
|---|---|---|
| E103 | Two organisers press Advance together | One phase forward; the second is told |
| E104 | An organiser tries to remove an account during Coding round 1 | Refused; disqualify instead |
| E105 | An organiser assigns a sold question | Refused: "only an unsold question can be assigned" |
| E106 | An organiser takes back a question nobody owns | Refused: "nobody owns that question" |
| E107 | An organiser adjusts a balance of 50 by −80 | Refused; would be negative |
| E108 | An organiser voids a question nobody owns | It becomes void; no refunds; announced |
| E109 | An organiser imports a setup file mid-contest | Content is added but nothing is published. Nothing that happened is changed. The summary warns |
| E110 | An organiser imports the same setup file twice | **Undefined** whether content is duplicated |
| E111 | An organiser types the wrong reset phrase | Refused: 'type "reset the contest" to confirm' |
| E112 | An organiser edits a proven puzzle during Section A | It becomes unproven. It stays published. The edit is recorded. Participants see the edited text |
