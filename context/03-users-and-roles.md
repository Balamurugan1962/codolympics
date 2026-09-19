# 3. Users and Roles

There are exactly **three roles**. Every account holds **exactly one** of them, for
its whole life. A person who marks answers cannot also compete, so nobody ever
grades their own work.

| Role | In one sentence |
|---|---|
| **Participant** | Competes: answers, hacks, bids, codes, buys, attacks |
| **Evaluator** | Marks written answers and prepares content; cannot change the running contest |
| **Administrator** (organiser) | Runs the contest and can override anything, with a recorded reason |

A fourth kind of person, the **proctor**, supervises the hall physically. Proctors
do not use the product as a role. They are the reason software is a backstop and
not the main anti-cheating control.

Roles are enforced by the product itself, not by hiding buttons. Suppose a
participant types the address of an organiser page or sends a request the screen
would never send. The product must refuse it exactly as if a button had been
missing.

---

## 3.1 Participant

### Who they are

An individual competitor, usually a student, sitting at an organiser-controlled
machine. They registered themselves in the hall at the start of the day. One
person, one account, one seat.

### What they are trying to achieve

- Qualify through Phase 1.
- In Phase 2, win questions they can solve, solve them fast, and finish with the
  most points.
- Use coins well across questions, hints and powerups.

### What they can see

| Information | Visible? | Notes |
|---|---|---|
| Their own coins, and their own points | Always | Coins and phase are on every contest screen; points appear on the coding screen and leaderboard |
| The current phase and time remaining | Always | From server time |
| Phase 1 puzzles and hacking questions | When the section has opened | Never before |
| Their own Phase 1 answers and hack attempts | Yes | Hack results only say valid/invalid and hacked/not |
| Their own Phase 1 scores and evaluator comments | Once Section A has closed | Whatever the leaderboard setting |
| The Phase 1 leaderboard (names, points, rank, provisional marker) | Per the Phase 1 visibility setting | |
| The published basis for Phase 1 selection | Yes | |
| Whether they were selected for Phase 2 | Yes, once decided | |
| The question currently at auction: title, difficulty, points reward, base coins | During an auction | **Never its statement** |
| The highest bid and **who holds it**; the recent bids with bidder names | During an online auction | |
| The auction running order, and for each settled question who won it and for how much | During an auction | Sale prices and winners are public |
| Statements, limits, samples and hint prices of questions **they own** | Yes | |
| Hints they bought | For the rest of the contest | |
| Number of hidden testcases on their question | Yes | Never the contents |
| Their own submissions, verdicts, failing test number, compiler output | Yes | |
| Their saved code drafts | Yes, on any machine | |
| The Phase 2 leaderboard: rank, name, total points, questions solved, total solve time | Per the Phase 2 visibility setting | |
| Their own rank | When the Phase 2 leaderboard is not hidden | |
| The marketplace: items, prices, limits, how many they hold | Yes | |
| Other participants' names, and for each whether they currently hold a Shield, are currently blacked out, or are out of the contest | In the marketplace target list | See [12-marketplace.md](12-marketplace.md) |
| Whether they are blacked out, until when, and **who** blacked them out | Yes | |
| Announcements to everyone | Yes | |
| Notifications addressed to them | Yes | Refunds, corrections, attacks, selection |

### What they must never see

- Any question statement, sample or hint for a question they do not own.
- Any hidden testcase input or expected output, including for their own questions.
- The judge's internal details of a failure, including what the right output was.
- In Phase 1: answer keys, model answers, validators, the correct "breaking input" for
  a hacking question, the reference solution, or the specific way a flawed solution
  failed (wrong answer, too slow, crash).
- Another participant's balance, code, hints or answers.
- How many powerups another participant holds, beyond whether they currently hold
  at least one Shield.
- The audit log, the judge's health, and any organiser or evaluator screen.

### What they can do

- Register (while registration is open) and sign in.
- In Section A: answer questions in any order, change answers until the section
  closes, and finish the section early.
- In Section B: submit test inputs against flawed solutions, one at a time, and
  finish the section early.
- In an online auction: bid the exact next legal amount on the question on the block.
- Read, code, save drafts and submit solutions for questions they own. They may
  cancel a submission that is still being judged.
- Buy the next hint on a question they own.
- Buy powerups while the marketplace is open, and use a Blackout on another
  participant in the parts of the contest where it is usable.
- Read announcements and notifications; view leaderboards subject to visibility.
- Sign out, or sign in on another machine. Signing in elsewhere ends the old session.

### What they cannot do

- Bid in an offline auction, where bidding happens out loud in the room.
- Bid more than their balance, bid anything but the exact next amount, or outbid themselves.
- Read or attempt a question they do not own.
- Transfer coins, questions, hints or powerups to anyone.
- Undo a bid, a purchase, a hint, or a submitted hack.
- Use a powerup on themselves, or on a participant who is out of the contest.
- Act while blacked out (see [13-powerups.md](13-powerups.md)).
- Change anything after being disqualified.
- Take part in Phase 2 if they were not selected.
- Be signed in on two machines at once.

### How their experience differs from other roles

A participant's product is a **linear flow**. The main screen is always "whatever
phase is open now" and changes by itself when organisers move on. They get very
little navigation: the contest screen, the leaderboard and the marketplace. The
reason is that during a timed round every click that is not the task is lost time.

---

## 3.2 Evaluator

### Who they are

A staff member, typically a teaching assistant or volunteer. An administrator creates
their account; evaluators never self-register.

### What they are trying to achieve

Mark every manually graded Phase 1 item (short answers and explanations) fairly and
consistently, question by question across all participants.

### What they can see

- The grading queue: every manually graded answer and explanation, grouped by
  question, with the question text, the model answer, the participant's answer and
  explanation, and any existing mark or comment.
- The count of items still ungraded.
- Hack attempts in full, including the specific failure type.
- Both leaderboards in full, regardless of the visibility setting shown to participants.
- Participants, their details, submissions with full judging detail, the audit log,
  contest settings, powerup configuration, announcements, judge health and the
  readiness checklist (read-only).
- Draft and published content: Phase 1 questions, coding problems, question details and hints.

### What they can do

- Record a mark for a manual answer (between 0 and the question's points).
- Record a mark for an explanation (between 0 and the explanation's points).
- Add a comment, and **flag** a participant's answer for an administrator's attention.
- Prepare content: create and edit Phase 1 questions, import and export them,
  reorder them, run their self-tests. Upload and validate coding problem packages,
  and edit a coding question's details and hints.

### What they cannot do

- Publish, unpublish, void or delete content, or make a new version of a coding
  problem live.
- Move the contest between phases, extend a round, open or close registration,
  or change any setting.
- Change coins, ownership, bids, lots or powerups.
- Select who advances, override scores, or disqualify anyone. They may flag, not act.
- Post announcements.
- Compete.

### How their experience differs

Evaluators use the **organiser console**, which shows them fewer items. Their main
screen is the grading queue. The one-session-per-account rule does **not** apply to
them, so they may be signed in on more than one machine.

---

## 3.3 Administrator (organiser)

### Who they are

The people running the event. The first administrator account exists before the
day. Administrators can create further administrators and evaluators.

### What they are trying to achieve

Run every phase on time, keep the contest fair, and correct anything that goes
wrong, with a record that justifies each correction.

### What they can see

**Everything.** That includes answer keys, validators, reference solutions, full
judging detail (including expected output for a failed test), every balance,
every bid, the powerup log, both leaderboards unfiltered, the audit log, judge
health and backlog, and each participant's full record.

### What they can do

Everything evaluators can, plus every contest control and override. The full list
is in [17-organiser-controls-and-corrections.md](17-organiser-controls-and-corrections.md).
In summary:

- **Content:** publish and void Phase 1 questions; make coding problems live;
  set the auction running order; configure powerups.
- **Contest:** advance phases; extend rounds; open and close registration; change
  settings; set leaderboard visibility; open and close the marketplace; post
  announcements; reset the contest.
- **Phase 1:** select who advances; override any Phase 1 score; disqualify and requalify.
- **Auction:** pause and resume; close bidding now; change or switch off a lot's
  timer; withdraw, restore and reorder lots; retract a mistaken top bid; record
  offline sales and unsold results; take a question back.
- **Coins and ownership:** adjust a balance; assign an unsold question at a set
  price; transfer ownership; void a question with refunds; rejudge a question and
  decide the outcome.
- **People:** create participants at any point, including mid-contest late accounts
  (0 points, same starting coins, same clock for everyone); rename, reset passwords,
  remove accounts before the contest starts, create staff.
- **Setup:** export the whole prepared contest (content, orders, settings, optionally
  staff) as one setup file, and import it on contest day.
- **Records:** export all results.

### What they cannot do

- Compete.
- Make an override without giving a **reason**. Every override requires one, and the
  product records it with the administrator's identity and the time.
- Push a participant's balance below zero.
- Give a question two owners.
- Remove an account once the contest has left registration. Disqualification is the
  tool from then on.
- Change a running auction between online and offline mid-round.
- Change the auction running order once the auction's lots have been created.

### How their experience differs

Administrators use a **console** with a sidebar, not a linear flow, because their
job is to watch and act on everything at once. Like evaluators, they may be signed in
on several machines at the same time. Logging an organiser out mid-auction would be
dangerous.

---

## 3.4 Role comparison at a glance

| Capability | Participant | Evaluator | Administrator |
|---|---|---|---|
| Compete | ✔ | ✘ | ✘ |
| See own coins / owned questions | ✔ | — | ✔ (everyone's) |
| See other participants' coins | ✘ | ✔ | ✔ |
| See hidden testcases or expected output | ✘ | ✔ (for disputes) | ✔ |
| See answer keys / reference solutions / validators | ✘ | ✔ | ✔ |
| Mark manual Phase 1 answers | ✘ | ✔ | ✔ |
| Draft content | ✘ | ✔ | ✔ |
| Publish content / make it live | ✘ | ✘ | ✔ |
| Move phases, change settings | ✘ | ✘ | ✔ |
| Select who advances / disqualify | ✘ | ✘ (may flag) | ✔ |
| Coins, ownership, auction controls | ✘ | ✘ | ✔ |
| Configure powerups / open marketplace | ✘ | ✘ | ✔ |
| Announce | ✘ | ✘ | ✔ |
| Signed in on several machines at once | ✘ | ✔ | ✔ |
| Can be blacked out | ✔ | ✘ | ✘ |
