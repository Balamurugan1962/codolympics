# 19. Rules and Invariants

Statements that must **always** be true, at every moment, for every participant, whatever order things
happen in. If any of them is ever false, the product is wrong.

## 19.1 Identity and access

- **I-1** Every account has exactly one role: participant, evaluator or administrator. Staff never compete.
- **I-2** A participant has at most one active session. Signing in elsewhere ends the previous one.
- **I-3** Display names are unique, ignoring capital letters and the difference between spaces and underscores.
- **I-4** Every role restriction holds even when a request bypasses the screen. Hiding a control is never the
  only protection.
- **I-5** A participant never receives: another participant's balance, code, hints or answers; any question
  statement, sample or hint they do not own; any hidden testcase content; internal judging detail; answer keys,
  model answers, validators, reference solutions or known breaking inputs; the specific failure type of a hack attempt.
- **I-6** A disqualified participant can perform no contest action, is on no leaderboard, and cannot be targeted.
- **I-7** A participant not selected for Phase 2 cannot bid, own a question, submit, or take part in Phase 2 in any
  other way. A participant **created during Phase 2** counts as selected.

## 19.2 Contest and time

- **I-8** The contest is in exactly one phase. Phases move forward one at a time and only by an administrator (or
  back to Registration by a reset).
- **I-9** Every timing decision uses server time.
- **I-10** An action that depends on a deadline is accepted only if received before that deadline.
- **I-11** A phase change and a participant action are never interleaved. Each action is judged wholly against one phase.
- **I-12** Work received before a deadline is honoured even if its result comes later.
- **I-13** Everyone in the same phase has the same deadline. No participant has a personal clock. A late account,
  a Blackout or a disconnection never changes anyone's deadline.
- **I-14** Every connected screen reflects any change to shared state within about a second, without a refresh.

## 19.3 Coins and points

- **I-15** A coin balance is a whole number and is never negative. So is a points total.
- **I-16** Every participant created in a contest starts with the starting coins in effect when their account was
  created, and with **0 points**. (Organisers keep the starting coins identical for everyone by not changing the
  setting once registration begins.)
- **I-17** A coin balance changes only by: starting coins, winning a question, buying a hint, buying a powerup, an
  organiser refund, or an organiser adjustment. **Bids never move coins.**
- **I-17a** Points are earned only by solving an owned, non-void question, and are **never spent, transferred or
  converted into coins** (or coins into points). No purchase of any kind reduces a participant's points.
- **I-17b** A participant's total points always equals the sum of the points rewards of the questions they
  currently own and have solved. If a question is voided, taken back, transferred away, or left with no accepted
  submission after a rejudge, its points leave that participant's total at once.
- **I-18** Every balance change is recorded with its amount, reason, reference and the resulting balance. The sum of a
  participant's recorded changes equals their balance.
- **I-19** No coins, question, hint or powerup is ever transferred between participants by a participant action.
- **I-20** Every purchase charges exactly the price and delivers exactly the item, together, or does neither.
- **I-21** The same purchase attempt is never charged twice.

## 19.4 Auction and ownership

- **I-22** At most one lot is open at any moment.
- **I-23** An accepted online bid is exactly the next legal amount, is not more than the bidder's balance at that
  moment, and is not by the current highest bidder.
- **I-24** For each price step on a lot, at most one bid is accepted.
- **I-25** No bid is accepted on a lot whose live clock has reached zero, or while the auction is paused, or in an
  offline auction.
- **I-26** A sold lot charges its winner exactly the winning amount, exactly once.
- **I-27** A question has at most one current owner.
- **I-28** A void question has no owner, scores nothing and can never be sold again.
- **I-29** Pausing and resuming an auction never shortens or lengthens any lot's remaining time.
- **I-30** The auction running order cannot change after that contest's lots exist.
- **I-31** An offline sale is never below the base coins, above the winner's balance, beyond the ownership cap, or to a
  disqualified participant.
- **I-32** If an ownership cap is set, no participant owns more questions than the cap through bidding or offline sales.

## 19.5 Solving and scoring

- **I-33** Only a question's current owner can read its statement, submit to it, buy its hints or score from it.
- **I-34** A participant has at most one submission in flight, across all their questions and all their machines.
- **I-35** After a submission ends (verdict or cancel), the same participant cannot submit for 3 seconds.
- **I-36** Every submission is stored, with its server receipt time, before it is judged, and is kept for the whole contest.
- **I-37** No submission is lost or recorded as failed because of an infrastructure problem. An internal error never counts
  against a participant.
- **I-38** A later result never overwrites a newer state (a result for a cancelled, rejudged or resent attempt is ignored).
- **I-39** A question is solved exactly when its owner has at least one submission currently judged Accepted, the ownership
  is current, and the question is not void.
- **I-40** Total points is the sum of the points rewards of solved questions. Coins never affect it, and wrong
  submissions never reduce it.
- **I-41** Solve time is measured from acquisition to the receipt time of the earliest currently Accepted submission, and
  total solve time is their sum.
- **I-42** Leaderboards always correspond to the current facts (ownership, verdicts, voids, disqualifications, Phase 1
  marks), filtered only by the visibility setting for participants.
- **I-43** Participants always see a frozen leaderboard as of the freeze moment and a hidden one as hidden. Never as empty
  or current.
- **I-44** Hints on a question are bought strictly in order, each at most once per participant.
- **I-45** Hidden testcase contents are never shown to a participant, for free or for any price.

## 19.6 Phase 1

- **I-46** A Phase 1 question is visible to participants only once its section has opened, and only if published and not void.
- **I-47** A Phase 1 question can be published only while proven ready. Any edit removes proven status.
- **I-48** No Section A answer is saved after Section A closes or after the participant finished.
- **I-49** Section A correctness is never revealed while Section A is open.
- **I-50** A Section A wrong or unanswered item scores 0, never less.
- **I-51** A validator-graded answer whose checker failed is never scored 0 silently. It is flagged and provisional.
- **I-52** A participant scores hack points at most once per hacking question.
- **I-53** An invalid input or a problem error never scores and never incurs a penalty. Judge unavailability never records a failed hack.
- **I-54** A participant can always see their own Phase 1 results once Section A has closed, whatever the leaderboard setting.
- **I-55** Evaluators can never change phases, settings, coins, ownership, advancement or published content.

## 19.7 Powerups and effects

- **I-56** A participant can use only a powerup they currently hold. A use spends exactly one.
- **I-57** A participant's held count of any powerup is never negative and never above the hold limit through purchasing.
- **I-58** A participant never buys more of a powerup in a contest than its purchase limit.
- **I-59** A Blackout is never used on its user, on a disqualified participant, outside its usable phases, while disabled, or
  within the last *duration + duration ÷ 2* before a coding round's deadline.
- **I-60** One Shield absorbs exactly one Blackout, and one Blackout is absorbed by at most one Shield.
- **I-61** A used Blackout is spent whether it lands or is absorbed. A refused use spends nothing.
- **I-62** Blackouts on the same participant never overlap. The participant's total blacked-out time is the sum of landed durations.
- **I-63** A Blackout's end time is fixed when it lands and is never changed by later setting edits.
- **I-64** A participant is blacked out exactly when some landed Blackout on them has an end time in the future **and** the contest has not ended.
- **I-65** While a participant is blacked out, their submissions, hint purchases, Section A saves and hack attempts are refused.
  **Their bids are never refused because of a Blackout.**
- **I-66** A temporary effect never remains after its end time. The screen never lifts before the contest confirms the effect is over.
- **I-67** A participant's displayed blacked-out state, remaining time and attacker names match what the contest holds (allowing only the
  roughly one-second update delay).
- **I-68** A Blackout never destroys work: editor content, unsaved input and page position survive it.
- **I-69** Once the contest has ended, no powerup has any effect.

## 19.8 Organiser authority

- **I-70** Every organiser or evaluator action that changes anything is recorded with actor, time and reason.
- **I-71** Every override affecting a participant's coins, questions, bids, verdicts or eligibility notifies that participant.
- **I-72** The setup file never contains anything that happened during a run, and importing it never deletes content or overwrites an existing login.
- **I-73** A setup import into a running contest publishes nothing and changes nothing that already happened.
