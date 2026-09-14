"use client";

/**
 * Grading written answers.
 *
 * The work is: read one answer, compare it with the model answer, type two
 * numbers, move on — forty times. So the screen is built around exactly that
 * loop and nothing else.
 *
 *   left    every answer to this question, and its state
 *   centre  the one answer being read
 *   right   the model answer, pinned, and the two number fields
 *
 * Three things follow from the loop. The model answer never scrolls away,
 * because marking consistently means re-reading it for every single answer.
 * The score field takes focus when an answer opens, so grading is type, type,
 * Enter without touching the mouse. And Enter goes to the next *ungraded*
 * answer rather than the next one, because a queue you have to hunt through is
 * not a queue.
 *
 * Blank answers are their own state, not an empty "to grade". Someone wrote
 * nothing and still needs a zero recorded; showing that as identical to an
 * unread answer is how a blank ends up ungraded at the end of the round.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Icon } from "@/components/icons";
import { Markdown } from "@/components/markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckField } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/client";
import { cn } from "@/lib/utils";

type Item = {
  participant_id: string; name: string; answer: unknown; explanation: string | null;
  manual_score: number | null; explain_score: number | null; comment: string | null;
  graded_by: string | null; flagged: boolean; auto_score: number | null;
};
type Question = {
  id: number; title: string; body_md: string; kind: string; grading: string;
  points: number; explain_points: number; model_answer: string | null;
};
type Group = { question: Question; items: Item[] };
type Data = { ungraded: number; total: number; groups: Group[] };

/** The four states an answer can be in, in the order they matter to a grader. */
type State = "flagged" | "blank" | "todo" | "partial" | "done";

function stateOf(q: Question, it: Item): State {
  const needsAnswer = q.grading === "manual";
  const needsReason = q.explain_points > 0;
  const haveAnswer = it.manual_score !== null;
  const haveReason = it.explain_score !== null;
  const done = (!needsAnswer || haveAnswer) && (!needsReason || haveReason);
  if (done) return it.flagged ? "flagged" : "done";
  if (it.flagged) return "flagged";
  if (haveAnswer || haveReason) return "partial";
  return isBlank(q, it) ? "blank" : "todo";
}

/** Nothing written at all. Still needs a zero, which is exactly why it is called out. */
function isBlank(q: Question, it: Item): boolean {
  const answerEmpty = q.grading !== "manual" || renderAnswer(it.answer).trim() === "" || it.answer === null;
  const reasonEmpty = q.explain_points === 0 || !it.explanation?.trim();
  return answerEmpty && reasonEmpty;
}

const STATE: Record<State, { dot: string; label: string }> = {
  done: { dot: "bg-green", label: "Graded" },
  partial: { dot: "bg-amber-bg", label: "Half graded" },
  todo: { dot: "bg-line-2", label: "To grade" },
  blank: { dot: "border border-line-2 bg-transparent", label: "Blank" },
  flagged: { dot: "bg-brand", label: "Flagged" },
};

export default function GradePage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hideNames, setHideNames] = useState(true);
  const [qi, setQi] = useState(0);
  const [ai, setAi] = useState(0);

  const load = useCallback(async () => {
    try {
      setData(await api.get<Data>("/api/grade/queue"));
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const group = data?.groups[qi] ?? null;
  const items = group?.items ?? [];
  const item = items[ai] ?? null;

  const states = useMemo(
    () => (group ? items.map((it) => stateOf(group.question, it)) : []),
    [group, items],
  );

  /** The next answer that still needs a number, wrapping — the whole point of the queue. */
  const nextUngraded = useCallback(
    (from: number) => {
      for (let n = 1; n <= items.length; n++) {
        const i = (from + n) % items.length;
        if (states[i] !== "done" && states[i] !== "flagged") return i;
      }
      return -1;
    },
    [items.length, states],
  );

  const move = useCallback((d: number) => setAi((i) => Math.min(items.length - 1, Math.max(0, i + d))), [items.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.tagName?.match(/INPUT|TEXTAREA|SELECT/);
      if (e.key === "[") { setQi((i) => Math.max(0, i - 1)); setAi(0); }
      if (e.key === "]") { setQi((i) => Math.min((data?.groups.length ?? 1) - 1, i + 1)); setAi(0); }
      if (typing) return;
      if (e.key === "j" || e.key === "ArrowDown") { e.preventDefault(); move(1); }
      if (e.key === "k" || e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move, data?.groups.length]);

  if (error) {
    return (
      <div className="p-8">
        <EmptyState icon={<Icon.Alert size={20} />} title="Could not load the queue" body={error}
          action={<Button size="sm" variant="outline" onClick={() => void load()}>Try again</Button>} />
      </div>
    );
  }
  if (!data) return <GradeSkeleton />;
  if (!group || data.total === 0) {
    return (
      <div className="p-8">
        <EmptyState icon={<Icon.Check size={20} />} title="Nothing to grade"
          body="Answers appear here as they are submitted." />
      </div>
    );
  }

  const graded = data.total - data.ungraded;
  const pct = data.total ? Math.round((100 * graded) / data.total) : 0;

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      {/* One bar: what this is, how far through, and the one setting that matters. */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b bg-card px-4 py-2.5 lg:px-6">
        <h1 className="text-[14px] font-semibold">Grading</h1>
        <div className="flex items-center gap-2.5">
          <div className="h-1 w-28 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[12.5px] num text-muted-foreground">
            {graded} of {data.total} graded
          </span>
        </div>
        {data.groups.length > 1 && (
          <nav className="flex min-w-0 items-center gap-1 overflow-x-auto" aria-label="Questions">
            {data.groups.map((g, i) => {
              const left = g.items.filter((it) => { const s = stateOf(g.question, it); return s !== "done" && s !== "flagged"; }).length;
              return (
                <button
                  key={g.question.id}
                  onClick={() => { setQi(i); setAi(0); }}
                  aria-current={i === qi ? "true" : undefined}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-[4px] border px-2 py-1 text-[12px] font-medium transition-colors",
                    i === qi ? "border-brand bg-brand-tint text-brand-deep" : "border-transparent text-muted-foreground hover:bg-muted",
                  )}
                >
                  <span className="max-w-[16ch] truncate">{g.question.title}</span>
                  <span className="num opacity-70">{left || "✓"}</span>
                </button>
              );
            })}
          </nav>
        )}
        <div className="ml-auto flex items-center gap-4">
          <span className="hidden items-center gap-1 text-[11.5px] text-faint xl:flex">
            <Kbd>J</Kbd><Kbd>K</Kbd> move · <Kbd>⏎</Kbd> save &amp; next · <Kbd>F</Kbd> flag
          </span>
          <CheckField label="Hide names" checked={hideNames} onChange={(e) => setHideNames(e.target.checked)} />
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[212px_minmax(0,1fr)_320px]">
        {/* --- who is left ------------------------------------------------ */}
        <aside className="pane hidden min-h-0 overflow-y-auto border-r bg-card lg:block" aria-label="Answers">
          <ol className="py-1.5">
            {items.map((it, i) => {
              const s = states[i];
              return (
                <li key={it.participant_id}>
                  <button
                    onClick={() => setAi(i)}
                    aria-current={i === ai ? "true" : undefined}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] transition-colors",
                      i === ai ? "bg-brand-tint font-semibold text-brand-deep" : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    <span className="w-4 shrink-0 text-right font-mono text-[11px] text-faint">{i + 1}</span>
                    <span className={cn("size-1.5 shrink-0 rounded-full", STATE[s].dot)} title={STATE[s].label} />
                    <span className="min-w-0 flex-1 truncate">{hideNames ? `Participant ${i + 1}` : it.name}</span>
                    {it.flagged && <Icon.Flag size={11} className="shrink-0 text-brand" />}
                    {s === "blank" && <span className="shrink-0 text-[10.5px] text-faint uppercase">blank</span>}
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>

        {/* --- the answer --------------------------------------------------- */}
        <section className="pane min-h-0 overflow-y-auto">
          {item && <AnswerView key={item.participant_id} q={group.question} item={item} index={ai} total={items.length}
            label={hideNames ? `Participant ${ai + 1}` : item.name} state={states[ai]} />}
        </section>

        {/* --- the model answer, and the numbers ---------------------------- */}
        <aside className="pane min-h-0 overflow-y-auto border-l bg-card">
          {item && (
            <GradeForm
              key={item.participant_id}
              q={group.question}
              item={item}
              onSaved={async () => {
                await load();
                const n = nextUngraded(ai);
                if (n >= 0) setAi(n);
              }}
              onMove={move}
            />
          )}
        </aside>
      </div>
    </div>
  );
}

/** The question, then the answer. Prose is set as prose; a list is set as a list. */
function AnswerView({ q, item, index, total, label, state }: {
  q: Question; item: Item; index: number; total: number; label: string; state: State;
}) {
  const [showQuestion, setShowQuestion] = useState(false);
  const answer = renderAnswer(item.answer);
  const isList = Array.isArray(item.answer);

  return (
    <div className="px-5 py-4 lg:px-6">
      <div className="flex items-center gap-2.5">
        <span className="text-[13px] font-semibold">{label}</span>
        <Badge variant={state === "done" ? "success" : state === "flagged" ? "info" : state === "partial" ? "warning" : "neutral"}>
          {STATE[state].label}
        </Badge>
        {item.graded_by && <span className="text-[11.5px] text-faint">marked already</span>}
        <span className="ml-auto text-[11.5px] num text-faint">{index + 1} of {total}</span>
      </div>

      <button
        onClick={() => setShowQuestion((v) => !v)}
        aria-expanded={showQuestion}
        className="mt-3 flex w-full items-start gap-2 rounded-[5px] border border-line bg-muted px-3 py-2 text-left transition-colors hover:border-line-2"
      >
        <Icon.ChevronDown size={14} className={cn("mt-0.5 shrink-0 text-faint transition-transform", !showQuestion && "-rotate-90")} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-semibold">{q.title}</span>
          <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
            {q.grading === "manual" ? `${q.points} pts for the answer` : "answer marked automatically"}
            {q.explain_points > 0 ? ` · ${q.explain_points} for the reasoning` : ""}
          </span>
        </span>
      </button>
      {showQuestion && (
        <div className="mt-2 rounded-[5px] border border-line bg-muted px-3.5 py-3">
          <Markdown className="prose-sm">{q.body_md}</Markdown>
        </div>
      )}

      {q.grading === "manual" && (
        <Field label="Answer">
          {answer.trim() ? (
            <div className={cn("rounded-[5px] border border-line bg-card px-3.5 py-3", isList ? "font-mono text-[12.5px] whitespace-pre-wrap" : "text-[13.5px] leading-relaxed whitespace-pre-wrap")}>
              {answer}
            </div>
          ) : (
            <Blank>Nothing was written. This still needs a score — record a zero.</Blank>
          )}
        </Field>
      )}

      {q.explain_points > 0 && (
        <Field label="Reasoning">
          {item.explanation?.trim() ? (
            <div className="rounded-[5px] border border-line bg-card px-3.5 py-3 text-[13.5px] leading-relaxed whitespace-pre-wrap">
              {item.explanation}
            </div>
          ) : (
            <Blank>No reasoning written.</Blank>
          )}
        </Field>
      )}

      {q.grading !== "manual" && item.auto_score !== null && (
        <p className="mt-4 text-[12px] text-muted-foreground">
          The answer scored <span className="font-semibold text-ink num">{item.auto_score}</span> automatically. You are marking the
          reasoning only.
        </p>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <div className="mb-1.5 text-[11px] font-semibold tracking-[0.07em] text-faint uppercase">{label}</div>
      {children}
    </div>
  );
}

function Blank({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[5px] border border-dashed border-line-2 px-3.5 py-3 text-[12.5px] text-muted-foreground">{children}</div>
  );
}

/**
 * The model answer and the two numbers, in the one place they are both needed.
 *
 * The score field takes focus on mount, so opening an answer and typing a
 * number is one motion. Enter saves and moves on.
 */
function GradeForm({ q, item, onSaved, onMove }: {
  q: Question; item: Item; onSaved: () => Promise<void>; onMove: (d: number) => void;
}) {
  const { toast } = useToast();
  const [manual, setManual] = useState(item.manual_score?.toString() ?? "");
  const [explain, setExplain] = useState(item.explain_score?.toString() ?? "");
  const [comment, setComment] = useState(item.comment ?? "");
  const [flagged, setFlagged] = useState(item.flagged);
  const [busy, setBusy] = useState(false);
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => { first.current?.focus(); first.current?.select(); }, []);

  const needsAnswer = q.grading === "manual";
  const needsReason = q.explain_points > 0;
  const complete = (!needsAnswer || manual !== "") && (!needsReason || explain !== "");

  const save = useCallback(async () => {
    if (!complete || busy) return;
    setBusy(true);
    try {
      await api.post("/api/grade", {
        participant_id: item.participant_id,
        question_id: q.id,
        manual_score: needsAnswer ? Number(manual) : undefined,
        explain_score: needsReason ? Number(explain) : undefined,
        comment,
        flagged,
      });
      await onSaved();
    } catch (err) {
      toast({ title: "Not saved", description: errorMessage(err), tone: "error" });
    } finally {
      setBusy(false);
    }
  }, [complete, busy, item.participant_id, q.id, needsAnswer, needsReason, manual, explain, comment, flagged, onSaved, toast]);

  // Enter saves from anywhere but the comment box, where it means a new line.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key === "Enter" && el?.tagName !== "TEXTAREA") { e.preventDefault(); void save(); }
      if (e.key === "f" && !el?.tagName?.match(/INPUT|TEXTAREA/)) { e.preventDefault(); setFlagged((f) => !f); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  return (
    <div className="flex min-h-full flex-col">
      {q.model_answer && (
        <div className="border-b px-4 py-3.5">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.07em] text-faint uppercase">
            <Icon.Lock size={11} /> Model answer
          </div>
          <div className="text-muted-foreground">
            <Markdown className="prose-sm">{q.model_answer}</Markdown>
          </div>
        </div>
      )}

      <div className="space-y-3.5 px-4 py-4">
        <div className="flex gap-3">
          {needsAnswer && (
            <label className="min-w-0 flex-1">
              <span className="mb-1 block text-[11.5px] font-semibold text-muted-foreground">Answer · 0–{q.points}</span>
              <Input ref={first} type="number" min={0} max={q.points} inputMode="numeric" value={manual}
                onChange={(e) => setManual(e.target.value)} className="h-8 text-[13px] num" />
            </label>
          )}
          {needsReason && (
            <label className="min-w-0 flex-1">
              <span className="mb-1 block text-[11.5px] font-semibold text-muted-foreground">Reasoning · 0–{q.explain_points}</span>
              <Input ref={needsAnswer ? undefined : first} type="number" min={0} max={q.explain_points} inputMode="numeric" value={explain}
                onChange={(e) => setExplain(e.target.value)} className="h-8 text-[13px] num" />
            </label>
          )}
        </div>

        <label className="block">
          <span className="mb-1 block text-[11.5px] font-semibold text-muted-foreground">
            Comment <span className="font-normal text-faint">— the competitor sees this</span>
          </span>
          <Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} className="text-[12.5px]"
            placeholder="Optional. Why the mark is what it is." />
        </label>

        <button
          type="button"
          onClick={() => setFlagged((f) => !f)}
          aria-pressed={flagged}
          className={cn(
            "flex w-full items-center gap-2 rounded-[5px] border px-3 py-2 text-left text-[12.5px] transition-colors",
            flagged ? "border-brand bg-brand-tint text-brand-deep" : "border-line text-muted-foreground hover:border-line-2",
          )}
        >
          <Icon.Flag size={13} className="shrink-0" />
          <span className="flex-1 font-medium">{flagged ? "Flagged for a second look" : "Flag for a second look"}</span>
          <Kbd>F</Kbd>
        </button>

        <div className="flex items-center gap-2">
          <Button onClick={save} loading={busy} disabled={!complete} className="flex-1">
            <Icon.Check size={14} /> Save &amp; next
          </Button>
          <Button variant="outline" size="icon" onClick={() => onMove(1)} aria-label="Skip to the next answer">
            <Icon.ChevronRight size={16} />
          </Button>
        </div>
        {!complete && (
          <p className="text-[11.5px] text-muted-foreground">
            {needsAnswer && manual === "" ? "Give the answer a score" : "Give the reasoning a score"} before saving.
          </p>
        )}
      </div>
    </div>
  );
}

function renderAnswer(a: unknown): string {
  if (a === null || a === undefined) return "";
  if (Array.isArray(a)) return a.join("\n");
  return String(a);
}

/** The three columns, waiting. Same rails, same widths, so nothing jumps. */
function GradeSkeleton() {
  return (
    <div className="flex h-[calc(100vh-56px)] flex-col" role="status" aria-label="Loading" aria-busy>
      <div className="flex shrink-0 items-center gap-4 border-b px-4 py-2.5 lg:px-6">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-1 w-28 rounded-full" />
        <Skeleton className="h-2.5 w-24" />
        <Skeleton className="ml-auto h-3 w-20" />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[212px_minmax(0,1fr)_320px]">
        <div className="hidden border-r py-1.5 lg:block">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-1.5">
              <Skeleton className="size-1.5 shrink-0 rounded-full" />
              <Skeleton className="h-2.5 flex-1" />
            </div>
          ))}
        </div>
        <div className="space-y-4 px-5 py-4 lg:px-6">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="h-24 w-full" />
        </div>
        <div className="hidden border-l lg:block">
          <div className="space-y-2 border-b px-4 py-3.5">
            <Skeleton className="h-2.5 w-28" />
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-2 w-4/5" />
          </div>
          <div className="space-y-3.5 px-4 py-4">
            <div className="flex gap-3">
              <Skeleton className="h-8 flex-1" />
              <Skeleton className="h-8 flex-1" />
            </div>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
