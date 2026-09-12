"use client";

/** Section A: every published question at once, answer in any order, revise until close (US-P4-02). */
import { useCallback, useEffect, useRef, useState } from "react";

import { useContest } from "@/components/contest-provider";
import { Countdown } from "@/components/countdown";
import { Markdown } from "@/components/markdown";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { api, errorMessage } from "@/lib/client";

type Q = { id: number; title: string; body_md: string; category: string; kind: string; grading: string; points: number; explain_points: number; config: { options?: string[]; items?: string[] }; max_entries: number; format_regex: string | null; format_hint: string | null };
type Data = { open: boolean; phase_ends_at: string | null; questions: Q[]; answers: Record<number, { answer: unknown; explanation: string | null }> };

export default function PuzzlesPage() {
  const { state, refresh } = useContest();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [current, setCurrent] = useState(0);

  const load = useCallback(async () => {
    try { setData(await api.get<Data>("/api/phase1/puzzles")); } catch (err) { setError(errorMessage(err)); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (error) return <Alert tone="info" title="Section A">{error}</Alert>;
  if (!data) return null;
  const finished = state?.me?.p1_puzzles_finished;
  const locked = !data.open || finished;
  const q = data.questions[current];
  const answered = new Set(Object.keys(data.answers).map(Number));

  async function finish() {
    try { await api.post("/api/phase1/finish", { section: "puzzles" }); setFinishOpen(false); await refresh(); await load(); }
    catch (err) { setError(errorMessage(err)); }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-4">
      <Card className="lg:col-span-1">
        <CardHeader title="Questions" action={<Countdown until={data.phase_ends_at} className="text-sm font-semibold" />} />
        <CardBody className="space-y-1 p-2">
          {data.questions.map((x, i) => (
            <button key={x.id} onClick={() => setCurrent(i)}
              className={`flex w-full items-center justify-between rounded-box px-3 py-2 text-left text-sm ${i === current ? "bg-green-tint font-semibold" : "hover:bg-page"}`}>
              <span>{i + 1}. {x.title}</span>
              {answered.has(x.id) ? <span className="h-2 w-2 rounded-full bg-green" /> : <span className="h-2 w-2 rounded-full border border-line-2" />}
            </button>
          ))}
          <div className="border-t border-line pt-3 text-center">
            {finished ? <Badge tone="green">Finished</Badge> : <Button size="sm" variant="secondary" className="w-full" disabled={locked} onClick={() => setFinishOpen(true)}>Submit &amp; finish</Button>}
            <p className="mt-2 text-xs text-faint">Finishing records your submission time for the tiebreak. Answers stay as they are.</p>
          </div>
        </CardBody>
      </Card>

      <div className="lg:col-span-3">
        {!data.open && !finished && <div className="mb-4"><Alert tone="warning">Section A is closed. Your answers are recorded as they were.</Alert></div>}
        {q && <QuestionCard key={q.id} q={q} saved={data.answers[q.id]} locked={Boolean(locked)} onSaved={load} />}
      </div>

      <Dialog open={finishOpen} onClose={() => setFinishOpen(false)} title="Finish Section A?">
        <p className="text-sm">You have answered <strong>{answered.size}</strong> of <strong>{data.questions.length}</strong> questions. After finishing you cannot change any answer. Your submission time is recorded now.</p>
        <div className="mt-4 flex justify-end gap-2"><Button variant="secondary" onClick={() => setFinishOpen(false)}>Keep working</Button><Button onClick={finish}>Finish</Button></div>
      </Dialog>
    </div>
  );
}

function QuestionCard({ q, saved, locked, onSaved }: { q: Q; saved?: { answer: unknown; explanation: string | null }; locked: boolean; onSaved: () => void }) {
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
    }, 800);
  };

  // Format is checked here, as typed; correctness is never revealed (US-P2-06).
  const checkFormat = (s: string) => {
    if (!q.format_regex) return true;
    const ok = new RegExp(q.format_regex).test(s);
    setFormatError(ok ? null : `Expected: ${q.format_hint ?? "a different format"}`);
    return ok;
  };

  const set = (v: unknown) => { setAnswer(v); schedule({ answer: v }); };

  return (
    <Card>
      <CardHeader title={<span className="flex items-center gap-2">{q.title} <Badge tone="grey">{q.category}</Badge> <Badge tone="grey">{q.points} pts{q.explain_points ? ` + ${q.explain_points} for reasoning` : ""}</Badge></span>}
        action={<span className={`text-xs ${status === "failed" ? "font-semibold text-red" : "text-faint"}`}>{status === "saving" ? "Saving…" : status === "saved" ? "Saved" : status === "failed" ? "NOT saved" : ""}</span>} />
      <CardBody className="space-y-4">
        <Markdown>{q.body_md}</Markdown>
        <div className="rounded-box border border-line bg-page p-4">
          <div className="mb-2 text-xs font-semibold uppercase text-muted">Your answer</div>
          {q.kind === "mcq_single" && (q.config.options ?? []).map((o, i) => (
            <label key={i} className="flex items-center gap-2 py-1 text-sm"><input type="radio" disabled={locked} checked={answer === i} onChange={() => set(i)} /> {o}</label>
          ))}
          {q.kind === "mcq_multi" && (q.config.options ?? []).map((o, i) => {
            const arr = (answer as number[]) ?? [];
            return <label key={i} className="flex items-center gap-2 py-1 text-sm"><input type="checkbox" disabled={locked} checked={arr.includes(i)} onChange={(e) => set(e.target.checked ? [...arr, i].sort() : arr.filter((x) => x !== i))} /> {o}</label>;
          })}
          {(q.kind === "fill_blank" || q.kind === "numeric") && (
            <Input disabled={locked} value={String(answer ?? "")} placeholder={q.format_hint ?? undefined} onChange={(e) => { const v = e.target.value; setAnswer(v); if (checkFormat(v)) schedule({ answer: v }); }} />
          )}
          {q.kind === "sequence" && <SequenceInput items={q.config.items ?? []} value={(answer as number[]) ?? []} disabled={locked} onChange={set} />}
          {q.kind === "set" && <ListInput value={(answer as string[]) ?? []} max={q.max_entries} disabled={locked} hint={q.format_hint} check={checkFormat} onChange={set} />}
          {q.kind === "long_text" && <Textarea rows={8} disabled={locked} value={String(answer ?? "")} onChange={(e) => set(e.target.value)} placeholder={q.format_hint ?? "Write your answer"} />}
          {formatError && <p className="mt-2 text-xs font-semibold text-red">{formatError}</p>}
        </div>
        {q.explain_points > 0 && (
          <div>
            <div className="mb-1 text-xs font-semibold uppercase text-muted">Your reasoning <span className="font-normal normal-case text-faint">— graded by an evaluator, {q.explain_points} pts</span></div>
            <Textarea rows={5} disabled={locked} value={explanation} onChange={(e) => { setExplanation(e.target.value); schedule({ explanation: e.target.value }); }} />
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function defaultAnswer(q: Q): unknown {
  if (q.kind === "mcq_multi" || q.kind === "set") return [];
  if (q.kind === "sequence") return (q.config.items ?? []).map((_, i) => i);
  if (q.kind === "mcq_single") return null;
  return "";
}

function SequenceInput({ items, value, disabled, onChange }: { items: string[]; value: number[]; disabled: boolean; onChange: (v: number[]) => void }) {
  const order = value.length === items.length ? value : items.map((_, i) => i);
  const move = (from: number, dir: -1 | 1) => {
    const to = from + dir; if (to < 0 || to >= order.length) return;
    const next = [...order]; [next[from], next[to]] = [next[to], next[from]]; onChange(next);
  };
  return (
    <ol className="space-y-1">
      {order.map((idx, pos) => (
        <li key={idx} className="flex items-center gap-2 rounded-box border border-line bg-card px-3 py-1.5 text-sm">
          <span className="w-5 text-faint">{pos + 1}.</span><span className="flex-1">{items[idx]}</span>
          <button disabled={disabled || pos === 0} onClick={() => move(pos, -1)} className="text-muted disabled:opacity-30">↑</button>
          <button disabled={disabled || pos === order.length - 1} onClick={() => move(pos, 1)} className="text-muted disabled:opacity-30">↓</button>
        </li>
      ))}
    </ol>
  );
}

function ListInput({ value, max, disabled, hint, check, onChange }: { value: string[]; max: number; disabled: boolean; hint: string | null; check: (s: string) => boolean; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => { const s = draft.trim(); if (!s || !check(s) || value.length >= max) return; onChange([...value, s]); setDraft(""); };
  return (
    <div>
      <div className="flex gap-2">
        <Input disabled={disabled} value={draft} placeholder={hint ?? "Add an entry"} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <Button variant="secondary" disabled={disabled || value.length >= max} onClick={add}>Add</Button>
      </div>
      <ul className="mt-2 flex flex-wrap gap-2">
        {value.map((v, i) => <li key={i} className="flex items-center gap-1 rounded-box border border-line bg-card px-2 py-1 font-mono text-xs">{v}{!disabled && <button className="text-faint" onClick={() => onChange(value.filter((_, j) => j !== i))}>×</button>}</li>)}
      </ul>
      <p className="mt-1 text-xs text-faint">{value.length}/{max} entries. Whether an entry is correct is not shown until the section closes.</p>
    </div>
  );
}
