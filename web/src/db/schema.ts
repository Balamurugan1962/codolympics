/**
 * Contest schema -- docs/lld.md §3, plus the Phase 1 tables.
 *
 * Identity (user, session, account) is owned by Better Auth in auth-schema.ts.
 * Contest state hangs off it rather than living inside it, so virtual money
 * never sits in a table the auth library migrates.
 *
 * All money is a plain integer -- no cents, no decimals anywhere (NFR-B-12).
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

import { user } from "./auth-schema";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

// ---------------------------------------------------------------------------
// Contest-wide
// ---------------------------------------------------------------------------

export const PHASES = [
  "registration",
  "p1_puzzles",
  "p1_hacking",
  "review",
  "auction1",
  "coding1",
  "auction2",
  "final",
  "ended",
] as const;
export type Phase = (typeof PHASES)[number];

export const LEADERBOARD_MODES = ["live", "frozen", "hidden"] as const;
export type LeaderboardMode = (typeof LEADERBOARD_MODES)[number];

/** Exactly one row (id = 1). Every tunable an administrator can change. */
export const contest = pgTable(
  "contest",
  {
    id: integer("id").primaryKey().default(1),
    phase: text("phase").$type<Phase>().notNull().default("registration"),
    phaseEndsAt: ts("phase_ends_at"),
    registrationOpen: boolean("registration_open").notNull().default(true),

    // Phase 2 economics (structure fixed, values set once the problem set exists)
    startingBalance: integer("starting_balance").notNull().default(1000),
    bidIncrement: integer("bid_increment").notNull().default(10),
    countdownSeconds: integer("countdown_seconds").notNull().default(15),
    openingWindowSeconds: integer("opening_window_seconds").notNull().default(30),
    ownershipCap: integer("ownership_cap"), // null = uncapped (US-B4-01)
    coding1Minutes: integer("coding1_minutes").notNull().default(90),
    finalMinutes: integer("final_minutes").notNull().default(60),

    // Phase 1
    p1PuzzlesMinutes: integer("p1_puzzles_minutes").notNull().default(45),
    p1HackingMinutes: integer("p1_hacking_minutes").notNull().default(45),
    p1SelectionBasis: text("p1_selection_basis").notNull().default(""), // announced before Phase 1 (US-P6-01)
    p1LeaderboardMode: text("p1_leaderboard_mode").$type<LeaderboardMode>().notNull().default("hidden"),

    leaderboardMode: text("leaderboard_mode").$type<LeaderboardMode>().notNull().default("live"),
    leaderboardFrozenAt: ts("leaderboard_frozen_at"),
  },
  (t) => [check("contest_single_row", sql`${t.id} = 1`)],
);

/** One row per competing account. Evaluators and admins have none. */
export const participant = pgTable(
  "participant",
  {
    userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
    balance: integer("balance").notNull().default(0),
    preferredLanguage: text("preferred_language"),
    registeredAt: ts("registered_at").notNull().defaultNow(),
    // Cooldown (US-B5-03): starts when a judgement ends OR is cancelled.
    lastJudgementEndedAt: ts("last_judgement_ended_at"),
    // Phase 1 "finish" action records submission time for the tiebreak (US-P4-02).
    p1PuzzlesFinishedAt: ts("p1_puzzles_finished_at"),
    p1HackingFinishedAt: ts("p1_hacking_finished_at"),
    // Malpractice (US-P6-03). Reversible; answers are retained.
    disqualifiedAt: ts("disqualified_at"),
    disqualifiedReason: text("disqualified_reason"),
  },
  (t) => [check("balance_nonnegative", sql`${t.balance} >= 0`)], // NFR-B-03 backstop
);

// ---------------------------------------------------------------------------
// Phase 2: questions and the auction
// ---------------------------------------------------------------------------

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/** Contest-facing data for a problem the judge holds testcases for. */
export const question = pgTable("question", {
  id: text("id").primaryKey(), // the judge's problem_id
  title: text("title").notNull(),
  difficulty: text("difficulty").$type<Difficulty>().notNull(),
  score: integer("score").notNull(),
  basePrice: integer("base_price").notNull(),
  statementMd: text("statement_md").notNull().default(""),
  // Samples are the first K testcases of the package; text is read from
  // there, never retyped (decision 69).
  sampleCount: integer("sample_count").notNull().default(0),
  auctionOrder: integer("auction_order").notNull().default(0), // published in advance (decision 53i)
  status: text("status").$type<"unsold" | "sold" | "void">().notNull().default("unsold"),
  problemVersion: text("problem_version"), // what the judge currently publishes
  validated: boolean("validated").notNull().default(false),
});

/** Author-written hints, unlocked in order (decision 49, US-B6-01). */
export const hint = pgTable(
  "hint",
  {
    questionId: text("question_id").notNull().references(() => question.id, { onDelete: "cascade" }),
    idx: integer("idx").notNull(),
    price: integer("price").notNull(),
    bodyMd: text("body_md").notNull(),
  },
  (t) => [primaryKey({ columns: [t.questionId, t.idx] })],
);

/** One question offered once, in one auction round. */
export const lot = pgTable(
  "lot",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    questionId: text("question_id").notNull().references(() => question.id),
    round: integer("round").notNull(), // 1 or 2
    state: text("state").$type<"pending" | "open" | "closed" | "unsold">().notNull().default("pending"),
    order: integer("order").notNull(),
    openedAt: ts("opened_at"),
    // The clock lives here, not in a timer (decision 66). A scheduler reads it.
    noBidDeadline: ts("no_bid_deadline"), // opening window; null once a bid lands
    biddingEndsAt: ts("bidding_ends_at"), // restarts on every bid; null = manual close only
    currentBid: integer("current_bid"),
    currentBidderId: text("current_bidder_id").references(() => participant.userId),
    closedAt: ts("closed_at"),
  },
  (t) => [unique("lot_question_round").on(t.questionId, t.round)],
);

export const bid = pgTable(
  "bid",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    lotId: bigint("lot_id", { mode: "number" }).notNull().references(() => lot.id),
    participantId: text("participant_id").notNull().references(() => participant.userId),
    amount: integer("amount").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("bid_lot_idx").on(t.lotId)],
);

/** Exactly one row per sold question. The primary key IS the exclusivity rule. */
export const ownership = pgTable("ownership", {
  questionId: text("question_id").primaryKey().references(() => question.id),
  participantId: text("participant_id").notNull().references(() => participant.userId),
  pricePaid: integer("price_paid").notNull(),
  awardedAt: ts("awarded_at").notNull().defaultNow(), // solve time is measured from here
  voidedAt: ts("voided_at"),
});

export const hintPurchase = pgTable(
  "hint_purchase",
  {
    questionId: text("question_id").notNull(),
    hintIdx: integer("hint_idx").notNull(),
    participantId: text("participant_id").notNull().references(() => participant.userId),
    pricePaid: integer("price_paid").notNull(),
    purchasedAt: ts("purchased_at").notNull().defaultNow(),
  },
  // The key makes double-charging impossible (US-B6-01).
  (t) => [primaryKey({ columns: [t.questionId, t.hintIdx, t.participantId] })],
);

/** Every balance change (US-B4-02, NFR-B-07). */
export const ledger = pgTable(
  "ledger",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    participantId: text("participant_id").notNull().references(() => participant.userId),
    delta: integer("delta").notNull(), // negative debit, positive refund
    balanceAfter: integer("balance_after").notNull(),
    reason: text("reason").$type<"bid_won" | "hint" | "refund" | "admin_adjust" | "starting_balance">().notNull(),
    ref: text("ref"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("ledger_participant_idx").on(t.participantId)],
);

// ---------------------------------------------------------------------------
// Phase 2: submissions
// ---------------------------------------------------------------------------

export const submission = pgTable(
  "submission",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    participantId: text("participant_id").notNull().references(() => participant.userId),
    questionId: text("question_id").notNull().references(() => question.id),
    language: text("language").notNull(),
    source: text("source").notNull(), // retained for the contest (US-B5-02)
    createdAt: ts("created_at").notNull().defaultNow(), // server clock, always (US-B2-02)
  },
  (t) => [index("submission_participant_question_idx").on(t.participantId, t.questionId)],
);

export const JUDGEMENT_STATES = ["pending", "queued", "running", "done"] as const;
export type JudgementState = (typeof JUDGEMENT_STATES)[number];

export const VERDICTS = ["AC", "WA", "TLE", "MLE", "OLE", "RE", "CE", "IE"] as const;
export type Verdict = (typeof VERDICTS)[number];

/**
 * Many per submission; a rejudge inserts a new one and stamps the old
 * (US-B9-01). The current verdict is the row with superseded_at IS NULL.
 */
export const judgement = pgTable(
  "judgement",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    submissionId: bigint("submission_id", { mode: "number" }).notNull().references(() => submission.id),
    state: text("state").$type<JudgementState>().notNull().default("pending"),
    jobId: text("job_id"),
    verdict: text("verdict").$type<Verdict>(),
    passed: integer("passed"),
    total: integer("total"),
    firstFail: integer("first_fail"),
    maxTimeMs: real("max_time_ms"),
    maxMemoryKb: integer("max_memory_kb"),
    compileOutput: text("compile_output"),
    message: text("message"),
    juryDetail: text("jury_detail"), // NEVER leaves the server for a participant (NFR-B-05)
    problemVersion: text("problem_version"),
    progressDone: integer("progress_done").notNull().default(0),
    progressTotal: integer("progress_total").notNull().default(0),
    attempt: integer("attempt").notNull().default(1),
    retries: integer("retries").notNull().default(0),
    cancelled: boolean("cancelled").notNull().default(false),
    supersededAt: ts("superseded_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
    endedAt: ts("ended_at"),
  },
  (t) => [
    index("judgement_submission_idx").on(t.submissionId),
    index("judgement_state_idx").on(t.state),
  ],
);

/** Editor content, autosaved (US-F5-03). */
export const draft = pgTable(
  "draft",
  {
    participantId: text("participant_id").notNull().references(() => participant.userId),
    questionId: text("question_id").notNull(),
    source: text("source").notNull(),
    language: text("language").notNull(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.participantId, t.questionId] })],
);

// ---------------------------------------------------------------------------
// Messaging and audit
// ---------------------------------------------------------------------------

export const announcement = pgTable("announcement", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  bodyMd: text("body_md").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

/** Something one participant must be told (verdict changed, override applied). */
export const notification = pgTable(
  "notification",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    participantId: text("participant_id").notNull().references(() => participant.userId),
    bodyMd: text("body_md").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
    readAt: ts("read_at"),
  },
  (t) => [index("notification_participant_idx").on(t.participantId)],
);

/** US-B1-02, US-B9-04, decision 53r. `reason` is never optional. */
export const auditLog = pgTable("audit_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  actorId: text("actor_id"),
  action: text("action").notNull(),
  target: text("target"),
  reason: text("reason").notNull(),
  detail: jsonb("detail"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Phase 1 -- Section A: logical puzzles
// ---------------------------------------------------------------------------

export const P1_CATEGORIES = ["pattern", "detective", "constraint"] as const;
export const P1_KINDS = ["mcq_single", "mcq_multi", "fill_blank", "numeric", "sequence", "set", "long_text"] as const;
export const P1_GRADING = ["auto", "validator", "manual"] as const;
export type P1Kind = (typeof P1_KINDS)[number];
export type P1Grading = (typeof P1_GRADING)[number];

/** Per-kind configuration, stored as JSON. Shown to participants (no answers in it). */
export type P1Config = {
  options?: string[];          // mcq_single, mcq_multi
  items?: string[];            // sequence: the items to order
  partialCredit?: boolean;     // mcq_multi, set
  tolerance?: number;          // numeric
  caseSensitive?: boolean;     // fill_blank, set
};

/** The answer key. NEVER serialised to a participant (NFR-P-03). */
export type P1AnswerKey = {
  option?: number;             // mcq_single: index
  options?: number[];          // mcq_multi: indexes
  accepted?: string[];         // fill_blank: accepted spellings
  value?: number;              // numeric
  order?: number[];            // sequence: correct order of item indexes
  members?: string[];          // set
};

export const p1Question = pgTable("p1_question", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  title: text("title").notNull(),
  bodyMd: text("body_md").notNull(),
  category: text("category").$type<(typeof P1_CATEGORIES)[number]>().notNull(),
  kind: text("kind").$type<P1Kind>().notNull(),
  grading: text("grading").$type<P1Grading>().notNull(),
  points: integer("points").notNull(),
  explainPoints: integer("explain_points").notNull().default(0), // 0 = no explanation asked
  orderIndex: integer("order_index").notNull().default(0),
  published: boolean("published").notNull().default(false),
  voided: boolean("voided").notNull().default(false),
  config: jsonb("config").$type<P1Config>().notNull().default({}),
  answerKey: jsonb("answer_key").$type<P1AnswerKey>(), // auto only
  modelAnswer: text("model_answer"),                     // manual: a grading aid, never sent
  validatorPy: text("validator_py"),                     // validator mode, never sent
  pointsPerEntry: integer("points_per_entry"),           // validator mode
  maxEntries: integer("max_entries").notNull().default(100),
  formatRegex: text("format_regex"),                     // client-side shape check; safe to send
  formatHint: text("format_hint"),
  ready: boolean("ready").notNull().default(false),
  // The self-test that set `ready` ran on whichever install exported this, not
  // on this one. Shown beside the state so "Ready" never over-claims.
  verifiedElsewhere: boolean("verified_elsewhere").notNull().default(false),
});

/** A participant's answer to one Section A question. */
export const p1Answer = pgTable(
  "p1_answer",
  {
    participantId: text("participant_id").notNull().references(() => participant.userId),
    questionId: bigint("question_id", { mode: "number" }).notNull().references(() => p1Question.id),
    answer: jsonb("answer").$type<unknown>(),   // shape follows kind
    explanation: text("explanation"),
    autoScore: integer("auto_score"),           // auto + validator; null until scored
    manualScore: integer("manual_score"),       // manual; evaluator-awarded
    explainScore: integer("explain_score"),     // evaluator-awarded
    gradedBy: text("graded_by"),
    gradedAt: ts("graded_at"),
    gradeComment: text("grade_comment"),
    // Validator scoring runs through the judge at section close.
    scoreJobId: text("score_job_id"),
    scoreState: text("score_state").$type<"pending" | "queued" | "done" | "error">(),
    scoreError: text("score_error"),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.participantId, t.questionId] })],
);

// ---------------------------------------------------------------------------
// Phase 1 -- Section B: hacking
// ---------------------------------------------------------------------------

/**
 * A problem plus a deliberately flawed solution. The judge package (limits,
 * validator, reference solution) is uploaded separately under `problemId`;
 * the reference is never in this database at all.
 */
export const p1HackQuestion = pgTable("p1_hack_question", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  title: text("title").notNull(),
  statementMd: text("statement_md").notNull(),
  constraintsMd: text("constraints_md").notNull().default(""),
  problemId: text("problem_id").notNull(),       // the judge problem carrying the reference
  givenSource: text("given_source").notNull(),   // SHOWN to participants; reading it is the task
  givenLanguage: text("given_language").notNull(),
  hackPoints: integer("hack_points").notNull(),
  failPenalty: integer("fail_penalty").notNull().default(0), // administrator-set (decision: default 0)
  orderIndex: integer("order_index").notNull().default(0),
  published: boolean("published").notNull().default(false),
  voided: boolean("voided").notNull().default(false),
  ready: boolean("ready").notNull().default(false),   // a known breaking input was proven
  breakingInput: text("breaking_input"),             // the input that proved it -- an answer key, never sent
  verifiedElsewhere: boolean("verified_elsewhere").notNull().default(false), // proven where this was exported
});

export const p1HackAttempt = pgTable(
  "p1_hack_attempt",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    participantId: text("participant_id").notNull().references(() => participant.userId),
    questionId: bigint("question_id", { mode: "number" }).notNull().references(() => p1HackQuestion.id),
    input: text("input").notNull(),
    state: text("state").$type<"pending" | "queued" | "running" | "done">().notNull().default("pending"),
    jobId: text("job_id"),
    validInput: boolean("valid_input"),
    invalidReason: text("invalid_reason"),   // shown to the participant
    hacked: boolean("hacked"),
    verdict: text("verdict"),                // evaluators and admins only
    pointsAwarded: integer("points_awarded").notNull().default(0),
    retries: integer("retries").notNull().default(0),
    createdAt: ts("created_at").notNull().defaultNow(),
    endedAt: ts("ended_at"),
  },
  (t) => [index("hack_attempt_participant_idx").on(t.participantId, t.questionId)],
);

/** Who advances to Phase 2 -- an administrator's selection (US-P6-01). */
export const p1Advancement = pgTable("p1_advancement", {
  participantId: text("participant_id").primaryKey().references(() => participant.userId),
  advanced: boolean("advanced").notNull(),
  decidedBy: text("decided_by").notNull(),
  decidedAt: ts("decided_at").notNull().defaultNow(),
  reason: text("reason").notNull(),
});
