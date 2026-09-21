"use client";

/**
 * Grading written answers.
 *
 * Thirty-odd people answer the same question, and an answer runs to a couple
 * of paragraphs. So the work is one question at a time, one answer at a time:
 * the question and the model answer stay in view, the answer is shown whole,
 * and the marks are typed right under it. Next takes you to the following
 * unmarked answer; the aside lists everyone, with how each stands, so you can
 * jump to any of them and always know how far through you are.
 *
 * Marks save on their own a moment after they are typed, and the card says
 * when it is saved; there is no Save button to hunt for thirty times.
 *
 * Blank answers are their own state, not an empty "to grade": somebody wrote
 * nothing and still needs a zero recorded. They can be marked in one action,
 * because with thirty people that is the difference between a minute and ten.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { Icon } from "@/components/icons";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { PageBody, PageHeader, Section } from "@/components/ui/page";
import { AsideBlock, Figures, FilterChips, RecordBody } from "@/components/ui/record";
import { PageSkeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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

/** The states an answer can be in, in the order they matter to a grader. */
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

/** Marked, one way or another: nothing more to do on this one. */
const settled = (s: State) => s === "done" || s === "flagged";

const STATE: Record<State, { dot: string; label: string }> = {
  done: { dot: "bg-green", label: "Graded" },
  partial: { dot: "bg-amber", label: "Half graded" },
  todo: { dot: "bg-line-2", label: "To grade" },
  blank: { dot: "border border-line-2 bg-transparent", label: "Nothing written" },
  flagged: { dot: "bg-brand", label: "Flagged" },
};

type Row = { it: Item; state: State; seat: number };
type Filter = "todo" | "flagged" | "all";

/**
 * A stable order, and a stable number beside each name. The queue arrives
 * ordered by when an answer was last touched, so marking one answer would
 * reshuffle the list and "Participant 4" would become somebody else. Sorting
 * by participant means seat 4 is the same person all the way through.
 */
function rowsOf(g: Group): Row[] {
  return g.items
    .map((it) => ({ it, state: stateOf(g.question, it) }))
    .sort((a, b) => a.it.participant_id.localeCompare(b.it.participant_id))
    .map((r, i) => ({ ...r, seat: i + 1 }));
}

const matches = (filter: Filter, state: State) => filter === "all" || (filter === "flagged" ? state === "flagged" : !settled(state));

export default function GradePage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hideNames, setHideNames] = useState(true);
  const [qi, setQi] = useState(0);
  const [filter, setFilter] = useState<Filter>("todo");
  // Who is on screen. Kept by id, so a reload after a save does not move it.
  const [current, setCurrent] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api.get<Data>("/api/grade/queue"));
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setCurrent(null); }, [qi]);

  if (error) return <PageBody><EmptyState icon={<Icon.Alert size={20} />} title="Could not load the queue" body={error} /></PageBody>;
  if (!data) return <PageBody width="wide"><PageSkeleton stats={4} rows={6} cols={2} /></PageBody>;

  const groups = data.groups.map((g) => ({ g, rows: rowsOf(g) }));
  const everyRow = groups.flatMap(({ rows }) => rows);
  const count = (s: State) => everyRow.filter((r) => r.state === s).length;
  const unmarked = everyRow.filter((r) => !settled(r.state)).length;

  if (groups.length === 0) {
    return <PageBody><EmptyState icon={<Icon.Check size={20} />} title="Nothing to grade" body="Answers appear here as they are submitted." /></PageBody>;
  }

  const { g: group, rows } = groups[Math.min(qi, groups.length - 1)];
  const listed = rows.filter(({ state }) => matches(filter, state));
  // The one on screen: the chosen one, else the first still to do, else the first.
  const shown = rows.find((r) => r.it.participant_id === current) ?? listed[0] ?? rows[0];
  const at = shown ? listed.findIndex((r) => r.it.participant_id === shown.it.participant_id) : -1;
  // Next is the next listed answer after this seat, whether or not this one is still listed.
  const after = shown ? listed.find((r) => r.seat > shown.seat) ?? null : null;
  const before = shown ? [...listed].reverse().find((r) => r.seat < shown.seat) ?? null : null;
  const marked = rows.filter(({ state }) => settled(state)).length;

  return (
    <PageBody width="wide">
      <PageHeader
        title="Answers"
        description="One question at a time, one answer at a time. Marks save on their own as you type."
        actions={
          <label className="flex cursor-pointer items-center gap-2 text-[13px]">
            <Switch checked={hideNames} onCheckedChange={setHideNames} aria-label="Hide names" />
            Hide names
          </label>
        }
      />
      <Figures
        className="mb-5"
        items={[
          { label: "To grade", value: unmarked, tone: unmarked > 0 ? "warning" : "success", note: unmarked === 0 ? "all done" : "across every question" },
          { label: "Graded", value: count("done") },
          { label: "Flagged", value: count("flagged"), tone: count("flagged") > 0 ? "warning" : "default", note: "for a second look" },
          { label: "Blank", value: count("blank"), note: "still need a zero" },
        ]}
      />

      <RecordBody
        aside={
          <>
            {groups.length > 1 && (
              <AsideBlock title="Questions" className="[&>div]:p-1.5">
                <ol>
                  {groups.map(({ g, rows }, i) => {
                    const left = rows.filter((r) => !settled(r.state)).length;
                    return (
                      <li key={g.question.id}>
                        <AsideRow active={i === qi} onClick={() => { setQi(i); setFilter("todo"); }}>
                          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{g.question.title}</span>
                          {left > 0 ? <span className="shrink-0 text-[12px] tabular-nums opacity-80">{left} left</span> : <Icon.Check size={14} className="shrink-0 text-green-dark" />}
                        </AsideRow>
                      </li>
                    );
                  })}
                </ol>
              </AsideBlock>
            )}
            <AsideBlock
              title={
                <span className="flex items-center justify-between gap-3">
                  <span>Answers</span>
                  <span className="text-[12px] font-normal text-muted-foreground tabular-nums">{marked} of {rows.length} marked</span>
                </span>
              }
              className="[&>div]:p-1.5"
            >
              <div className="px-1 pt-1 pb-2">
                <FilterChips
                  label="Which answers"
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { value: "todo", label: "To grade", count: rows.filter((r) => !settled(r.state)).length },
                    { value: "flagged", label: "Flagged", count: rows.filter((r) => r.state === "flagged").length },
                    { value: "all", label: "All", count: rows.length },
                  ]}
                />
              </div>
              {listed.length === 0 ? (
                <p className="px-2.5 py-3 text-[12.5px] text-muted-foreground">Nothing here. Every answer to this question is marked; switch the filter to see them.</p>
              ) : (
                <ol className="pane max-h-[50vh] overflow-y-auto">
                  {listed.map((r) => (
                    <li key={r.it.participant_id}>
                      <AsideRow active={r.it.participant_id === shown?.it.participant_id} onClick={() => setCurrent(r.it.participant_id)}>
                        <span className="w-5 shrink-0 text-[11.5px] text-faint tabular-nums">{r.seat}</span>
                        <span className={cn("size-1.5 shrink-0 rounded-full", STATE[r.state].dot)} />
                        <span className="min-w-0 flex-1 truncate text-[13px]">{hideNames ? `Participant ${r.seat}` : r.it.name}</span>
                        <span className="shrink-0 text-[12px] tabular-nums opacity-80">{marksOf(group.question, r.it)}</span>
                      </AsideRow>
                    </li>
                  ))}
                </ol>
              )}
            </AsideBlock>
            <BulkBlanks q={group.question} rows={rows} onDone={load} />
          </>
        }
      >
        <Reference q={group.question} />
        {shown ? (
          <AnswerCard
            key={shown.it.participant_id}
            q={group.question}
            item={shown.it}
            state={shown.state}
            label={hideNames ? `Participant ${shown.seat}` : shown.it.name}
            place={at >= 0 ? `${at + 1} of ${listed.length}` : null}
            onSaved={load}
            onPrev={before ? () => setCurrent(before.it.participant_id) : null}
            onNext={after ? () => setCurrent(after.it.participant_id) : null}
          />
        ) : (
          <Section>
            <EmptyState compact icon={<Icon.Check size={18} />} title="Nothing to grade on this question" body="No answers yet." />
          </Section>
        )}
      </RecordBody>
    </PageBody>
  );
}

function AsideRow({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={cn("flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left transition-colors", active ? "bg-brand-tint text-brand-deep" : "hover:bg-muted")}
    >
      {children}
    </button>
  );
}

/** "12/20 · 4/5", or a dash for what is not marked yet. */
function marksOf(q: Question, it: Item): string {
  const parts: string[] = [];
  if (q.grading === "manual") parts.push(`${it.manual_score ?? "–"}/${q.points}`);
  if (q.explain_points > 0) parts.push(`${it.explain_score ?? "–"}/${q.explain_points}`);
  return parts.join("  ");
}

/** The question and the model answer, above the answer being marked. */
function Reference({ q }: { q: Question }) {
  const [open, setOpen] = useState(true);
  const worth = [q.grading === "manual" && `${q.points} for the answer`, q.explain_points > 0 && `${q.explain_points} for the reasoning`].filter(Boolean).join(", ");
  return (
    <Section
      title={q.title}
      description={worth}
      actions={
        <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? "Hide" : "Show"} the question
        </Button>
      }
      className={cn(!open && "[&>div:last-child]:hidden")}
    >
      <div className="grid gap-6 text-[13px] lg:grid-cols-2">
        <Markdown className="prose-sm">{q.body_md}</Markdown>
        {q.model_answer && (
          <div className="rounded-box border border-dashed border-line-2 bg-muted/30 px-4 py-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-semibold"><Icon.Lock size={12} className="text-faint" /> Model answer</div>
            <div className="text-muted-foreground"><Markdown className="prose-sm">{q.model_answer}</Markdown></div>
          </div>
        )}
      </div>
    </Section>
  );
}

/** Thirty people means several blanks. Marking them one at a time is the waste. */
function BulkBlanks({ q, rows, onDone }: { q: Question; rows: Row[]; onDone: () => Promise<void> }) {
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
    <AsideBlock title="Blank answers">
      <p className="text-[12.5px] text-muted-foreground">
        <strong className="font-semibold text-foreground tabular-nums">{blanks.length}</strong> answered nothing. They still need a zero on the record.
      </p>
      <Button variant="outline" size="sm" className="mt-2.5" onClick={zeroAll} loading={busy}>Mark all blanks 0</Button>
    </AsideBlock>
  );
}

type Marks = { manual?: string; explain?: string; comment?: string; flagged?: boolean };

/**
 * One answer, whole, and the marks for it.
 *
 * Marks save themselves a moment after the last keystroke; the card says
 * where it is, saving or saved, so nothing is silent. Left and right arrows
 * move between answers when the focus is not in a field.
 */
function AnswerCard({ q, item, state, label, place, onSaved, onPrev, onNext }: {
  q: Question; item: Item; state: State; label: string; place: string | null;
  onSaved: () => Promise<void>; onPrev: (() => void) | null; onNext: (() => void) | null;
}) {
  const { toast } = useToast();
  const [manual, setManual] = useState(item.manual_score?.toString() ?? "");
  const [explain, setExplain] = useState(item.explain_score?.toString() ?? "");
  const [comment, setComment] = useState(item.comment ?? "");
  const [flagged, setFlagged] = useState(item.flagged);
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");
  const [commenting, setCommenting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const needsAnswer = q.grading === "manual";
  const needsReason = q.explain_points > 0;
  const answer = renderAnswer(item.answer);
  const words = answer.trim() ? answer.trim().split(/\s+/).length : 0;

  const save = useCallback(async (next: Marks) => {
    const body = { manual, explain, comment, flagged, ...next };
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
  const later = (next: Marks) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(next), 700);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowRight" && onNext) { e.preventDefault(); onNext(); }
      if (e.key === "ArrowLeft" && onPrev) { e.preventDefault(); onPrev(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onNext, onPrev]);

  return (
    <Section padded={false} className={cn(state === "flagged" && "border-brand/40")}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-5 py-3">
        <h2 className="text-[15px] font-semibold">{label}</h2>
        <span className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
          <span className={cn("size-1.5 rounded-full", STATE[state].dot)} />
          {STATE[state].label}
        </span>
        {place && <span className="text-[12.5px] text-faint tabular-nums">{place} listed</span>}
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onPrev ?? undefined} disabled={!onPrev} aria-label="Previous answer"><Icon.ChevronLeft size={15} /> Previous</Button>
          <Button variant="ghost" size="sm" onClick={onNext ?? undefined} disabled={!onNext} aria-label="Next answer">Next <Icon.ChevronRight size={15} /></Button>
        </div>
      </div>

      {/*
        * The text is text, not a button: a grader selects and re-reads
        * phrases while marking. The measure is kept to reading width; an
        * answer of any length is shown whole, because the point of this
        * page is to read it.
        */}
      <div className="px-5 py-5">
        <div className="max-w-[72ch] text-[14.5px] leading-[1.7] whitespace-pre-wrap">
          {answer || <span className="text-faint italic">No answer written.</span>}
        </div>
        {words > 0 && <div className="mt-2 text-[11.5px] text-faint tabular-nums">{words} {words === 1 ? "word" : "words"}</div>}
        {needsReason && (
          <div className="mt-5 max-w-[72ch]">
            <div className="mb-1.5 text-[12.5px] font-semibold">Their reasoning</div>
            {item.explanation?.trim()
              ? <div className="border-l-2 border-line-2 pl-3.5 text-[13.5px] leading-[1.7] text-muted-foreground whitespace-pre-wrap">{item.explanation}</div>
              : <div className="text-[13px] text-faint italic">None given.</div>}
          </div>
        )}
      </div>

      {/* The marks: the one thing the grader is here to type, right under what they just read. */}
      <div className="flex flex-wrap items-end gap-x-3 gap-y-3 border-t bg-muted/30 px-5 py-4">
        {needsAnswer && <MarkField label="Answer" max={q.points} value={manual} onChange={(v) => { setManual(v); later({ manual: v }); }} autoFocus />}
        {needsReason && <MarkField label="Reasoning" max={q.explain_points} value={explain} onChange={(v) => { setExplain(v); later({ explain: v }); }} autoFocus={!needsAnswer} />}
        <div className="flex items-center gap-1 pb-0.5">
          <IconButton pressed={flagged} label={flagged ? "Remove the flag" : "Flag for a second look"} onClick={() => { const f = !flagged; setFlagged(f); void save({ flagged: f }); }}>
            <Icon.Flag size={14} />
          </IconButton>
          {!(commenting || comment) && (
            <IconButton label="Add a comment the competitor will see" onClick={() => setCommenting(true)}>
              <Icon.Edit size={14} />
            </IconButton>
          )}
        </div>
        <span className="pb-2 text-[12px] text-faint" aria-live="polite">{saved === "saving" ? "Saving" : saved === "saved" ? "Saved" : ""}</span>
        <div className="ml-auto flex items-center gap-2 pb-0.5">
          <span className="hidden items-center gap-1 text-[11.5px] text-faint sm:flex"><Kbd>←</Kbd><Kbd>→</Kbd> to move</span>
          <Button size="sm" onClick={onNext ?? undefined} disabled={!onNext}>Next answer <Icon.ArrowRight size={14} /></Button>
        </div>
        {(commenting || comment) && (
          <Textarea
            rows={2}
            autoFocus={commenting && !comment}
            value={comment}
            onChange={(e) => { setComment(e.target.value); later({ comment: e.target.value }); }}
            placeholder="A comment. The competitor sees this."
            aria-label={`Comment for ${label}`}
            className="basis-full text-[13px]"
          />
        )}
      </div>
    </Section>
  );
}

function IconButton({ pressed, label, onClick, children }: { pressed?: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-9 items-center justify-center rounded-md border transition-colors",
        pressed ? "border-brand bg-brand-tint text-brand-deep" : "border-transparent text-faint hover:border-line hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/** One number, bounded, with its range beside the label rather than in a tooltip. */
function MarkField({ label, max, value, onChange, autoFocus }: { label: string; max: number; value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <label className="w-[96px] shrink-0">
      <span className="mb-1 block text-[12px] whitespace-nowrap text-muted-foreground">
        {label} <span className="text-faint tabular-nums">/ {max}</span>
      </span>
      <Input
        type="number" min={0} max={max} inputMode="numeric" value={value} aria-label={`${label} out of ${max}`}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 px-2 text-center text-[16px] font-semibold tabular-nums"
      />
    </label>
  );
}

/** Answers arrive as a string, a number, or a list of entries. */
function renderAnswer(answer: unknown): string {
  if (answer === null || answer === undefined) return "";
  if (Array.isArray(answer)) return answer.map((a) => String(a)).join("\n");
  return String(answer);
}
