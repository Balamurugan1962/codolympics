"use client";

/** Section A: a rail of questions with progress, one question at a time, a sticky bar to move, save and finish. */
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";

import { useContest } from "@/components/contest-provider";
import { Countdown } from "@/components/countdown";
import { Icon } from "@/components/icons";
import { Markdown } from "@/components/markdown";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Textarea } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { CardSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/client";

void dynamic;

type Q = { id: number; title: string; body_md: string; category: string; kind: string; grading: string; points: number; explain_points: number; config: { options?: string[]; items?: string[] }; max_entries: number; format_regex: string | null; format_hint: string | null };
type Data = { open: boolean; phase_ends_at: string | null; questions: Q[]; answers: Record<number, { answer: unknown; explanation: string | null }> };

export default function PuzzlesPage() {
  const { state, refresh } = useContest();
  const { toast } = useToast();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [current, setCurrent] = useState(0);

  const load = useCallback(async () => { try { setData(await api.get<Data>("/api/phase1/puzzles")); } catch (err) { setError(errorMessage(err)); } }, []);
  useEffect(() => { void load(); }, [load]);

  const total = data?.questions.length ?? 0;
  const go = useCallback((d: number) => setCurrent((c) => Math.min(total - 1, Math.max(0, c + d))), [total]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName?.match(/INPUT|TEXTAREA|SELECT/)) return;
      if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  if (error) return <EmptyState icon={<Icon.Puzzle size={22} />} title="Section A is not open" body={error} />;
  if (!data) return <div className="grid gap-4 lg:grid-cols-[260px_1fr]"><CardSkeleton lines={8} /><CardSkeleton lines={12} /></div>;
  const finished = state?.me?.p1_puzzles_finished;
  const locked = !data.open || finished;
  const q = data.questions[current];
  const answered = new Set(Object.keys(data.answers).map(Number));
  const pct = total ? Math.round((100 * answered.size) / total) : 0;

  async function finish() {
    try { await api.post("/api/phase1/finish", { section: "puzzles" }); setFinishOpen(false); await refresh(); await load(); toast({ title: "Section A finished", description: "Your submission time is recorded.", tone: "success" }); }
    catch (err) { toast({ title: "Could not finish", description: errorMessage(err), tone: "error" }); }
  }

  return (
    <div className="animate-fade-in pb-20">
      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <Card>
            <div className="border-b border-line px-4 py-3">
              <div className="flex items-center justify-between text-sm"><span className="font-semibold">Questions</span><span className="text-muted">{answered.size}/{total}</span></div>
              <div className="mt-2 h-1.5 w-full rounded bg-line"><div className="h-1.5 rounded bg-green transition-[width]" style={{ width: `${pct}%` }} /></div>
            </div>
            <ol className="max-h-[50vh] overflow-auto pane p-2 lg:max-h-none">
              {data.questions.map((x, i) => (
                <li key={x.id}>
                  <button onClick={() => setCurrent(i)} aria-current={i === current ? "true" : undefined}
                    className={`flex w-full items-center gap-2 rounded-box px-3 py-2 text-left text-sm ${i === current ? "bg-green-tint font-semibold text-ink" : "text-muted hover:bg-page hover:text-ink"}`}>
                    <span className={`h-2 w-2 shrink-0 rounded-full ${answered.has(x.id) ? "bg-green" : "border border-line-2"}`} aria-label={answered.has(x.id) ? "answered" : "unanswered"} />
                    <span className="truncate">{i + 1}. {x.title}</span>
                    <span className="ml-auto text-xs text-faint">{x.points}</span>
                  </button>
                </li>
              ))}
            </ol>
          </Card>
        </aside>

        <div>
          {!data.open && !finished && <div className="mb-3"><Alert tone="warning" title="Section A is closed">Your answers are recorded as they were when it closed.</Alert></div>}
          {finished && <div className="mb-3"><Alert tone="success" title="You finished Section A">Your answers are locked and your submission time is recorded.</Alert></div>}
          {q && <QuestionCard key={q.id} index={current} total={total} q={q} saved={data.answers[q.id]} locked={Boolean(locked)} onSaved={load} />}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-2.5">
          <Button variant="secondary" size="sm" icon={<Icon.ChevronLeft />} onClick={() => go(-1)} disabled={current === 0}>Previous</Button>
          <Button variant="secondary" size="sm" onClick={() => go(1)} disabled={current >= total - 1}>Next <Icon.ChevronRight /></Button>
          <span className="hidden text-xs text-faint sm:inline"><Kbd>←</Kbd> <Kbd>→</Kbd> to move</span>
          <span className="ml-auto flex items-center gap-1.5 text-sm text-muted"><Icon.Clock /><Countdown until={data.phase_ends_at} className="font-semibold text-ink" /></span>
          {finished ? <Badge tone="green">Finished</Badge> : <Button size="sm" icon={<Icon.Flag />} disabled={locked} onClick={() => setFinishOpen(true)}>Submit &amp; finish</Button>}
        </div>
      </div>

      <Dialog open={finishOpen} onClose={() => setFinishOpen(false)} title="Finish Section A?">
        <p className="text-sm">You have answered <strong>{answered.size}</strong> of <strong>{total}</strong>. After finishing you cannot change anything. Your submission time — the tiebreak — is recorded now.</p>
        {answered.size < total && <div className="mt-3"><Alert tone="warning">{total - answered.size} question{total - answered.size === 1 ? "" : "s"} unanswered.</Alert></div>}
        <div className="mt-4 flex justify-end gap-2"><Button variant="secondary" onClick={() => setFinishOpen(false)}>Keep working</Button><Button onClick={finish} icon={<Icon.Flag />}>Finish</Button></div>
      </Dialog>
    </div>
  );
}

function QuestionCard({ index, total, q, saved, locked, onSaved }: { index: number; total: number; q: Q; saved?: { answer: unknown; explanation: string | null }; locked: boolean; onSaved: () => void }) {
  const [answer, setAnswer] = useState<unknown>(saved?.answer ?? defaultAnswer(q));
  const [explanation, setExplanation] = useState(saved?.explanation ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [formatError, setFormatError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedule = (next: { answer?: unknown; explanation?: string }) => {
    if (locked) return;
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try { await api.put(`/api/phase1/puzzles/${q.id}/answer`, next); setStatus("saved"); setFormatError(null); onSaved(); }
      catch (err) { setStatus("failed"); setFormatError(errorMessage(err)); }
    }, 700);
  };
  const checkFormat = (s: string) => { if (!q.format_regex) return true; const ok = new RegExp(q.format_regex).test(s); setFormatError(ok ? null : `Expected: ${q.format_hint ?? "a different format"}`); return ok; };
  const set = (v: unknown) => { setAnswer(v); schedule({ answer: v }); };

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-faint">Question {index + 1} of {total} · {q.category}</div>
          <h2 className="mt-0.5 text-lg font-semibold">{q.title}</h2>
        </div>
        <div className="flex items-center gap-2"><Badge tone="navy">{q.points} pts</Badge>{q.explain_points > 0 && <Badge tone="grey">+{q.explain_points} reasoning</Badge>}</div>
      </div>
      <CardBody className="space-y-5 px-5">
        <Markdown>{q.body_md}</Markdown>
        <section className="rounded-box border border-line bg-page p-4">
          <div className="mb-2 flex items-center justify-between"><div className="text-xs font-semibold uppercase tracking-wide text-muted">Your answer</div>
            <span className={`text-xs ${status === "failed" ? "font-semibold text-red" : "text-faint"}`} aria-live="polite">{status === "saving" ? "Saving…" : status === "saved" ? "Saved" : status === "failed" ? "Not saved" : locked ? "Locked" : ""}</span></div>
          {q.kind === "mcq_single" && (q.config.options ?? []).map((o, i) => (
            <label key={i} className={`mb-1 flex cursor-pointer items-center gap-3 rounded-box border px-3 py-2 text-sm ${answer === i ? "border-green bg-green-tint" : "border-line bg-card hover:border-line-2"}`}><input type="radio" className="accent-green" disabled={locked} checked={answer === i} onChange={() => set(i)} /> {o}</label>
          ))}
          {q.kind === "mcq_multi" && (q.config.options ?? []).map((o, i) => { const arr = (answer as number[]) ?? []; return (
            <label key={i} className={`mb-1 flex cursor-pointer items-center gap-3 rounded-box border px-3 py-2 text-sm ${arr.includes(i) ? "border-green bg-green-tint" : "border-line bg-card hover:border-line-2"}`}><input type="checkbox" className="accent-green" disabled={locked} checked={arr.includes(i)} onChange={(e) => set(e.target.checked ? [...arr, i].sort() : arr.filter((x) => x !== i))} /> {o}</label>); })}
          {(q.kind === "fill_blank" || q.kind === "numeric") && <Input className="max-w-sm" disabled={locked} value={String(answer ?? "")} placeholder={q.format_hint ?? "Your answer"} onChange={(e) => { const v = e.target.value; setAnswer(v); if (checkFormat(v)) schedule({ answer: v }); }} />}
          {q.kind === "sequence" && <SequenceInput items={q.config.items ?? []} value={(answer as number[]) ?? []} disabled={locked} onChange={set} />}
          {q.kind === "set" && <ListInput value={(answer as string[]) ?? []} max={q.max_entries} disabled={locked} hint={q.format_hint} check={checkFormat} onChange={set} />}
          {q.kind === "long_text" && <Textarea rows={8} disabled={locked} value={String(answer ?? "")} onChange={(e) => set(e.target.value)} placeholder={q.format_hint ?? "Write your answer"} />}
          {formatError && <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-red"><Icon.Alert size={12} /> {formatError}</p>}
        </section>
        {q.explain_points > 0 && (
          <section>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Your reasoning <span className="font-normal normal-case text-faint">— marked by an evaluator, up to {q.explain_points} pts</span></div>
            <Textarea rows={5} disabled={locked} value={explanation} onChange={(e) => { setExplanation(e.target.value); schedule({ explanation: e.target.value }); }} placeholder="Show how you got there." />
          </section>
        )}
      </CardBody>
    </Card>
  );
}

function defaultAnswer(q: Q): unknown { if (q.kind === "mcq_multi" || q.kind === "set") return []; if (q.kind === "sequence") return (q.config.items ?? []).map((_, i) => i); if (q.kind === "mcq_single") return null; return ""; }

function SequenceInput({ items, value, disabled, onChange }: { items: string[]; value: number[]; disabled: boolean; onChange: (v: number[]) => void }) {
  const order = value.length === items.length ? value : items.map((_, i) => i);
  const move = (from: number, dir: -1 | 1) => { const to = from + dir; if (to < 0 || to >= order.length) return; const next = [...order]; [next[from], next[to]] = [next[to], next[from]]; onChange(next); };
  return (
    <ol className="space-y-1">{order.map((idx, pos) => (
      <li key={idx} className="flex items-center gap-2 rounded-box border border-line bg-card px-3 py-2 text-sm"><span className="w-5 text-faint">{pos + 1}.</span><span className="flex-1">{items[idx]}</span>
        <button disabled={disabled || pos === 0} onClick={() => move(pos, -1)} className="rounded p-1 text-muted hover:bg-page disabled:opacity-30" aria-label="Move up">↑</button>
        <button disabled={disabled || pos === order.length - 1} onClick={() => move(pos, 1)} className="rounded p-1 text-muted hover:bg-page disabled:opacity-30" aria-label="Move down">↓</button></li>
    ))}</ol>
  );
}

function ListInput({ value, max, disabled, hint, check, onChange }: { value: string[]; max: number; disabled: boolean; hint: string | null; check: (s: string) => boolean; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => { const s = draft.trim(); if (!s || !check(s) || value.length >= max) return; onChange([...value, s]); setDraft(""); };
  return (
    <div>
      <div className="flex max-w-md gap-2"><Input disabled={disabled} value={draft} placeholder={hint ?? "Add an entry, press Enter"} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} /><Button variant="secondary" disabled={disabled || value.length >= max} onClick={add}>Add</Button></div>
      <ul className="mt-2 flex flex-wrap gap-2">{value.map((v, i) => <li key={i} className="flex items-center gap-1 rounded-box border border-line bg-card px-2 py-1 font-mono text-xs">{v}{!disabled && <button className="text-faint hover:text-red" aria-label={`Remove ${v}`} onClick={() => onChange(value.filter((_, j) => j !== i))}><Icon.X size={12} /></button>}</li>)}</ul>
      <p className="mt-1 text-xs text-faint">{value.length}/{max} entries. Whether each is correct is revealed when the section closes.</p>
    </div>
  );
}
