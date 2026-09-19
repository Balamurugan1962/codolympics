# 23. Glossary

Short definitions of every domain term in this folder, in alphabetical order. Fuller definitions are in
[04-core-concepts.md](04-core-concepts.md).

| Term | Definition |
|---|---|
| **Absorbed / Blocked** | A Blackout that met a Shield: the target is unaffected, one Shield and the Blackout are both spent |
| **Accepted** | The verdict meaning every testcase passed; the question is solved |
| **Acquisition (moment of)** | When a participant became a question's owner; solve time is measured from it |
| **Active effect** | A landed Blackout whose end time is still in the future while the contest has not ended |
| **Administrator / Organiser** | Staff role that runs the contest and can override anything with a recorded reason |
| **Advance (a phase)** | An administrator moving the contest to the next phase |
| **Advanced / Selected** | Chosen by an administrator to take part in Phase 2, or created during Phase 2 |
| **Already out** | Target-list marker: the participant is currently blacked out; a new Blackout will stack |
| **Announcement** | A message to everyone that covers the screen until acknowledged |
| **Answer key** | The organiser's correct answer for an auto-graded puzzle; never shown to participants |
| **Answer type** | How a puzzle is answered: pick one, pick several, short answer, number, order, list, free text |
| **Assign (a question)** | Organiser gives an unsold question to a participant at a set price |
| **Attacker** | The participant using a Blackout |
| **Attempt (hack)** | One test input submitted against one hacking question |
| **Auction** | Auction 1 or Auction 2: a Phase 2 phase in which questions are sold one at a time |
| **Auction mode** | Online (bid from seats, clocks decide) or offline (room bids aloud, an organiser records) |
| **Audit log** | Permanent record of every staff action and hint purchase, with who, when and why |
| **Auto (grading)** | A puzzle scored by comparison with the answer key |
| **Coins** | The spendable currency: bought questions, hints and powerups. Whole numbers, never negative, never ranked |
| **Coin balance (balance)** | How many coins a participant has now; never negative |
| **Base coins** | A question's published opening price in coins; the first bid equals it |
| **Bid** | An online offer of exactly the next legal amount on the open lot; moves no coins |
| **Bid countdown** | Time after the latest bid before a lot sells (default 15 s); restarts on every bid; 0 = manual close |
| **Bid increment (X)** | The fixed step each bid after the first adds (default 10) |
| **Blackout** | Offensive powerup: covers a target's screen and refuses their contest actions (never bidding) for its duration |
| **Cut-off (Blackout)** | The last *duration + duration ÷ 2* of a coding round (90 s for a 60 s Blackout), during which Blackouts cannot be used |
| **Blacked out** | The temporary state of a participant with an active Blackout |
| **Blast radius** | The number of submissions a question correction will rejudge, shown before confirming |
| **Blocker** | A condition that prevents an organiser advancing the phase |
| **Cancelled** | A submission withdrawn by its author before a verdict; never counted |
| **Case-sensitive** | A puzzle setting that makes capital letters significant when comparing answers |
| **Close bidding now** | Organiser control that settles the open lot immediately |
| **Coding round** | Coding round 1 or the Final round: timed Phase 2 phases for solving |
| **Compilation error** | Verdict: the code did not compile; compiler output is shown |
| **Connection lost** | State shown when a participant's screen cannot reach the contest; a persistent banner |
| **Constraints** | The legal limits on a problem's input; a hack input breaking them is invalid |
| **Contest** | The single competition being run, with one phase, one roster, one history |
| **Contest settings** | Organiser-controlled values: balances, bidding clocks, durations, visibility, auction mode, marketplace |
| **Cooldown** | The 3 seconds after a submission (or hack attempt) ends before another is allowed |
| **Deadline** | The server-time end of a timed phase's work; passing it closes the work, not the phase |
| **Did not break it** | Hack outcome: valid input the given solution handled; may carry a penalty |
| **Difficulty** | Easy, Medium or Hard label on a question |
| **Disabled (powerup)** | Off sale and not usable; a held Shield still absorbs |
| **Disqualified** | Removed from competition for malpractice by an administrator; reversible; recorded |
| **Display name** | A participant's public, unique name |
| **Draft** | Editor content for one question, saved automatically |
| **Ended** | The final phase; nothing more can be submitted, bid, answered or hacked |
| **Evaluator** | Staff role that marks manual Phase 1 items and prepares content; cannot change the contest |
| **Explanation** | Written reasoning for a puzzle, with its own points, marked by an evaluator |
| **Extend** | Organiser control adding minutes to a timed phase's deadline |
| **Final round** | The last Phase 2 coding phase (default 60 minutes) |
| **Finish (a section)** | A participant's irreversible early end to a Phase 1 section; records their tiebreak time |
| **Flag** | An evaluator's marker asking an administrator to look at an answer |
| **Format (hint)** | The required shape of a Phase 1 answer; malformed entries are rejected as typed |
| **Frozen** | Leaderboard mode showing standings as of the freeze moment |
| **Given solution** | The flawed program shown in a hacking question |
| **Grading mode** | Auto, validator or manual |
| **Grading queue** | Evaluators' single list of manual items, grouped by question |
| **Hacked** | Hack outcome: the given solution failed on a valid input |
| **Hacking question** | A Section B item: problem, constraints, given solution, points, penalty |
| **Held / Inventory** | The powerups a participant currently owns and has not spent |
| **Hidden (leaderboard)** | Mode in which participants see that standings are hidden |
| **Hidden testcase** | A testcase whose contents are never shown to participants |
| **Hint** | Author-written, priced guidance for an owned question; unlocks in order |
| **Hold limit** | Most of a powerup a participant may hold at once (default 3) |
| **Import / export (setup)** | Saving all content and configuration to one file, and restoring it into a contest |
| **In flight** | A submission awaiting its verdict; at most one per participant |
| **Internal error** | Verdict: the judge failed; never counted against the participant |
| **Invalid input** | Hack outcome: the input broke a constraint; no points, no penalty |
| **Judge / Judging** | Running a submission against testcases to produce a verdict |
| **Land (a Blackout)** | A Blackout taking effect on a target who holds no Shield |
| **Late account** | A participant created by an organiser after the contest started; 0 points, same starting coins, shared clock |
| **Leaderboard** | Ranked standings; one for Phase 1 and one for Phase 2 |
| **Ledger** | The record of every balance change with reason and resulting balance |
| **Live** | Leaderboard mode showing current standings |
| **Lot** | One question's turn on the block in one auction: pending, open, closed, unsold or withdrawn |
| **Manual (grading)** | A puzzle marked by an evaluator |
| **Marketplace** | Where powerups are bought with coins; opened and closed by organisers |
| **Memory limit exceeded** | Verdict: the program used too much memory |
| **Model answer** | Organiser's reference answer for a manual puzzle; a marking aid, never shown to participants |
| **Next legal amount** | The only valid bid: base coins if no bids, otherwise highest bid + increment |
| **Not selected** | A participant not chosen for Phase 2 |
| **Notification** | A short message to one participant about something affecting them |
| **Offline auction** | Auction mode in which the room bids aloud and an organiser records results |
| **Online auction** | Auction mode in which participants bid from their machines and clocks decide |
| **Opening window** | Time a new lot waits for its first bid before going unsold (default 30 s) |
| **Output limit exceeded** | Verdict: the program printed far too much |
| **Override** | Any organiser correction of a parameter or outcome; always with a reason |
| **Ownership** | The exclusive right to read, attempt and score from one question |
| **Ownership cap** | Optional limit on how many questions one participant may own |
| **Participant** | An individual competitor account |
| **Partial credit** | Optional scoring for pick-several and list puzzles: each correct pick earns a share, each wrong pick cancels one |
| **Pause (auction)** | Organiser hold stopping all bidding and clocks; resume restores exact remaining time |
| **Penalty (hack)** | Points deducted for a valid attempt that did not break the solution (default 0) |
| **Phase** | The step the contest is in: Registration, Section A, Section B, Review, Auction 1, Coding round 1, Auction 2, Final round, Ended |
| **Phase 1** | The qualifying round: Section A, Section B and Review |
| **Phase 1 points** | A participant's total from puzzles and hacking |
| **Phase 1 rank** | A participant's Phase 1 position; breaks exact Phase 2 ties |
| **Phase 2** | The auction contest: Auction 1, Coding round 1, Auction 2, Final round |
| **Points** | The reward a solved question pays its owner. Totals rank the Phase 2 leaderboard. Never spent, never transferred, removed if the question stops counting |
| **Points reward** | The points one question pays when its owner solves it, set by its author |
| **Powerup** | A marketplace item that affects contest interaction: Blackout or Shield |
| **Powerup log** | Organisers' record of every purchase, landed Blackout and absorbed Blackout |
| **Problem error** | Hack outcome: the question itself is broken; not counted |
| **Problem package** | A question's testcases, limits and correct solution, versioned |
| **Proctor** | A person supervising the hall; the real anti-cheating control |
| **Proven (ready)** | A Phase 1 question whose self-test passed; required to publish |
| **Provisional** | A Phase 1 total that may still change (ungraded items or a failed checker) |
| **Publish** | Make content visible to participants (Phase 1) or live for judging (Phase 2) |
| **Purchase limit** | Most of a powerup a participant may ever buy in a contest (default unlimited) |
| **Question** | A Phase 2 programming task with a points reward, base coins, statement, testcases and hints |
| **Rank** | Position on a leaderboard after tie-breaking |
| **Readiness checklist** | Organisers' list of pre-contest conditions and their status |
| **Reason** | The required justification recorded with every override |
| **Refund** | Coins returned by an organiser correction |
| **Registration** | The first phase; participants create accounts while it is open |
| **Rejudge** | Re-running all submissions for a question; earlier verdicts kept for the record |
| **Rejudge outcome** | Organiser's explicit choice after a rejudge: let stand, refund, or void |
| **Relist** | Put a taken-back question at the end of the current auction's queue |
| **Remaining time** | Time from now to the end of a participant's last stacked Blackout (or any timed state) |
| **Requalify** | Reverse a disqualification |
| **Reset** | Organiser action returning the contest to Registration ("reset the contest" or "wipe everything") |
| **Restore (a lot)** | Put a withdrawn lot back at the end of the queue |
| **Retract (top bid)** | Organiser removal of the highest bid; the previous bidder leads again |
| **Review** | The phase after Section B for marking and selection |
| **Round** | One of the Phase 2 phases |
| **Running order** | The published order in which questions are auctioned |
| **Runtime error** | Verdict: the program crashed or exited abnormally |
| **Sample testcase** | A testcase shown free and judged first |
| **Section A** | Phase 1 logical puzzles |
| **Section B** | Phase 1 hacking |
| **Selection basis** | Published statement of how organisers will choose who advances |
| **Self-test** | Organiser proof that a Phase 1 question works before publishing |
| **Server time** | The contest's own clock; the only clock that decides anything |
| **Session** | A signed-in presence on one machine; one per participant |
| **Setup file** | The exported zip of content and configuration used to prepare a contest |
| **Shield** | Defensive powerup that automatically absorbs the next Blackout aimed at its holder |
| **Shielded** | Target-list marker: the participant holds at least one Shield |
| **Sold** | Lot or question state after a sale |
| **Solve time** | From acquiring a question to submitting its earliest currently Accepted solution |
| **Solved** | A question with at least one current Accepted submission by its current owner, not void |
| **Stack** | Several Blackouts on one target placed end to end |
| **Staff** | Administrators and evaluators |
| **Starting coins** | The coins every participant starts with; an organiser setting (default 1,000) |
| **Statement** | A question's full problem text; only its owner sees it |
| **Submission** | Source code, language and server receipt time for one attempt at a question |
| **Take back** | Organiser correction for a wrong sale of a good question; returns it to unsold |
| **Target** | The participant a Blackout is aimed at |
| **Target list** | The list of other participants shown when using a Blackout |
| **Tiebreak** | Rules separating equal points totals: Phase 2 by total solve time then Phase 1 rank; Phase 1 by earlier finish |
| **Time limit exceeded** | Verdict: the program was too slow |
| **Timer off** | Organiser setting for an open lot so it closes only by hand |
| **Total solve time** | Sum of solve times over solved questions; lower ranks higher |
| **Transfer (ownership)** | Organiser moves a question to another participant; no coins change hands; clock restarts |
| **Unsold** | Lot or question state with no sale; unsold questions return in Auction 2 |
| **Usable phases** | The phases in which a powerup may be used |
| **Validate (problem)** | Running the correct solution over every testcase to prove a question works |
| **Validator (grading)** | Organiser-supplied checker scoring each distinct entry of a puzzle after the section closes |
| **Verdict** | The result of judging a submission |
| **Visibility mode** | Live, frozen or hidden, for each leaderboard |
| **Void (Phase 1 question)** | Scores for nobody |
| **Void (Phase 2 question)** | Removed from the contest for everyone; owner refunded by default; never sold again |
| **Waiting screen** | A participant screen with nothing to do: registration, review, not selected, ended |
| **Warning** | A condition an organiser must acknowledge before advancing |
| **Withdraw (a lot)** | Organiser takes a pending or open lot off the block; nothing sold |
| **Wrong answer** | Verdict: incorrect output on some test |
