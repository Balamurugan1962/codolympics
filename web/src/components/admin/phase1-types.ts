/** Shapes the administrator's Phase 1 endpoints return (database rows, secrets included). */
export type Puzzle = {
  id: number; title: string; bodyMd: string; category: "pattern" | "detective" | "constraint";
  kind: "mcq_single" | "mcq_multi" | "fill_blank" | "numeric" | "sequence" | "set" | "long_text";
  grading: "auto" | "validator" | "manual"; points: number; explainPoints: number; orderIndex: number;
  published: boolean; voided: boolean; ready: boolean;
  config: { options?: string[]; items?: string[]; partialCredit?: boolean; tolerance?: number; caseSensitive?: boolean };
  answerKey: { option?: number; options?: number[]; accepted?: string[]; value?: number; order?: number[]; members?: string[] } | null;
  modelAnswer: string | null; validatorPy: string | null; pointsPerEntry: number | null; maxEntries: number;
  formatRegex: string | null; formatHint: string | null;
};

export type Hack = {
  id: number; title: string; statementMd: string; constraintsMd: string; problemId: string; givenSource: string; givenLanguage: string;
  hackPoints: number; failPenalty: number; orderIndex: number; published: boolean; voided: boolean; ready: boolean;
};

export type Standing = { participant_id: string; name: string; points: number; provisional: boolean; submitted_at: string | null; disqualified: boolean; advanced: boolean | null; rank: number };

export const KIND_LABEL: Record<Puzzle["kind"], string> = {
  mcq_single: "Multiple choice", mcq_multi: "Multiple answers", fill_blank: "Short answer", numeric: "Number",
  sequence: "Put in order", set: "List of entries", long_text: "Written answer",
};
export const CATEGORY_LABEL: Record<Puzzle["category"], string> = { pattern: "Pattern", detective: "Detective", constraint: "Constraint" };
export const GRADING_LABEL: Record<Puzzle["grading"], string> = { auto: "Automatic", validator: "Validator code", manual: "Evaluator" };

export type QuestionState = "draft" | "ready" | "live" | "void";
export function stateOf(q: { published: boolean; voided: boolean; ready: boolean }): QuestionState {
  return q.voided ? "void" : q.published ? "live" : q.ready ? "ready" : "draft";
}
