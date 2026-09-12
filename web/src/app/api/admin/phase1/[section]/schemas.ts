/** Request shapes for Phase 1 authoring, shared by the create and update routes. */
import { z } from "zod";

import { P1_CATEGORIES, P1_GRADING, P1_KINDS } from "@/db/schema";

export const Puzzle = z.object({
  reason: z.string().min(3),
  title: z.string().min(1).max(200),
  body_md: z.string().max(100_000),
  category: z.enum(P1_CATEGORIES),
  kind: z.enum(P1_KINDS),
  grading: z.enum(P1_GRADING),
  points: z.number().int().min(0),
  explain_points: z.number().int().min(0).default(0),
  order_index: z.number().int().min(0).default(0),
  config: z.object({
    options: z.array(z.string()).optional(), items: z.array(z.string()).optional(),
    partialCredit: z.boolean().optional(), tolerance: z.number().min(0).optional(), caseSensitive: z.boolean().optional(),
  }).default({}),
  answer_key: z.object({
    option: z.number().int().optional(), options: z.array(z.number().int()).optional(), accepted: z.array(z.string()).optional(),
    value: z.number().optional(), order: z.array(z.number().int()).optional(), members: z.array(z.string()).optional(),
  }).nullable().optional(),
  model_answer: z.string().max(20_000).nullable().optional(),
  validator_py: z.string().max(100_000).nullable().optional(),
  points_per_entry: z.number().int().min(0).nullable().optional(),
  max_entries: z.number().int().min(1).max(1000).default(100),
  format_regex: z.string().max(500).nullable().optional(),
  format_hint: z.string().max(200).nullable().optional(),
});

export const Hack = z.object({
  reason: z.string().min(3),
  title: z.string().min(1).max(200),
  statement_md: z.string().max(100_000),
  constraints_md: z.string().max(20_000).default(""),
  problem_id: z.string().regex(/^[A-Za-z0-9._-]+$/),
  given_source: z.string().max(262_144),
  given_language: z.string().max(32),
  hack_points: z.number().int().min(0),
  fail_penalty: z.number().int().min(0).default(0),
  order_index: z.number().int().min(0).default(0),
});

export function toPuzzleInput(b: z.infer<typeof Puzzle>) {
  return {
    title: b.title, bodyMd: b.body_md, category: b.category, kind: b.kind, grading: b.grading, points: b.points,
    explainPoints: b.explain_points, orderIndex: b.order_index, config: b.config, answerKey: b.answer_key ?? null,
    modelAnswer: b.model_answer ?? null, validatorPy: b.validator_py ?? null, pointsPerEntry: b.points_per_entry ?? null,
    maxEntries: b.max_entries, formatRegex: b.format_regex ?? null, formatHint: b.format_hint ?? null,
  };
}

export function toHackInput(b: z.infer<typeof Hack>) {
  return {
    title: b.title, statementMd: b.statement_md, constraintsMd: b.constraints_md, problemId: b.problem_id,
    givenSource: b.given_source, givenLanguage: b.given_language, hackPoints: b.hack_points, failPenalty: b.fail_penalty, orderIndex: b.order_index,
  };
}
