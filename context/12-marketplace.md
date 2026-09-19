# 12. The Marketplace

## 12.1 Why it exists

The marketplace adds a second kind of judgement to Phase 2: **spending on interaction instead of
on problems**. It is paid for with **coins: the same pool used at auction and for hints**, so every
powerup is a trade-off. A Shield is a question you chose not to bid on. A Blackout is a hint you chose
not to buy.

**Powerups cost coins, never points.** Points cannot be spent on anything, so buying or using a
powerup can never reduce a participant's points or their place on the leaderboard. What it costs is
coins, and therefore the questions and hints those coins could have bought.

It also gives participants who spent little at auction something meaningful to do with their coins.

## 12.2 What can be bought

Exactly two items, called **powerups**:

| Powerup | Kind | In one line |
|---|---|---|
| **Blackout** | Offensive, used on someone else | Covers another participant's screen and refuses their contest actions (never bidding) for a set time |
| **Shield** | Defensive, passive | Automatically absorbs the next Blackout aimed at its holder |

Their behaviour is defined in [13-powerups.md](13-powerups.md). Nothing else is sold here. Hints are
bought on the question itself, and questions are won at auction.

## 12.3 How organisers configure items

Each powerup has settings an administrator can change at any time, with a reason:

| Setting | Meaning | Default: Blackout | Default: Shield |
|---|---|---|---|
| Name | Shown to participants | Blackout | Shield |
| Description | Shown to participants | "Blanks another competitor's screen and locks them out of the contest for a while. Stacks if several land." | "Absorbs one Blackout aimed at you. Works while you hold it — there is nothing to switch on." |
| Price | Cost per item | 150 | 120 |
| Duration | How long a landed Blackout lasts | 60 seconds (a Blackout must have one) | not applicable |
| Enabled | Whether it is on sale and usable | on | on |
| Hold limit | Most a participant may hold at once | 3 | 3 |
| Purchase limit | Most a participant may ever buy in the contest | unlimited | unlimited |
| Usable phases | Phases in which it may be used | Coding round 1, Final round | Coding round 1, Final round (has no effect; see §13.3) |

Usable phases may be chosen from Section A, Section B, Auction 1, Coding round 1, Auction 2 and Final round.
They can never include Registration, Review or Ended.

**Changing a setting governs the next purchase and the next use only.**

- A price change does not refund or charge anyone for past purchases.
- A duration change **never shortens or lengthens a Blackout that has already landed**. Its end time was
  fixed when it landed.
- Lowering a hold limit below what someone already holds does not take items away. They simply cannot buy
  more until they are under the limit.

If the marketplace is visited when no powerups have been configured yet, the two defaults above are set up
automatically.

## 12.4 Marketplace open and closed

- The marketplace is **closed** by default. An administrator opens and closes it in contest settings.
- **Closed:** nothing can be bought. The page says "The marketplace is closed — The organisers open it when it
  is in play. Anything you already hold still works."
- **Open:** items can be bought, subject to §12.6.
- **Open/closed controls buying only.** Using a Blackout depends on its usable phases, not on the marketplace
  being open. A held Shield keeps absorbing whether the marketplace is open or closed.

## 12.5 What a participant sees

At the top: **their coins** ("the same coins you bid with") and **how many powerups they hold**. Points
are not shown here, because nothing in the marketplace costs or pays points.

For each **enabled** powerup, a card showing:

- name, icon and description;
- **price**;
- "lasts 60s" (Blackout);
- "hold up to 3" (if limited);
- "1 of 2 bought" (if there is a purchase limit);
- "**N held**" if they hold any;
- "**not usable now**" if the current phase is not one of its usable phases;
- a **Buy** button;
- for Blackout, a **Use** button;
- **one sentence explaining why** Buy or Use is unavailable, if it is:
  - "The marketplace is closed."
  - "Your account is disqualified."
  - "You have 90; this costs 150."
  - "You can hold at most 3."
  - "You have used your 2 for this contest."
  - "You do not own one."
  - "Not usable in this part of the contest."
  - "Blackouts are disabled for the last 90 seconds of the round." (the end-of-round cut-off)
- for a held Shield: "Protected. The next Blackout aimed at you is absorbed automatically." (or "The next 2
  Blackouts aimed at you are absorbed automatically.")

Disabled powerups are not listed at all. If none are enabled: "Nothing on sale — The organisers have not put
any powerups up yet."

The page updates by itself when the participant's balance changes, when a powerup is used, or when the phase
changes.

## 12.6 Buying

### 12.6.1 A purchase succeeds only if all of these hold (checked in this order)

| # | Check | Refusal |
|---|---|---|
| 1 | The marketplace is open | "the marketplace is closed" |
| 2 | The buyer is a participant and not disqualified | "your account is disqualified" |
| 3 | The powerup exists | "powerup not found" |
| 4 | The powerup is enabled | "Blackout is not on sale" |
| 5 | The price is not more than the buyer's balance | "you have 90; this costs 150" |
| 6 | The buyer holds fewer than the hold limit | "you can hold at most 3 Blackout" |
| 7 | The buyer has bought fewer than the purchase limit | "you have used your 2 for this contest" |

### 12.6.2 What a successful purchase does, all at once

1. Charges the price from the balance (recorded in the ledger as a powerup purchase).
2. Adds one to the number held, and one to the number ever bought.
3. Records the purchase in the marketplace log (who, what, price, when).
4. Shows "Blackout bought — You hold 2. Balance 700." and updates the balance everywhere.

### 12.6.3 Is a purchased item immediately usable?

- **Shield:** it protects **immediately** on purchase, in every phase, until it absorbs a Blackout.
- **Blackout:** it can be used **immediately if** the current phase is one of its usable phases and a coding round is not
  inside its end-of-round cut-off. Otherwise it
  is held until such a phase begins.

### 12.6.4 Double clicks and retries

Every attempt to buy is one **attempt**. If the same attempt reaches the server twice (a double click, a retry
after a dropped connection, a resubmitted page), **it is charged once**, and the second response reports what the
first did ("Already bought").

Pressing Buy again **deliberately**, as a new attempt, buys another one, subject to the limits.

## 12.7 Ownership of items

- Items belong to the participant who bought them.
- They **cannot be transferred, gifted, sold back or refunded** by the participant.
- **Nobody can see how many powerups another participant holds**, with one exception: the target list shows
  whether a participant **currently holds at least one Shield** ("shielded"). **Why:** spending an attack
  should be a decision, not a dice roll.
- A Blackout leaves the holder's inventory when used. A Shield leaves it when it absorbs an attack.
- Items do not expire. **Undefined:** whether unused items have any meaning or value after the contest ends
  (they have no effect then).

## 12.8 Using a Blackout (marketplace side)

1. The participant presses **Use** on Blackout.
2. The **target list** opens: "Use Blackout on…" with the explanation "They lose their screen for the duration.
   If they hold a Shield it absorbs this instead, and your powerup is still spent."
3. It lists **every other participant**, alphabetically. The user themself is never listed. Each entry may carry:
   - **shielded**: holds at least one Shield;
   - **already out**: currently blacked out (a new Blackout will stack);
   - **out of the contest**: disqualified; cannot be chosen.
4. Choosing a participant uses the Blackout immediately. There is no second confirmation.
5. The outcome is shown:
   - landed: "**Alice is blacked out** — Your Blackout landed. You hold 1."
   - absorbed: "**Blocked by a Shield** — Alice had a Shield. It absorbed your Blackout — you hold 1."
6. If there is nobody else to target: "There is nobody else in the contest to aim at."

## 12.9 Unavailable items and invalid actions

| Attempt | What happens | Anything spent? |
|---|---|---|
| Buy while the marketplace is closed | Refused, with reason | No |
| Buy a disabled powerup | Refused ("not on sale"); it is not even listed | No |
| Buy without enough coins | Refused ("you have X; this costs Y") | No |
| Try to pay with points | Impossible: nothing in the marketplace is priced in points | No |
| Buy past the hold limit | Refused | No |
| Buy past the purchase limit | Refused | No |
| Use a Blackout you do not hold | Refused ("you do not own a Blackout") | No |
| Use a Blackout outside its usable phases | Refused ("Blackout cannot be used during this part of the contest") | No |
| Use a Blackout during a coding round's cut-off (last *duration + duration ÷ 2*) | Refused ("Blackouts are disabled for the last 90 seconds of the round") | No |
| Use a disabled Blackout you hold | Refused ("Blackout is switched off") | No |
| Use a Blackout without choosing a target | Refused ("choose who to use it on") | No |
| Use a Blackout on yourself | Refused ("you cannot use that on yourself"); you are never listed | No |
| Use a Blackout on a disqualified participant | Refused ("that participant is out of the contest") | No |
| Use a Blackout on someone who does not exist | Refused | No |
| Use a Blackout whose duration an organiser left unset | Refused ("an organiser must configure it") | No |
| Try to "activate" a Shield | Refused: "a Shield protects you while you hold it — there is nothing to activate" | No |
| Buy or use while disqualified | Refused | No |
| The same attempt arrives twice | Processed once; second reports the first result | Once only |

**Every refused action spends nothing and changes nothing.** Invalid attacks never consume a Blackout.

## 12.10 The organisers' view

Organisers see a **powerup log**: every purchase, every Blackout that landed, and every Blackout absorbed by a
Shield, with who, against whom, cost and time, newest first. They also see every powerup's settings with an
editor that requires a reason for each change.
