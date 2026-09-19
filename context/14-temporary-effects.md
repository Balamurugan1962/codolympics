# 14. Temporary Effects

"Temporary" is never self-explanatory. This file gives exact rules for every state in the product
that starts, lasts for a time, and ends. The main one is being **blacked out**; §14.3 covers the
others (cooldowns, auction clocks, pauses, deadlines, announcements).

## 14.1 Universal rules for every timed state

1. **Server time only.** Start, end and remaining time are measured by the contest's clock. A
   participant's computer clock being wrong, fast, slow or changed has no effect.
2. **Active means "end is strictly in the future".** At the exact instant the end is reached, the
   state is over.
3. **Expiry needs no action.** Nothing has to "run" for a state to end. It is over when the time
   has passed, even if nobody is watching, the participant is offline, or the contest server was
   briefly restarted.
4. **On-screen countdowns are a display.** They show the server's remaining time. When one reaches
   zero, the screen confirms with the contest before changing what the participant may do.
5. **Fail safe.** If a screen cannot confirm (for example the connection dropped), it keeps showing
   the restrictive state instead of releasing the participant early.
6. **Fixed at start.** A timed state's end is decided when it starts, from the settings at that moment.
   Later changes to settings do not move it. Only an explicit organiser action on that specific state
   can (for example extending a phase or adjusting a lot's timer).

## 14.2 Being blacked out

### Start time
The moment a Blackout **lands**, or, if the target is already blacked out, the moment their current
blacked-out period ends (stacking).

### Duration
The Blackout's configured duration **at the moment it was used** (default 60 seconds).

### End time
Start + duration, fixed at the moment of use.

### Countdown behaviour
- The victim's Blackout screen shows the **total** remaining time: from now to the end of the **last**
  Blackout in their stack, in minutes and seconds.
- It counts down every second.
- It **jumps up** when another Blackout stacks on, by exactly that Blackout's duration.
- When more than one Blackout is running or queued, it also shows "N blackouts stacked · Ss total remaining".
- The screen names each distinct attacker whose Blackout is running or queued.
- Refreshing, reopening or signing in on another machine shows the correct remaining time straight away.

### Overlapping effects
**Blackouts never overlap.** Each one starts where the previous one ends. The total is the sum.

### Repeated effects
The same attacker using a second Blackout on the same target behaves exactly like a different attacker
doing so: it stacks. There is no cooldown between uses and no limit per target, other than how many
Blackouts the attacker holds.

### Effects applied immediately before expiry
> Alice's Blackout ends at 10:01:00. At 10:00:59.5 Dana's 60 s Blackout lands. It starts at 10:01:00 and
> ends at 10:02:00. Alice's screen goes from 0:01 to 1:01 and never lifts in between.

### Effects applied immediately after expiry
> At 10:01:00.3 Dana's Blackout lands. Alice's first one is over, so the new one starts at 10:01:00.3 and
> ends at 10:02:00.3. Alice may see the screen lift and come back within a fraction of a second, or not
> see it lift at all, depending on when the screen next checked. In either case, Alice was unable to act
> from 10:01:00.3.

### Effects applied simultaneously
> Charlie and Dana each use a 60 s Blackout on Alice at the same instant, while Alice is not blacked out.
> The contest processes them one after the other. The first runs now → +60 s, the second +60 s → +120 s.
> Alice is blacked out for **120 seconds**. Both attackers see "landed". Both Blackouts are spent. Which
> of the two is "first" makes no difference to Alice.

### Effects applied to an already affected participant
It stacks: the new one starts when the current period ends. The target list marks such participants
"already out" so attackers know their Blackout will queue rather than start now.

### Effects applied to a participant holding a Shield
The Blackout does not start at all. It is absorbed (see [13-powerups.md](13-powerups.md) §13.3). If the
participant is **already blacked out** and holds a Shield (bought earlier), the new Blackout is absorbed and
the current period is unchanged.

### What happens after expiry
- The Blackout screen lifts, once the contest confirms that nothing is running.
- The participant is exactly where they were: page, editor content, scroll position, half-typed answers.
- Everything that was refused is accepted again, subject to its usual rules.
- **Nothing is compensated.** The phase deadline was not extended, and the solve-time clock did not pause.
- The expired Blackout stays in the record.

### What happens if the phase changes while it is active
It continues, unchanged, into the next phase. It still refuses the participant's actions there (never
bidding), even if Blackouts are not *usable* in that phase. Because of the end-of-round cut-off, this only
happens when an organiser advances before the round's deadline (or in the undecided stacking case).

### What happens if the contest ends while it is active
**It stops immediately.** Once the contest is Ended, no participant is blacked out. The victim's screen lifts
at its next check, within a few seconds. There is nothing left to do in the contest anyway.

### What happens if the contest is reset
All Blackouts, Shields, purchases and participants of that run are removed with everything else.

## 14.3 Other timed states

| State | Starts | Lasts | Ends | Visible countdown | Repeated / overlapping | Contest end |
|---|---|---|---|---|---|---|
| **Submission cooldown** (per participant) | When their in-flight submission gets a verdict **or** is cancelled | 3 seconds | 3 s later | "Wait 3s" on the Submit button | Only one can exist; each finished submission starts a fresh one | Irrelevant; nothing can be submitted |
| **Hack attempt cooldown** (per participant) | When their previous attempt's result is recorded | 3 seconds | 3 s later | — ("wait a moment before trying again") | Only one | Irrelevant |
| **Submission in flight** | On a successful submit | Until a verdict or cancel; no fixed limit | Verdict or cancel | Stage and progress bar | At most one per participant, always | Continues to be judged after the round closes |
| **Opening window** (per lot) | When a lot opens | Opening window setting (default 30 s) | First bid (clock switches to countdown) or zero (unsold) | Ring "to open bids" | Only one per lot. Restarts if an organiser restarts the timer or retracts the only bid | Not applicable |
| **Bid countdown** (per lot) | On the first bid | Countdown setting (default 15 s) | Zero with no newer bid (sold) | Ring "to close" that refills | **Every new bid restarts it from full.** An organiser can add or remove seconds (never into the past), restart it, or switch it off | Not applicable |
| **Auction pause** | Organiser pauses | Until an organiser resumes | Resume | "Paused" on the ring and button | Pausing twice is refused | Not applicable |
| **Time held by a pause** | — | The pause's length | — | — | On resume, every open lot's live clock is pushed back by exactly the pause's length | — |
| **Phase deadline** (Sections A and B, Coding 1, Final) | When the phase is entered | Phase duration setting | At the deadline: that phase's work closes; the phase does **not** change | Phase countdown in the header | An organiser **extension** adds minutes to the later of the deadline and now, and may reopen a closed round | Ended has no deadline |
| **Leaderboard freeze** | Organiser switches to frozen | Until switched away | Organiser switches to live or hidden | "Leaderboard frozen — shown as of HH:MM" | Re-freezing sets a new freeze moment | Remains until changed |
| **Announcement on screen** | When the announcement arrives while the page is open | Until acknowledged | Participant presses "Got it" | None | Queued: "+2 more", shown one after another | Unaffected |
| **Connection lost banner** | After several failed checks in a row | Until the connection returns | Successful check (full refresh of the view) | None | — | — |

### Precise notes

- **Submission cooldown after cancel:** it starts at the cancel, so cancelling a slow submission and
  resubmitting still waits 3 seconds.
- **An in-flight submission prevents new submissions for its whole duration**, however long the judge takes.
  The participant's remedy is to wait or cancel.
- **Opening window → countdown handover:** the first bid cancels the opening window. There is only ever one
  live clock per lot.
- **Retracting the top bid** restarts the countdown for the previous top bidder, so the room gets its chance
  again. If no bid remains, it restarts the opening window.
- **A bid received after a lot's live clock reached zero is refused**, even if the sale has not appeared on screens.
- **A pause during a lot's final second:** the lot does not settle while paused. On resume it has that last
  second back.
