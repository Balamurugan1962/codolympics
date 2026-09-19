# 13. Powerups

This file defines every powerup independently of any screen. Buying is in
[12-marketplace.md](12-marketplace.md). The general rules for timed states are in
[14-temporary-effects.md](14-temporary-effects.md).

There are exactly two powerups: **Blackout** and **Shield**.

## 13.1 Principles that apply to both

1. **The server decides everything.** Prices, limits, whether an item is held, whether a Blackout is
   still running and whether a Shield exists are all decided by the contest at the moment of the action.
   A participant's screen only shows the result.
2. **Obstructive, never destructive.** A powerup can cost a participant **time**. It can never cost them
   **work**, coins, questions, answers or submissions.
3. **One attempt is processed once.** A double click or a retried request never uses two items.
4. **Nothing is transferable or refundable** by participants.
5. **Every purchase and every use is recorded** (who, against whom, outcome, cost, time).
6. **Once the contest has ended, powerups have no effect**, and no Blackout is running on anyone.

---

## 13.2 Blackout

### Name
**Blackout** (organisers may rename it; the behaviour does not change).

### Purpose
Temporarily take another participant out of the contest, costing them time they cannot get back, at a
moment the attacker chooses.

### Who can use it
A participant who:
- **holds** at least one Blackout;
- is **not disqualified**;
- chooses a target **other than themself**.

(**Undefined:** whether a participant who was not selected for Phase 2 may use one. See
[22-open-questions.md](22-open-questions.md).)

### Who it affects
**Exactly one target**: any other participant who is not disqualified. The attacker is never affected.

### When it can be used
- Only while the current phase is one of the Blackout's **usable phases** (default: **Coding round 1** and
  **Final round**; organisers may add Section A, Section B, Auction 1 or Auction 2).
- Only while the Blackout is **enabled**.
- Only if it has a **duration** configured.
- **Not during the end-of-round cut-off** (see below).
- Never in Registration, Review or Ended.
- It does **not** require the marketplace to be open.

#### The end-of-round cut-off

In a coding round (Coding round 1 or Final round), **using a Blackout is disabled during the last
*duration + half the duration* before the round's deadline.**

`cut-off moment = round deadline − (duration + duration ÷ 2)`

| Blackout duration | Disabled for the last… | Latest a used Blackout can end |
|---|---|---|
| 60 s (default) | 90 s | 30 s before the deadline |
| 30 s | 45 s | 15 s before the deadline |
| 120 s | 180 s | 60 s before the deadline |

- **Why:** a Blackout should cost its victim working time, not the end of the round. A Blackout used just
  before the cut-off still ends with half its duration left in the round, so the victim always gets time back
  to submit.
- The cut-off uses the Blackout's **current** duration setting and the round's **current** deadline. If an
  organiser **extends** the round, the cut-off moves with the new deadline, and Blackouts become usable again
  until the new cut-off.
- A use received **at or after** the cut-off moment (server time) is refused, and **nothing is spent**:
  "Blackouts are disabled for the last 90 seconds of the round."
- The marketplace shows the Use button as unavailable with that sentence from the cut-off moment onwards.
- A Blackout that **landed before** the cut-off is unaffected and runs to its end.
- Phases with no deadline (auctions) have no cut-off. **Undefined:** whether the cut-off also applies in Section A
  or Section B, if organisers make Blackouts usable there.
- **Undefined:** a Blackout used just before the cut-off on a participant who is **already** blacked out stacks
  after their current period, and so may run past the deadline. Whether that use should be refused is not yet
  decided (see [22-open-questions.md](22-open-questions.md)).

> **Example.** Coding round 1 ends at 11:30:00; Blackout duration 60 s. The cut-off is 11:28:30.
> Charlie uses a Blackout on Alice at 11:28:29: it lands and runs until 11:29:29, leaving Alice 31 seconds.
> Dana tries at 11:28:31: refused, and Dana still holds the Blackout for the Final round.

### What happens immediately on use

The attacker's action is processed as one indivisible step:

1. The attacker's held Blackouts go down by **one**, whatever the outcome.
2. **If the target holds a Shield:** the target's held Shields go down by one. The Blackout is
   **absorbed**, and nothing else happens to the target (see §13.3).
3. **Otherwise the Blackout lands:**
   - It starts **now**, or, if the target is **already blacked out**, at the moment their current
     blacked-out period ends (see §13.4).
   - It ends **duration** seconds after it starts. That end time is fixed now and never changes, even
     if the setting is later edited.
   - The target receives a notification: "**Charlie** blacked you out for 60 seconds."
4. The attacker is told the outcome ("Alice is blacked out" or "Blocked by a Shield") and how many
   Blackouts they still hold.
5. The target's screen reflects the new state **within about one second**.

### How long it lasts
Its configured **duration** at the moment it was used (default 60 seconds), measured in server time. When
several are stacked, the total is the sum (§13.4).

### What the target experiences

**Their whole screen is covered**, whatever they were doing: coding, reading a statement, answering a
puzzle, looking at the leaderboard.

**Bidding is never blocked by a Blackout.** A blacked-out participant can still bid, both as far as the
contest's rules go and on their screen. How the Blackout screen and the auction floor appear together (a
Blackout is only active during an auction if organisers make Blackouts usable in an auction, or advance the
contest early while one is running) is **Undefined**; see [22-open-questions.md](22-open-questions.md).

The Blackout screen shows:
- **"You've been blocked out"**;
- **who** did it: "Charlie used a Blackout on you." / "Charlie and Dana used Blackouts on you."
  (each name once);
- a **large countdown** of the total time remaining (minutes:seconds);
- when more than one is stacked: "**2 blackouts stacked · 95s total remaining**";
- "Nothing is lost. Your work is saved and you will come back to exactly where you were. Refreshing or
  opening another tab will not clear this — the clock is on the server."

While blacked out, **these actions are refused by the contest itself**, even if attempted without the screen:

| Refused while blacked out | Message (in substance) |
|---|---|
| Submitting code | "you are blacked out for another 42 seconds" |
| Buying a hint | same |
| Saving a Section A answer | same |
| Submitting a Section B hack attempt | same |

The screen also stops the participant from doing anything else through the product (navigating, typing in
the editor, opening the marketplace) until the Blackout lifts. (**Undefined:** whether buying or using
powerups, finishing a section, or saving a draft should also be refused by the contest itself for someone
who reaches them without the screen. See [22-open-questions.md](22-open-questions.md).)

**What keeps happening while blacked out:**
- **The phase clock keeps running.** A Blackout never extends a round for its victim.
- **The victim's solve-time clock keeps running** on every question they own.
- A submission they made **before** the Blackout **continues to be judged**. Its verdict is recorded and
  visible when the screen lifts.
- **Their bids are unaffected.** Bids they already hold stand, and they may keep bidding.
- Their draft code and half-typed answers stay exactly as they were on screen.

### What happens when it expires

1. When the victim's countdown reaches zero, the screen **asks the contest** whether the Blackout is really
   over. It does not lift on the local count alone.
2. If the contest confirms nothing is still running, **the screen lifts** and the participant is **exactly where
   they were**: same page, same editor content (including unsaved text), same scroll position, same
   half-typed answer.
3. If another Blackout is still stacked, the screen stays up with the new remaining time.
4. **If the phase changed during the Blackout**, the participant returns to the same page, which now reflects
   the new phase. For example, if the coding round closed during the Blackout, they return to a closed round.
5. All previously refused actions are accepted again (subject to their normal rules).
6. Expiry needs no one to do anything. It is purely a matter of time passing on the server.

### Whether it can be used multiple times
- **Each Blackout is single-use.** It is spent the moment it is used, whether it lands or is absorbed.
- A participant may hold several (up to the hold limit, default 3) and use them one after another, on the same
  or different targets. Each use is independent and stacks as described below.
- A participant may buy more, up to the purchase limit (default unlimited).

### What happens when multiple effects overlap
Blackouts on the same target **never overlap. They queue end to end.** The total time is always the sum of the
durations of every Blackout that landed. See §13.4 and [14-temporary-effects.md](14-temporary-effects.md).

### Restrictions (summary)
Must hold one · not on yourself · not on a disqualified participant · only in usable phases · not in the last
*duration + duration ÷ 2* of a coding round · only while enabled · must have a duration · attacker not disqualified ·
never blocks bidding · nothing after the contest ends.

### Boundary cases

| Case | Outcome |
|---|---|
| Used 91 seconds before a coding round's deadline, 60 s duration | Allowed (before the 90 s cut-off). Lands and ends 31 seconds before the deadline |
| Used exactly 90 seconds before the deadline, 60 s duration | Refused (at the cut-off); nothing spent |
| Used 10 seconds before the deadline | Refused (inside the cut-off); nothing spent |
| An organiser extends the round by 5 minutes while inside the cut-off | Blackouts are usable again until 90 s before the new deadline |
| An organiser lengthens the Blackout duration to 120 s during a round | The cut-off becomes the last 180 s from then on; Blackouts already landed are unaffected |
| Blackout still running when an organiser advances to the next phase (possible only if the organiser advances before the deadline, or through the undecided stacking case) | It keeps running into the new phase and still refuses submissions and so on there, **even if Blackouts are not usable in that new phase**. It never refuses bids. Usable phases govern when a Blackout can be *used*, not when a landed one *runs* |
| Blackout still running when the contest moves to **Ended** | It stops mattering immediately; the victim's screen lifts at its next check |
| Target is not signed in or their machine is off | The Blackout runs anyway on server time. If they sign in before it ends, they see the Blackout screen with the remaining time; if after, nothing |
| Target refreshes the page or opens another tab | The Blackout screen is shown again immediately with the correct remaining time |
| Target's connection drops during the Blackout | The screen stays up; it never lifts early because a check failed |
| Organiser changes the Blackout's duration while one is running | The running one is unaffected |
| Organiser disables Blackout while one is running | The running one is unaffected; further uses are refused |
| Target becomes disqualified while blacked out | The Blackout keeps running to its end; afterwards they remain unable to act because they are disqualified |
| Attacker becomes disqualified after using it | The landed Blackout is unaffected |
| Target is "already out" | The new Blackout stacks after the current period |

---

## 13.3 Shield

### Name
**Shield** (organisers may rename it; the behaviour does not change).

### Purpose
Protect against Blackouts. It is the defensive counterpart that makes attacking a decision rather than a
free hit.

### When a participant can activate it
**Never. A Shield has no activation.** Buying it is the whole action. From the moment of purchase, it protects
its holder **automatically**. An attempt to "use" a Shield is refused with "a Shield protects you while you hold
it — there is nothing to activate", and nothing is spent.

### What it protects against
**Blackouts only**, aimed at its holder. It does nothing else: it does not affect bids, submissions, points or
anything organisers do.

### How long protection lasts
**Until it absorbs one Blackout.** A Shield has **no duration** and **does not expire** during the contest. It
protects in every phase, including phases that are not in its usable phases list. That list has no effect on a
Shield.

### What happens when another participant attempts a Blackout on a Shield holder

1. The Blackout is **absorbed**. The holder's screen does **not** change, and nothing is refused.
2. **One Shield is spent** (held Shields go down by one).
3. **The attacker's Blackout is spent** too. It is not returned.
4. The holder is notified: "**Charlie** tried to black you out. Your **Shield** absorbed it — 1 left."
5. The attacker sees "Blocked by a Shield — Alice had a Shield. It absorbed your Blackout — you hold N."
6. The record shows an absorbed attack.

### Is the attack consumed? Is the Shield consumed?
**Both.** One Blackout and one Shield, exactly.

### What if the Shield is never attacked
It stays held for the rest of the contest. It is **not refunded** and has no value at the end. That is the price of
insurance.

### Multiple Shields and multiple attacks
- **One Shield absorbs exactly one Blackout.** Holding three Shields absorbs the next three Blackouts.
- When the last Shield is spent, the **next** Blackout lands.
- Two Blackouts arriving at the same moment on a holder of **one** Shield: exactly **one** is absorbed and the
  other **lands**. Which attacker's Blackout is absorbed is whichever the contest processes first. Both attackers'
  Blackouts are spent.
- A holder can never end up with fewer than zero Shields, and one Shield can never absorb two Blackouts.

### Visibility
Every other participant can see, in the target list, that a participant is **shielded** (holds at least one). They
cannot see how many.

### Interactions with Blackouts already running
- **Buying a Shield while already blacked out** does not end or shorten the current Blackout. It protects only
  against Blackouts that arrive afterwards. (Through the product's screen a blacked-out participant cannot reach the
  marketplace anyway; see §13.2.)
- A Blackout that **already landed** is never retroactively absorbed.
- A Shield bought at the same instant as a Blackout is used on its buyer protects only if the purchase is processed
  first. Exactly one of the two orders happens; see [15-concurrency-and-conflicts.md](15-concurrency-and-conflicts.md).

### Restrictions
Hold limit (default 3) · purchase limit (default unlimited) · price · must be enabled **to buy**. A Shield already
held **keeps absorbing even if organisers later disable Shields** (see [22-open-questions.md](22-open-questions.md)).

### Boundary cases

| Case | Outcome |
|---|---|
| Holder is disqualified | They cannot be targeted at all, so the Shield is not involved |
| Organiser changes the Shield's price | Shields already held are unaffected |
| Holder is blacked out by the time a second attacker targets them, and holds a Shield bought in between | The second Blackout is absorbed; the first keeps running |
| Contest ends with Shields unspent | No effect, no refund |

---

## 13.4 Stacking Blackouts: the exact rule

**A new Blackout on a target starts at the later of (now) and (the end of the target's current blacked-out
period), and lasts its own duration.**

Consequences:

- Remaining time = end of the **last** Blackout in the stack − now.
- Total time blacked out = the **sum** of all landed durations, with no gaps and no overlaps.
- Two Blackouts landing at the same instant give **120 seconds**, not 60.
- It does not matter who applied them, in what order, or how close together.

> **Example.** At 10:00:00 Charlie blacks out Alice for 60 s: blacked out until 10:01:00.
> At 10:00:25 Dana blacks out Alice for 60 s. Alice's current period ends at 10:01:00, so Dana's runs
> 10:01:00 → 10:02:00. Alice's screen jumps from 0:35 remaining to **1:35**, with "2 blackouts stacked".
> At 10:02:00 the screen lifts.

> **Example (after expiry).** Charlie blacks out Alice at 10:00:00 for 60 s. At 10:01:05, already over, Dana
> blacks Alice out for 60 s. It starts at 10:01:05 and ends at 10:02:05. There is no stacking because nothing was running.

> **Example (boundary).** Alice's Blackout ends at exactly 10:01:00.000. A Blackout that lands at exactly
> 10:01:00.000 finds nothing running (a Blackout is running only while its end is strictly in the future) and
> starts at 10:01:00.000. Either way Alice is blacked out continuously until 10:02:00.
