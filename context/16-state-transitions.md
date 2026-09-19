# 16. State Transitions

For each important state machine: the states, what moves between them, what the user sees, and what they
can and cannot do in each state.

---

## 16.1 A participant's experience, end to end

```
 Not registered
      │ registers (registration open)  /  organiser creates the account (any time)
      ▼
 Waiting (Registration)
      │ organiser advances to Section A
      ▼
 Section A: answering ──finish──► Section A: finished ──┐
      │ deadline passes                                   │
      ▼                                                   │
 Section A: closed ◄──────────────────────────────────────┘
      │ organiser advances to Section B
      ▼
 Section B: hacking ──finish──► Section B: finished ──┐
      │ deadline passes                                 │
      ▼                                                 │
 Section B: closed ◄────────────────────────────────────┘
      │ organiser advances to Review
      ▼
 Review: awaiting decision ──selected──► Review: through to the auction
      │ not selected                              │
      ▼                                           │ organiser advances to Auction 1
 Not selected (for all of Phase 2) ──► Ended      ▼
                                   Phase 2 participant:
                                   Auction 1 ─► Coding 1 (open ─► closed) ─► Auction 2 ─► Final (open ─► closed)
                                                                                                │
                                                                                                ▼
                                                                                              Ended

Overlays that can appear on top of any participant state:
   ◆ Blacked out   (Blackout landed; lifts when it expires or the contest ends)
   ◆ Announcement  (lifts when acknowledged)
   ◆ Disqualified  (banner; every action refused until requalified)
   ◆ Connection lost (banner; lifts on reconnection)
```

A participant **created during Phase 2** enters directly as a Phase 2 participant in the current phase
(see [06-contest-lifecycle.md](06-contest-lifecycle.md) §6.7.1).

| State | Sees | Can | Cannot | Leaves by |
|---|---|---|---|---|
| Not registered | Sign-in and registration pages | Register (if open); sign in | Anything else | Registering, or being created |
| Waiting | Welcome screen: status, live clock, the day's shape, rules | Read; sign out; open the leaderboard (usually empty) | Answer, bid, submit | Organiser advances |
| Section A: answering | Questions, autosave status, countdown, Submit & finish | Answer, change answers, finish | Hack, bid, see correctness | Finishing; deadline; organiser advancing |
| Section A: finished / closed | Locked answers; "You finished" / "Section A is closed" | Read | Change any answer | Organiser advances |
| Section B: hacking | Flawed solutions, input box, attempts, countdown | Submit attempts (one at a time), finish | See verdict details; withdraw attempts | Finishing; deadline; organiser advancing |
| Section B: finished / closed | Attempts and their outcomes | Read | Submit attempts | Organiser advances |
| Review | "Phase 1 is over"; own results; standings (if visible) | Read results | Answer, hack, bid | Selection decided; organiser advances |
| Not selected | "You were not selected for Phase 2. You can still follow the contest to the end." | View own Phase 1 results and leaderboards | Bid, own, submit, use powerups | Contest ends (or an organiser revises the selection before Phase 2 opens) |
| Auction (Phase 2 participant) | Auction floor; running order; balance | Bid (online); submit for owned questions; buy hints; buy powerups (if open); use Blackout (if usable) | Bid offline; see statements of lots | Organiser advances |
| Coding round: open | Coding round screen, workspace | Submit, buy hints, buy and use powerups (per rules) | Bid | Deadline passes (→ closed) |
| Coding round: closed | "Round closed" state, countdown at 0 | Read, buy hints | Submit | Organiser advances; organiser extends (→ open) |
| Ended | "That's the contest", final rank if visible | Read standings, own history | Submit, bid, answer, hack, use powerups | Contest reset |

---

## 16.2 Contest phase

| From | To | Caused by | Everyone sees after |
|---|---|---|---|
| Registration | Section A | Admin advance (registration closed, ≥1 participant, ≥1 published puzzle) | Section A screen, countdown |
| Section A | Section B | Admin advance (≥1 published hacking question, each judgeable) | Section B screen, countdown |
| Section B | Review | Admin advance | Review screen |
| Review | Auction 1 | Admin advance (≥1 selected, questions exist on judge) | Auction floor / not-selected screen |
| Auction 1 | Coding round 1 | Admin advance | Coding round screen, countdown |
| Coding round 1 | Auction 2 | Admin advance | Auction floor |
| Auction 2 | Final round | Admin advance | Coding round screen (Final), countdown |
| Final round | Ended | Admin advance | Ended screen |
| any | Registration | Admin **reset** (typed confirmation) | Everything returns to the start; see §17.8 |

Within a timed phase: **open → closed** when the deadline passes; **closed → open** if an organiser extends past now.

---

## 16.3 Being blacked out

```
            Blackout lands (no Shield)                  another Blackout lands
 Normal ────────────────────────────────► Blacked out ─────────────────────────┐
   ▲                                          │   ▲                            │
   │  last Blackout's end passes              │   └──── (end moves later) ─────┘
   │  (screen confirms with the contest)      │
   └──────────────────────────────────────────┤
   ▲                                          │ contest advances to Ended
   └──────────────────────────────────────────┘
```

| | Normal | Blacked out |
|---|---|---|
| **Enters by** | Last Blackout expiring; contest ending | A Blackout landing on them |
| **Sees** | Whatever page they were on | Full-screen "You've been blocked out", attacker names, countdown, stacked count |
| **Can** | Everything their other states allow | Wait. Their earlier submission keeps being judged |
| **Cannot** | — | Submit, buy hints, save Section A answers, submit hacks; interact with the product through the screen. **Bidding is never blocked** |
| **On leaving** | — | The screen lifts. They are exactly where they were: page, editor, scroll, half-typed input. Actions allowed again |
| **Blocked Blackout attempt (they hold a Shield)** | Stays Normal; Shield count −1; notification | Stays Blacked out, unchanged; Shield count −1; notification |

---

## 16.4 Holdings: Blackouts and Shields

| Item | From → To | Caused by |
|---|---|---|
| Blackout | held n → held n+1 | Buying (marketplace open, affordable, within limits) |
| Blackout | held n → held n−1 | Using it on a valid target, whether it **lands** or is **absorbed** |
| Blackout | held n → held n | Any refused use (wrong phase, end-of-round cut-off, invalid target, disabled, no duration). Nothing spent |
| Shield | held n → held n+1 | Buying |
| Shield | held n → held n−1 | Absorbing a Blackout aimed at the holder |
| Shield | held n → held n | An attempt to "activate" it (refused); any phase change; marketplace closing; contest ending |

Visible marker for others: "shielded" when held ≥ 1, removed when it reaches 0.

---

## 16.5 Marketplace

| State | Participants see | Can | Cannot |
|---|---|---|---|
| **Closed** (default) | "The marketplace is closed — … Anything you already hold still works." Buy buttons unavailable with the reason | Use held Blackouts in usable phases; Shields keep absorbing | Buy |
| **Open** | Items with Buy/Use availability and reasons | Buy (within rules); use in usable phases | — |

Moves between them only by an administrator changing the setting.

---

## 16.6 A powerup's usability in the current phase

| State | Caused by | Blackout "Use" | Blackout already landed |
|---|---|---|---|
| **Usable now** | Current phase is in its usable phases, it is enabled, and (in a coding round) the cut-off has not been reached | Available if held | Runs |
| **Not usable now** | Phase not in usable phases, or disabled | Unavailable: "Not usable in this part of the contest." / "switched off" | **Still runs** to its end |
| **Cut-off** | The last *duration + duration ÷ 2* before a coding round's deadline (90 s by default); lifts if the round is extended | Unavailable: "Blackouts are disabled for the last 90 seconds of the round." | **Still runs** to its end |

---

## 16.7 Auction (whole)

| State | Caused by | Participants see | Bids | Lots settle / open |
|---|---|---|---|---|
| Not auctioning | Any non-auction phase | No auction floor | Refused | No |
| **Running (online)** | Entering an auction phase in online mode; resume | Ring, button, feed | Accepted per rules | Yes, by the clocks |
| **Running (offline)** | Entering an auction phase in offline mode; resume | Board, "in the room" | Refused ("happens in the room") | Only when an organiser records a result |
| **Paused** | Organiser pauses | "Paused"; clock stopped | Refused | No; offline results cannot be recorded |

Paused → Running: organiser resumes, and all clocks regain exactly the paused time.

---

## 16.8 Lot

| From | To | Caused by | Notes |
|---|---|---|---|
| — | Pending | An auction phase starts (question eligible for that round) | Listed as "to come" |
| Pending | Open | No other lot is open and the auction is running | Opening window starts (online) |
| Open | Open (clock change) | Bid (countdown restarts); organiser timer off/restart/adjust; retract top bid | |
| Open | **Closed (sold)** | Countdown ends with a bid (online); organiser "close now" with a bid; offline sale recorded | Winner charged, owns question |
| Open | **Unsold** | Opening window ends with no bid; organiser "close now" with no bid; offline "unsold" recorded | Returns in Auction 2 |
| Pending / Open | **Withdrawn** | Organiser withdraws | Nothing sold; bids kept |
| Withdrawn | Pending (end of queue) | Organiser restores | Fresh, as if never offered |
| Closed | Pending (end of queue) | Organiser takes the question back **with relist** | Question becomes unsold |
| Closed / Unsold | — (cannot be withdrawn) | — | "take the question back instead" |

---

## 16.9 Question status (Phase 2)

| From | To | Caused by |
|---|---|---|
| Unsold | Sold | Lot sold; organiser assigns it |
| Sold | Unsold | Organiser takes it back |
| Unsold / Sold | **Void** | Organiser voids it (refunds by default; announced) |
| Void | — | Final. Never sold again, never scores |
| Sold (owner A) | Sold (owner B) | Organiser transfers ownership (no coins; B's solve clock starts) |

---

## 16.10 Submission and judging

```
 submit ──► Waiting to send ──► Queued ──► Running (test k of n) ──► Verdict
               │                  │             │
               └──────────────────┴─────────────┴──► Cancelled (by the participant)

 Judge unreachable / restarted: Queued or Running ──► Waiting to send (automatically resent)
 Rejudge: Verdict ──► (kept for the record) + new Waiting to send
```

| State | Participant sees | Submit button | Can |
|---|---|---|---|
| Waiting to send / Queued | "Sending to the judge" / "Queued — waiting for a free slot" | "Judging…", unavailable | Edit code, cancel |
| Running | "Running test k of n", progress bar | "Judging…", unavailable | Edit code, cancel |
| Verdict | Verdict and explanation | "Wait 3s", then "Submit" | Everything |
| Cancelled | "You cancelled this submission…" | "Wait 3s", then "Submit" | Everything |

Participant submit availability:

```
 Ready ──submit──► In flight ──verdict or cancel──► Cooldown (3 s) ──► Ready
```

Also unavailable when: not owner, round closed, contest ended, question void, blacked out, disqualified.

---

## 16.11 Question progress (as shown to the owner)

| State | Meaning | Moves to |
|---|---|---|
| Not started | Owned, no submissions | Judging (on submit) |
| Judging | A submission for it is in flight | Solved (Accepted) / Attempted (anything else) |
| Attempted | Has submissions, none currently Accepted | Judging; Solved (after a rejudge) |
| Solved | At least one current Accepted | Judging (on a new submit; still counts as solved) · Attempted only if a rejudge removes every Accepted |

---

## 16.12 Hints on one owned question

```
 Hint 1: Available to buy ──buy──► Bought (visible for the rest of the contest)
 Hint 2: Locked (until hint 1 bought) ──► Available to buy ──buy──► Bought
 …
 All bought ──► "Every hint is revealed"
```

A take-back **with hint refund** returns bought hints on that question to "not bought". A void keeps them on record.

---

## 16.13 Section A answer (per participant, per puzzle)

| State | Caused by | Participant sees |
|---|---|---|
| Unanswered | — | Empty control |
| Saved (editable) | An accepted autosave | "Saved" |
| Not saved | A refused or failed save (bad format, blacked out, connection) | "Not saved" / the reason |
| Locked | Finish, or section closed | "Locked"; answer read-only |
| Scored: auto | Known internally since saving; revealed after close | Mark in own results |
| Scored: validator pending → done / error | Section closes → checker runs | "pending" → mark, or provisional if error |
| Ungraded → graded (manual / explanation) | Evaluator marks it | "pending" → mark and comment |

---

## 16.14 Hack attempt

```
 submitted ──► judging ──► invalid input      (0, no penalty)
                      ├──► hacked              (+points if first for this participant on this solution, else 0)
                      ├──► did not break it    (−penalty, default 0)
                      └──► problem error       (0, not counted)
 judge unreachable: judging ──► judging (retried; never becomes "did not break it")
```

---

## 16.15 Phase 1 question (authoring)

| From | To | Caused by |
|---|---|---|
| Draft (not ready) | Ready | Self-test passes; or imported as proven elsewhere |
| Ready | Not ready | Any edit; a failing self-test |
| Ready | Published | Admin publishes |
| Not ready | — (cannot publish) | "run the self-test first" / "prove a breaking input first" |
| Published | Unpublished | Admin unpublishes |
| Any | Voided | Admin voids (scores nothing for anyone) |

---

## 16.16 Advancement and disqualification

| From | To | Caused by | Participant told |
|---|---|---|---|
| Undecided | Selected / Not selected | Admin sets the selection (reason) | Notification |
| Selected ⇄ Not selected | — | Admin revises before Phase 2 opens | Notification |
| — | Selected | Created by an admin during Phase 2 | — |
| Active | Disqualified | Admin disqualifies (reason) | Notification + persistent banner |
| Disqualified | Active | Admin requalifies (reason) | Notification |

---

## 16.17 Session and connection

| State | Caused by | Sees |
|---|---|---|
| Signed out | Sign out; session expired; **participant signed in elsewhere** | Sign-in page (the ended window should explain why) |
| Signed in | Successful sign-in | The contest |
| Connecting | Page just loaded | Normal page (no alarm) |
| Connected | Checks succeeding | No indicator (silence is healthy) |
| Connection lost | Several checks in a row fail | Red banner "Connection to the contest server lost — reconnecting. If this stays, raise your hand." |
| Connected again | A check succeeds | Banner gone; the whole view refreshed from the contest |

---

## 16.18 Leaderboard visibility

This applies fully to the Phase 2 leaderboard. The Phase 1 leaderboard has the same three settings, but
what "frozen" means for Phase 1 is **Undefined**; see [22-open-questions.md](22-open-questions.md).

| From | To | Caused by | Participants see |
|---|---|---|---|
| Live | Frozen | Admin | Standings as of this moment, plus a notice |
| Frozen | Live | Admin | Everything since the freeze, at once |
| Any | Hidden | Admin | "Standings are hidden" |
| Hidden / Frozen | Frozen | Admin | A **new** freeze moment (now) |
