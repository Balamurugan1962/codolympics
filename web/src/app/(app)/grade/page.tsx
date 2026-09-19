"use client";

/**
 * Grading written answers — a marking sheet, not a slideshow.
 *
 * Thirty-odd people answer the same question, so the work is one question at a
 * time across everybody: read an answer, type a mark, read the next. An
 * earlier version showed one answer per screen with the marks in a far column;
 * that is thirty navigations and thirty eye journeys across the screen for a
 * question whose answers are three lines long.
 *
 * So every answer to the selected question is on one page, in one column, with
 * its mark fields on the row itself. Marks save on their own a moment after
 * they are typed — there is no Save button to hunt for thirty times — and the
 * row says when it is saved.
 *
 * The question and the model answer sit above the list and stay there, because
 * marking consistently means re-reading them for every answer.
 *
 * Blank answers are their own state, not an empty "to grade": somebody wrote
 * nothing and still needs a zero recorded. They can be marked in one action,
 * because with thirty people that is the difference between a minute and ten.
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


type Filter = "todo" | "all" | "flagged";

export default function GradePage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hideNames, setHideNames] = useState(true);
  const [qi, setQi] = useState(0);
  const [filter, setFilter] = useState<Filter>("todo");
  /*
   * Which rows are on screen is decided when the question or the filter
   * changes, and not again. Re-filtering on every save would pull a row out
   * from under the grader the moment the first digit of a mark lands.
   */
  const [shownIds, setShownIds] = useState<string[] | null>(null);

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
  // The first paint of a question or filter fixes the row set.
  useEffect(() => {
    setShownIds(null);
  }, [qi, filter]);

  if (error) return <EmptyState icon={<Icon.Alert size={20} />} title="Could not load the queue" body={error} />;
  if (!data) return <SheetSkeleton />;
  if (data.groups.length === 0) {
    return <EmptyState icon={<Icon.Check size={20} />} title="Nothing to grade" body="Answers appear here as they are submitted." />;
  }

  const group = data.groups[Math.min(qi, data.groups.length - 1)];
  /*
   * A stable order, and a stable number beside each name.
   *
   * The queue arrives ordered by when an answer was last touched, so marking
   * one answer — or a competitor editing theirs — reshuffled the sheet under
   * the grader, and "Participant 4" became somebody else. Sorting by
   * participant means row 4 is the same person all the way through.
   */
  const rows = group.items
    .map((it, i) => ({ it, state: stateOf(group.question, it), seat: i }))
    .sort((a, b) => a.it.participant_id.localeCompare(b.it.participant_id))
    .map((r, i) => ({ ...r, seat: i + 1 }));
  const done = rows.filter(({ state }) => state === "done" || state === "flagged").length;
  const matching = rows.filter(({ state }) => (filter === "all" ? true : filter === "flagged" ? state === "flagged" : state !== "done" && state !== "flagged"));
  const shown = shownIds ? rows.filter(({ it }) => shownIds.includes(it.participant_id)) : matching;
  const hidden = matching.filter(({ it }) => !shown.some((r) => r.it.participant_id === it.participant_id)).length;

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      <SheetToolbar
        groups={data.groups}
        qi={qi}
        onQuestion={(i) => { setQi(i); setFilter("todo"); setShownIds(null); }}
        done={done}
        total={rows.length}
        filter={filter}
        onFilter={(f) => { setFilter(f); setShownIds(null); }}
        hideNames={hideNames}
        onHideNames={setHideNames}
      />
      <div className="pane min-h-0 flex-1 overflow-y-auto bg-muted/20 px-4 py-5 lg:px-6">
        {/* One framed sheet: the question, the bulk action, the column header
            and every row share the same edges and the same side padding. */}
        <div className="mx-auto w-full max-w-5xl border bg-card">
          <Reference q={group.question} />
          <BulkBlanks q={group.question} rows={rows} onDone={load} />
        {hidden > 0 && (
          <div className="flex items-center gap-3 border-t bg-brand-tint/50 px-5 py-2 text-[12.5px]">
            <span className="text-muted-foreground">
              <strong className="font-semibold text-foreground tabular-nums">{hidden}</strong> marked and still listed.
            </span>
            <Button variant="ghost" size="sm" onClick={() => setShownIds(matching.map(({ it }) => it.participant_id))}>
              Clear them
            </Button>
          </div>
        )}
        {shown.length === 0 ? (
          <div className="px-6 py-10">
            <EmptyState compact title="Nothing left here" body="Every answer to this question is marked. Switch the filter to see them." />
          </div>
        ) : (
          <>
          <div className="hidden items-center gap-x-4 border-y bg-muted/40 px-5 py-2 text-[10px] font-semibold tracking-[0.06em] text-faint uppercase sm:flex">
            <span className="w-6" />
            <span className="min-w-0 flex-1">Answer and reasoning</span>
            <span className="flex w-[236px] items-center gap-2">
              <span className="w-[72px] text-center">Answer /{group.question.points}</span>
              {group.question.explain_points > 0 && <span className="w-[72px] text-center">Reason /{group.question.explain_points}</span>}
            </span>
          </div>
          <ol className="divide-y">
            {shown.map(({ it, state, seat }) => (
              <MarkRow
                key={it.participant_id}
                q={group.question}
                item={it}
                state={state}
                label={hideNames ? `Participant ${seat}` : it.name}
                index={seat - 1}
                onSaved={load}
              />
            ))}
          </ol>
          </>
        )}
        </div>
      </div>
    </div>
  );
}

/** What is being marked, how far through, and which answers to show. */
function SheetToolbar({ groups, qi, onQuestion, done, total, filter, onFilter, hideNames, onHideNames }: {
  groups: Group[]; qi: number; onQuestion: (i: number) => void; done: number; total: number;
  filter: Filter; onFilter: (f: Filter) => void; hideNames: boolean; onHideNames: (v: boolean) => void;
}) {
  const pct = total ? Math.round((100 * done) / total) : 0;
  return (
    <div className="shrink-0 border-b bg-card">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 lg:px-6">
        <h1 className="text-[14px] font-semibold">Grading</h1>
        <div className="flex items-center gap-2.5">
          <div className="h-1 w-28 overflow-hidden bg-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-brand transition-[width]" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[12.5px] tabular-nums text-muted-foreground">{done} of {total} marked</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <ToggleRow
            options={[["todo", "To grade"], ["flagged", "Flagged"], ["all", "All"]]}
            value={filter}
            onChange={(v) => onFilter(v as Filter)}
          />
          <CheckField label="Hide names" checked={hideNames} onChange={(e) => onHideNames(e.target.checked)} />
        </div>
      </div>
      {groups.length > 1 && (
        <nav className="flex min-w-0 items-center gap-1 overflow-x-auto border-t px-4 py-1.5 lg:px-6" aria-label="Questions">
          {groups.map((g, i) => {
            const left = g.items.filter((it) => !["done", "flagged"].includes(stateOf(g.question, it))).length;
            return (
              <button
                key={g.question.id}
                onClick={() => onQuestion(i)}
                aria-current={i === qi ? "true" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 border px-2 py-1 text-[12px] font-medium transition-colors",
                  i === qi ? "border-brand bg-brand-tint text-brand-deep" : "border-transparent text-muted-foreground hover:bg-muted",
                )}
              >
                <span className="max-w-[18ch] truncate">{g.question.title}</span>
                <span className="tabular-nums opacity-70">{left || "✓"}</span>
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}

/** A row of mutually exclusive choices, the size of a filter rather than a form. */
function ToggleRow({ options, value, onChange }: { options: [string, string][]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center border" role="group">
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          aria-pressed={v === value}
          className={cn(
            "px-2.5 py-1 text-[12px] font-medium transition-colors",
            v === value ? "bg-navy text-white" : "text-muted-foreground hover:bg-muted",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** The question and the model answer, above the sheet and scrolling with it. */
function Reference({ q }: { q: Question }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-card px-4 py-3.5 lg:px-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[14px] leading-snug font-semibold">{q.title}</h2>
          <div className="mt-0.5 text-[11.5px] tabular-nums text-faint">
            {q.grading === "manual" && `${q.points} pts for the answer`}
            {q.grading === "manual" && q.explain_points > 0 && " · "}
            {q.explain_points > 0 && `${q.explain_points} for the reasoning`}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? "Hide" : "Show"} the question
        </Button>
      </div>
      {open && (
        <div className="mt-3 grid gap-5 border-t pt-3 text-[12.5px] lg:grid-cols-2">
          <Markdown className="prose-sm">{q.body_md}</Markdown>
          {q.model_answer && (
            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.07em] text-faint uppercase">
                <Icon.Lock size={11} /> Model answer
              </div>
              <div className="text-muted-foreground">
                <Markdown className="prose-sm">{q.model_answer}</Markdown>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Thirty people means several blanks. Marking them one at a time is the waste. */
function BulkBlanks({ q, rows, onDone }: { q: Question; rows: { it: Item; state: State }[]; onDone: () => Promise<void> }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const blanks = rows.filter(({ state }) => state === "blank");
  if (blanks.length === 0) return null;

  const zeroAll = async () => {
    setBusy(true);
    try {
      for (const { it } of blanks) {
        await api.post("/api/grade", {
          participant_id: it.participant_id,
          question_id: q.id,
          manual_score: q.grading === "manual" ? 0 : undefined,
          explain_score: q.explain_points > 0 ? 0 : undefined,
        });
      }
      await onDone();
      toast({ title: `${blanks.length} blank answers marked 0`, tone: "success" });
    } catch (err) {
      toast({ title: "Not saved", description: errorMessage(err), tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 border-t bg-muted/40 px-4 py-2.5 text-[12.5px] lg:px-6">
      <span className="text-muted-foreground">
        <strong className="font-semibold text-foreground tabular-nums">{blanks.length}</strong> answered nothing.
      </span>
      <Button variant="outline" size="sm" onClick={zeroAll} loading={busy}>
        Mark all blanks 0
      </Button>
    </div>
  );
}

/**
 * One answer, and the marks for it, on one row.
 *
 * Marks save themselves a moment after the last keystroke: with thirty rows on
 * screen a Save button per row is thirty extra clicks, and a single Save at the
 * bottom is a cliff to fall off. The row says where it is — saving, saved, or
 * not yet marked — so nothing is silent.
 */
function MarkRow({ q, item, state, label, index, onSaved }: {
  q: Question; item: Item; state: State; label: string; index: number; onSaved: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [manual, setManual] = useState(item.manual_score?.toString() ?? "");
  const [explain, setExplain] = useState(item.explain_score?.toString() ?? "");
  const [comment, setComment] = useState(item.comment ?? "");
  const [flagged, setFlagged] = useState(item.flagged);
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");
  const [open, setOpen] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const needsAnswer = q.grading === "manual";
  const needsReason = q.explain_points > 0;

  const answer = renderAnswer(item.answer);
  const words = answer.trim() ? answer.trim().split(/\s+/).length : 0;
  /** Roughly more than the three lines the row shows, or more than a couple of paragraphs. */
  const long = answer.length > 200 || answer.split("\n").length > 3 || (item.explanation?.length ?? 0) > 160;

  const save = useCallback(async (next: { manual?: string; explain?: string; comment?: string; flagged?: boolean }) => {
    const body = { manual: manual, explain: explain, comment, flagged, ...next };
    setSaved("saving");
    try {
      await api.post("/api/grade", {
        participant_id: item.participant_id,
        question_id: q.id,
        manual_score: needsAnswer && body.manual !== "" ? Number(body.manual) : undefined,
        explain_score: needsReason && body.explain !== "" ? Number(body.explain) : undefined,
        comment: body.comment,
        flagged: body.flagged,
      });
      setSaved("saved");
      await onSaved();
    } catch (err) {
      setSaved("idle");
      toast({ title: "Not saved", description: errorMessage(err), tone: "error" });
    }
  }, [comment, explain, flagged, item.participant_id, manual, needsAnswer, needsReason, onSaved, q.id, toast]);

  /** Typing a mark should not fire a request per keystroke. */
  const later = (next: Parameters<typeof save>[0]) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(next), 700);
  };

  return (
    <li
      className={cn(
        "relative grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-4 gap-y-3 px-5 py-4 transition-colors",
        "hover:bg-muted/40 focus-within:bg-brand-tint/40 sm:grid-cols-[1.5rem_minmax(0,1fr)_auto]",
        // A bar down the left says where the row stands without a badge on every line.
        "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:content-['']",
        state === "done" && "before:bg-green",
        state === "flagged" && "before:bg-brand",
        state === "partial" && "before:bg-amber-bg",
        state === "blank" && "before:bg-line-2",
        (state === "todo") && "before:bg-transparent",
      )}
    >
      <div className="pt-px text-right font-mono text-[11px] text-faint tabular-nums">{index + 1}</div>

      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-[11.5px] font-semibold tracking-[0.02em] text-muted-foreground uppercase">{label}</span>
          <span className="text-[11px] text-faint">{state === "blank" ? "nothing written" : STATE[state].label}</span>
        </div>
        {/*
          * The text is text, not a button: a grader selects and re-reads
          * phrases while marking, and a click that collapsed the answer under
          * the cursor made that impossible.
          *
          * A long answer scrolls inside its own box rather than growing the
          * row — an open-ended question can run to thousands of characters,
          * and one of those would otherwise push every other answer off the
          * sheet.
          */}
        <div
          className={cn(
            "mt-1 text-[14px] leading-relaxed whitespace-pre-wrap",
            open ? "pane max-h-[32vh] overflow-y-auto border-l-2 border-line-2 bg-muted/20 py-1.5 pl-3" : "line-clamp-3",
          )}
        >
          {answer || <span className="text-faint italic">no answer</span>}
        </div>
        {item.explanation && (
          <div
            className={cn(
              "mt-1.5 border-l-2 border-line pl-3 text-[13px] leading-relaxed text-muted-foreground whitespace-pre-wrap",
              open ? "pane max-h-[18vh] overflow-y-auto" : "line-clamp-2",
            )}
          >
            {item.explanation}
          </div>
        )}
        {long && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="mt-1.5 text-[11.5px] font-semibold text-brand-deep hover:underline"
          >
            {open ? "Show less" : `Show all${words ? ` · ${words} words` : ""}`}
          </button>
        )}
        {(commenting || comment) && (
          <Textarea
            rows={1}
            autoFocus={commenting && !comment}
            value={comment}
            onChange={(e) => { setComment(e.target.value); later({ comment: e.target.value }); }}
            placeholder="Comment. The competitor sees this"
            aria-label={`Comment for ${label}`}
            className="mt-2 min-h-8 py-1 text-[12.5px]"
          />
        )}
      </div>

      {/* The marks: the one thing the grader is here to type, next to what they just read. */}
      <div className="col-start-2 flex w-full items-start gap-2 self-start sm:col-start-3 sm:w-[236px] sm:pt-0.5">
        {needsAnswer && <MarkField label="Answer" max={q.points} value={manual} onChange={(v) => { setManual(v); later({ manual: v }); }} />}
        {needsReason && <MarkField label="Reason" max={q.explain_points} value={explain} onChange={(v) => { setExplain(v); later({ explain: v }); }} />}
        <RowActions
          flagged={flagged}
          onFlag={() => { const f = !flagged; setFlagged(f); void save({ flagged: f }); }}
          onComment={() => setCommenting(true)}
          commenting={commenting || Boolean(comment)}
          saved={saved}
        />
      </div>
    </li>
  );
}

/** Flag, comment and the one word that says the row is safe. */
function RowActions({ flagged, onFlag, onComment, commenting, saved }: {
  flagged: boolean; onFlag: () => void; onComment: () => void; commenting: boolean; saved: "idle" | "saving" | "saved";
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onFlag}
        aria-pressed={flagged}
        aria-label="Flag for a second look"
        className={cn("flex size-8 items-center justify-center border transition-colors",
          flagged ? "border-brand bg-brand-tint text-brand-deep" : "border-transparent text-faint hover:border-line hover:text-muted-foreground")}
      >
        <Icon.Flag size={14} />
      </button>
      {!commenting && (
        <button
          type="button"
          onClick={onComment}
          aria-label="Add a comment"
          className="flex size-8 items-center justify-center border border-transparent text-faint transition-colors hover:border-line hover:text-muted-foreground"
        >
          <Icon.Edit size={14} />
        </button>
      )}
      <span className="w-11 text-[11px] text-faint" aria-live="polite">
        {saved === "saving" ? "Saving" : saved === "saved" ? "Saved" : ""}
      </span>
    </div>
  );
}

/** One number, bounded, with its range in the label rather than in a tooltip. */
function MarkField({ label, max, value, onChange }: { label: string; max: number; value: string; onChange: (v: string) => void }) {
  return (
    <label className="w-[72px] shrink-0">
      {/* The sheet has a header for these at sm and up; below that each row says it. */}
      <span className="mb-1 block text-[10px] font-semibold tracking-[0.06em] whitespace-nowrap text-faint uppercase sm:hidden">
        {label} <span className="font-normal tabular-nums">/{max}</span>
      </span>
      <Input type="number" min={0} max={max} inputMode="numeric" value={value} aria-label={`${label} out of ${max}`}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 px-2 text-center text-[16px] font-semibold tabular-nums" />
    </label>
  );
}

/** Answers arrive as a string, a number, or a list of entries. */
function renderAnswer(answer: unknown): string {
  if (answer === null || answer === undefined) return "";
  if (Array.isArray(answer)) return answer.map((a) => String(a)).join("\n");
  return String(answer);
}

/** The sheet, waiting: the toolbar, the question, then rows at their real height. */
function SheetSkeleton() {
  return (
    <div className="flex h-[calc(100vh-56px)] flex-col" role="status" aria-label="Loading" aria-busy>
      <div className="flex shrink-0 items-center gap-4 border-b bg-card px-4 py-3 lg:px-6">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-1 w-28" />
        <Skeleton className="ml-auto h-7 w-44" />
      </div>
      <div className="bg-card px-4 py-3.5 lg:px-6">
        <Skeleton className="h-3 w-56" />
        <Skeleton className="mt-2 h-2.5 w-32" />
      </div>
      <ol className="divide-y border-t">
        {Array.from({ length: 8 }).map((_, i) => (
          <li key={i} className="grid gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:px-6">
            <div className="min-w-0 space-y-2">
              <Skeleton className="h-2.5 w-32" />
              <Skeleton className="h-2.5 w-4/5" />
              <Skeleton className="h-2.5 w-3/5" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-[92px]" />
              <Skeleton className="h-8 w-[92px]" />
              <Skeleton className="h-8 w-56" />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
