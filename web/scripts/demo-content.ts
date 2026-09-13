/**
 * The content of the demo setup zip.
 *
 * Written as data rather than typed into the UI so it can be regenerated, and
 * so the reasoning behind each piece is visible. The point of the set is
 * coverage: every Phase 1 question kind and every grading mode appears at least
 * once, so anyone learning the app sees what each one looks like to a
 * participant before authoring their own.
 *
 * The Phase 2 problems are four well-known interview questions, restated with
 * an explicit stdin/stdout contract — the judge compares whole output, so "the
 * answer" has to be a defined format rather than a returned value.
 */

// ---------------------------------------------------------------------------
// Phase 1, Section A — one of every kind, across all three grading modes
// ---------------------------------------------------------------------------

export const PUZZLES = [
  {
    title: "The next tile",
    bodyMd:
      "A pattern grows one step at a time:\n\n```\nstep 1   ▪\nstep 2   ▪▪▪\nstep 3   ▪▪▪▪▪\n```\n\nHow many tiles are in **step 10**?",
    category: "pattern" as const,
    kind: "mcq_single" as const,
    grading: "auto" as const,
    points: 10,
    explainPoints: 0,
    orderIndex: 0,
    config: { options: ["18", "19", "20", "21"] },
    answerKey: { option: 1 },
    modelAnswer: "Odd numbers: step n has 2n − 1 tiles, so step 10 has 19.",
    maxEntries: 100,
  },
  {
    title: "Who was in the building?",
    bodyMd:
      "Four people signed the log. Exactly one of them lied.\n\n- **Ana:** \"Ben arrived before me.\"\n- **Ben:** \"I arrived last.\"\n- **Cal:** \"Ana arrived first.\"\n- **Dee:** \"Cal arrived before Ben.\"\n\nSelect **every** statement that must be false if Ana arrived first.",
    category: "detective" as const,
    kind: "mcq_multi" as const,
    grading: "auto" as const,
    points: 15,
    explainPoints: 0,
    orderIndex: 1,
    config: { options: ["Ana's", "Ben's", "Cal's", "Dee's"], partialCredit: true },
    answerKey: { options: [0] },
    modelAnswer: "If Ana is first then Ben did not arrive before her, so only Ana's statement is necessarily false.",
    maxEntries: 100,
  },
  {
    title: "The missing word",
    bodyMd:
      "In a **min-heap**, the smallest element is always at the ______.\n\nAnswer with a single word.",
    category: "pattern" as const,
    kind: "fill_blank" as const,
    grading: "auto" as const,
    points: 8,
    explainPoints: 0,
    orderIndex: 2,
    config: { caseSensitive: false },
    answerKey: { accepted: ["root", "top"] },
    modelAnswer: "The root (equivalently, the top) of the heap.",
    formatHint: "one word",
    maxEntries: 100,
  },
  {
    title: "Handshakes",
    bodyMd:
      "Twelve people are in a room. Every person shakes hands with every other person **exactly once**.\n\nHow many handshakes happen in total?",
    category: "constraint" as const,
    kind: "numeric" as const,
    grading: "auto" as const,
    points: 10,
    explainPoints: 0,
    orderIndex: 3,
    config: { tolerance: 0 },
    answerKey: { value: 66 },
    modelAnswer: "C(12,2) = 12·11/2 = 66.",
    maxEntries: 100,
  },
  {
    title: "Put the build in order",
    bodyMd:
      "These four steps run a submission through the judge. Drag them into the order they actually happen.",
    category: "pattern" as const,
    kind: "sequence" as const,
    grading: "auto" as const,
    points: 12,
    explainPoints: 0,
    orderIndex: 4,
    config: { items: ["Compare the output with the answer", "Compile the source", "Run it against a testcase", "Report the verdict"] },
    answerKey: { order: [1, 2, 0, 3] },
    modelAnswer: "Compile, run, compare, report.",
    maxEntries: 100,
  },
  {
    title: "Every factor of 36",
    bodyMd:
      "List **all** positive integers that divide 36 exactly.\n\nOne per line, in any order. Each correct factor earns points on its own; a wrong one cancels a correct one.",
    category: "constraint" as const,
    kind: "set" as const,
    grading: "validator" as const,
    points: 18,
    explainPoints: 0,
    orderIndex: 5,
    pointsPerEntry: 2,
    maxEntries: 20,
    config: { partialCredit: true },
    // One entry at a time: the judge hands `check` a Reader over a single
    // submitted line and counts the truthy answers. Deduplication happens
    // before this is called, so it never has to think about repeats.
    validatorPy: `def check(entry):
    """One submitted factor. True when it divides 36 exactly."""
    # Out of range or not an integer raises, which marks just this entry
    # invalid and says why — the rest of the list is still scored.
    value = entry.int(1, 36)
    entry.eof()          # "12 18" on one line is two answers, not one
    return 36 % value == 0
`,
    modelAnswer: "1, 2, 3, 4, 6, 9, 12, 18, 36 — nine factors.",
    maxEntriesHint: true,
  },
  {
    title: "Why does the auction use a restarting countdown?",
    bodyMd:
      "In this contest every bid restarts the lot's countdown, rather than the lot closing at a fixed time.\n\nExplain in two or three sentences **what that prevents**, and name one thing it costs the organisers.",
    category: "detective" as const,
    kind: "long_text" as const,
    grading: "manual" as const,
    points: 20,
    explainPoints: 5,
    orderIndex: 6,
    config: {},
    modelAnswer:
      "It prevents sniping: with a fixed close, the winning move is to bid in the last second, which rewards reflexes and a fast network rather than judgement. A restarting countdown means the lot only closes when nobody wants it more. The cost is that a contested lot can run far longer than planned, so the round's timing becomes unpredictable.",
    maxEntries: 100,
  },
];

// ---------------------------------------------------------------------------
// Phase 1, Section B — flawed solutions to break
// ---------------------------------------------------------------------------

/** A Python reference that is actually correct, and the flawed one shown to participants. */
export const HACKS = [
  {
    title: "Largest sum of a contiguous block",
    problemId: "hack-max-subarray",
    statementMd:
      "Given `n` integers, print the largest sum obtainable from a **contiguous, non-empty** block of them.\n\n**Input**\n```\nn\na1 a2 … an\n```\n\n**Output** — one integer.\n\nThe solution below is wrong on at least one valid input. Find it.",
    constraintsMd: "`1 ≤ n ≤ 1000`, and each `ai` satisfies `-1000 ≤ ai ≤ 1000`.",
    givenLanguage: "python",
    // Seeds `best` at 0, so it answers 0 for an all-negative array where the
    // true answer is the least-negative element.
    givenSource: `import sys

data = sys.stdin.read().split()
n = int(data[0])
a = [int(x) for x in data[1:1 + n]]

best = 0
current = 0
for value in a:
    current += value
    if current < 0:
        current = 0
    if current > best:
        best = current

print(best)
`,
    reference: `import sys

data = sys.stdin.read().split()
n = int(data[0])
a = [int(x) for x in data[1:1 + n]]

best = a[0]
current = a[0]
for value in a[1:]:
    current = max(value, current + value)
    best = max(best, current)

print(best)
`,
    validator: `def validate(inp):
    n = inp.int(1, 1000)
    for _ in range(n):
        inp.int(-1000, 1000)
    inp.eof()
`,
    hackPoints: 25,
    failPenalty: 0,
    orderIndex: 0,
    breakingInput: "3\n-5 -2 -9\n",
  },
  {
    title: "Count the occurrences",
    problemId: "hack-count-occurrences",
    statementMd:
      "Given a **sorted** array of `n` integers and a target `x`, print how many times `x` appears.\n\n**Input**\n```\nn x\na1 a2 … an\n```\n\n**Output** — one integer.\n\nThe solution below is wrong on at least one valid input. Find it.",
    constraintsMd: "`1 ≤ n ≤ 1000`, `-1000 ≤ x ≤ 1000`, and the array is sorted non-decreasing with each `ai` in `[-1000, 1000]`.",
    givenLanguage: "python",
    // Binary searches for one hit and then walks outwards, but stops the moment
    // it steps off either end — it under-counts when the run touches index 0.
    givenSource: `import sys

data = sys.stdin.read().split()
n, x = int(data[0]), int(data[1])
a = [int(v) for v in data[2:2 + n]]

lo, hi, found = 0, n - 1, -1
while lo <= hi:
    mid = (lo + hi) // 2
    if a[mid] == x:
        found = mid
        break
    if a[mid] < x:
        lo = mid + 1
    else:
        hi = mid - 1

if found == -1:
    print(0)
else:
    count = 1
    i = found - 1
    while i > 0 and a[i] == x:
        count += 1
        i -= 1
    j = found + 1
    while j < n and a[j] == x:
        count += 1
        j += 1
    print(count)
`,
    reference: `import sys

data = sys.stdin.read().split()
n, x = int(data[0]), int(data[1])
a = [int(v) for v in data[2:2 + n]]
print(sum(1 for v in a if v == x))
`,
    validator: `def validate(inp):
    n = inp.int(1, 1000)
    inp.int(-1000, 1000)
    previous = -10**9
    for _ in range(n):
        value = inp.int(-1000, 1000)
        assert value >= previous, "the array must be sorted non-decreasing"
        previous = value
    inp.eof()
`,
    hackPoints: 25,
    failPenalty: 0,
    orderIndex: 1,
    breakingInput: "3 7\n7 7 9\n",
  },
];

// ---------------------------------------------------------------------------
// Phase 2 — four interview classics, with an explicit I/O contract
// ---------------------------------------------------------------------------

type Case = [input: string, answer: string];

export const PROBLEMS: {
  id: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  score: number;
  basePrice: number;
  statementMd: string;
  sampleCount: number;
  timeLimitMs: number;
  memoryLimitMb: number;
  hints: { price: number; bodyMd: string }[];
  tests: Case[];
  reference: string;
}[] = [
  {
    id: "two-sum",
    title: "Two Sum",
    difficulty: "easy",
    score: 100,
    basePrice: 40,
    sampleCount: 2,
    timeLimitMs: 2000,
    memoryLimitMb: 256,
    statementMd: `Given an array of integers and a target, find the **two distinct positions** whose values add up to the target.

Exactly one such pair exists.

### Input
\`\`\`
n target
a1 a2 … an
\`\`\`

### Output
The two positions, **0-based**, smaller first, separated by a space.

### Constraints
- \`2 ≤ n ≤ 100000\`
- \`-10^9 ≤ ai, target ≤ 10^9\`

A hash map from value to position solves this in one pass.`,
    hints: [
      { price: 15, bodyMd: "You do not need to compare every pair. Ask what you would need to have *already seen* for the current element to complete the pair." },
      { price: 30, bodyMd: "Walk the array once keeping a map from value to the position it was seen at. At element `a[i]`, look up `target - a[i]` in the map; if it is there, you have your answer." },
    ],
    tests: [
      ["4 9\n2 7 11 15\n", "0 1\n"],
      ["3 6\n3 2 4\n", "1 2\n"],
      ["2 6\n3 3\n", "0 1\n"],
      ["5 -8\n-3 4 -5 9 1\n", "0 2\n"],
      ["6 1000000000\n999999999 1 5 7 9 11\n", "0 1\n"],
      ["8 0\n5 -1 3 -5 2 8 -3 0\n", "0 3\n"],
    ],
    reference: `import sys

def main():
    data = sys.stdin.buffer.read().split()
    n, target = int(data[0]), int(data[1])
    seen = {}
    for i in range(n):
        value = int(data[2 + i])
        need = target - value
        if need in seen:
            print(seen[need], i)
            return
        seen.setdefault(value, i)

main()
`,
  },
  {
    id: "valid-parentheses",
    title: "Valid Parentheses",
    difficulty: "easy",
    score: 100,
    basePrice: 40,
    sampleCount: 2,
    timeLimitMs: 2000,
    memoryLimitMb: 256,
    statementMd: `A string of brackets is **valid** when every bracket is closed by the matching kind, in the right order, and nothing is left open.

### Input
One line: a non-empty string of the characters \`()[]{}\`.

### Output
\`YES\` if the string is valid, \`NO\` if it is not.

### Constraints
- The line is between 1 and 100000 characters long.

\`([)]\` is not valid: the round bracket is closed while a square one is still open.`,
    hints: [
      { price: 15, bodyMd: "The rule \"closed in the right order\" is the definition of a stack. What should you push, and what should you check on a closing bracket?" },
      { price: 30, bodyMd: "Push every opening bracket. On a closing bracket, fail if the stack is empty or its top is not the matching opener; otherwise pop. At the end the stack must be empty." },
    ],
    tests: [
      ["()\n", "YES\n"],
      ["([)]\n", "NO\n"],
      ["{[]}\n", "YES\n"],
      ["(((((\n", "NO\n"],
      [")\n", "NO\n"],
      ["([{}])()[]{}\n", "YES\n"],
      ["(]\n", "NO\n"],
    ],
    reference: `import sys

PAIRS = {")": "(", "]": "[", "}": "{"}

def main():
    s = sys.stdin.readline().strip()
    stack = []
    for ch in s:
        if ch in "([{":
            stack.append(ch)
        else:
            if not stack or stack[-1] != PAIRS.get(ch):
                print("NO")
                return
            stack.pop()
    print("YES" if not stack else "NO")

main()
`,
  },
  {
    id: "merge-intervals",
    title: "Merge Intervals",
    difficulty: "medium",
    score: 200,
    basePrice: 70,
    sampleCount: 1,
    timeLimitMs: 3000,
    memoryLimitMb: 256,
    statementMd: `Given \`n\` intervals, merge every pair that overlaps or touches, and print what is left.

### Input
\`\`\`
n
s1 e1
s2 e2
…
\`\`\`

### Output
First the number of intervals after merging, then one interval per line as \`start end\`, sorted by start.

### Constraints
- \`1 ≤ n ≤ 100000\`
- \`0 ≤ si ≤ ei ≤ 10^9\`

Intervals that merely touch — \`[1,4]\` and \`[4,5]\` — count as overlapping and become \`[1,5]\`.`,
    hints: [
      { price: 20, bodyMd: "Nothing useful can be decided while the intervals are in an arbitrary order. What order makes each interval's fate depend only on the one before it?" },
      { price: 40, bodyMd: "Sort by start. Keep the interval you are currently building; for each next one, either extend its end (if it starts at or before that end) or close it off and start a new one." },
    ],
    tests: [
      ["4\n1 3\n2 6\n8 10\n15 18\n", "3\n1 6\n8 10\n15 18\n"],
      ["2\n1 4\n4 5\n", "1\n1 5\n"],
      ["1\n5 5\n", "1\n5 5\n"],
      ["3\n1 10\n2 3\n4 8\n", "1\n1 10\n"],
      ["5\n9 10\n7 8\n5 6\n3 4\n1 2\n", "5\n1 2\n3 4\n5 6\n7 8\n9 10\n"],
    ],
    reference: `import sys

def main():
    data = sys.stdin.buffer.read().split()
    n = int(data[0])
    spans = []
    for i in range(n):
        spans.append((int(data[1 + 2 * i]), int(data[2 + 2 * i])))
    spans.sort()

    merged = []
    start, end = spans[0]
    for s, e in spans[1:]:
        if s <= end:
            end = max(end, e)
        else:
            merged.append((start, end))
            start, end = s, e
    merged.append((start, end))

    out = [str(len(merged))]
    out += [f"{s} {e}" for s, e in merged]
    sys.stdout.write("\\n".join(out) + "\\n")

main()
`,
  },
  {
    id: "longest-unique-substring",
    title: "Longest Substring Without Repeating Characters",
    difficulty: "medium",
    score: 200,
    basePrice: 70,
    sampleCount: 2,
    timeLimitMs: 3000,
    memoryLimitMb: 256,
    statementMd: `Find the length of the longest substring that contains no repeated character.

### Input
One line: a non-empty string of printable ASCII characters with no spaces.

### Output
One integer — the length.

### Constraints
- The line is between 1 and 100000 characters long.

For \`abcabcbb\` the answer is \`3\` (\`abc\`). For \`bbbbb\` it is \`1\`.`,
    hints: [
      { price: 20, bodyMd: "Re-checking every substring is quadratic. What can you say about the *start* of the window when you meet a character you have already seen inside it?" },
      { price: 40, bodyMd: "Slide a window and keep the last position of each character. When the current character was last seen at or after the window's start, move the start to just past it. The answer is the widest the window ever gets." },
    ],
    tests: [
      ["abcabcbb\n", "3\n"],
      ["bbbbb\n", "1\n"],
      ["pwwkew\n", "3\n"],
      ["a\n", "1\n"],
      ["abcdefghij\n", "10\n"],
      ["dvdf\n", "3\n"],
      ["tmmzuxt\n", "5\n"],
    ],
    reference: `import sys

def main():
    s = sys.stdin.readline().strip()
    last = {}
    start = 0
    best = 0
    for i, ch in enumerate(s):
        if ch in last and last[ch] >= start:
            start = last[ch] + 1
        last[ch] = i
        if i - start + 1 > best:
            best = i - start + 1
    print(best)

main()
`,
  },
];

/** Standard, and deliberately round: numbers someone can reason about on the day. */
export const SETTINGS = {
  startingBalance: 1000,
  bidIncrement: 10,
  countdownSeconds: 15,
  openingWindowSeconds: 30,
  ownershipCap: 2,
  coding1Minutes: 90,
  finalMinutes: 60,
  p1PuzzlesMinutes: 45,
  p1HackingMinutes: 30,
  p1SelectionBasis:
    "Section A and Section B points are added together. Roughly the top half advance to Phase 2, at the organisers' discretion. Ties go to the earlier finish time.",
  p1LeaderboardMode: "hidden" as const,
  leaderboardMode: "live" as const,
};
