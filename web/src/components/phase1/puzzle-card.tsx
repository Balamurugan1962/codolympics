"use client";

/**
 * One Section A question exactly as a participant sees it: the statement,
 * the answer control for its kind, and the reasoning box when asked for.
 * The answering page and the administrator's preview both render this.
 */
import { useState } from "react";

import { Icon } from "../icons";
import { Markdown } from "../markdown";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";

export type PuzzleView = {
  id: number; title: string; body_md: string; category: string; kind: string; grading: string; points: number; explain_points: number;
  config: { options?: string[]; items?: string[] }; max_entries: number; format_regex: string | null; format_hint: string | null;
};

export type SaveStatus = "idle" | "saving" | "saved" | "failed";

export function defaultAnswer(q: Pick<PuzzleView, "kind" | "config">): unknown {
  if (q.kind === "mcq_multi" || q.kind === "set") return [];
  if (q.kind === "sequence") return (q.config.items ?? []).map((_, i) => i);
  if (q.kind === "mcq_single") return null;
  return "";
}

export function PuzzleCard({ q, index, total, answer, explanation, status, locked, formatError, onAnswer, onExplanation, preview = false }: {
  q: PuzzleView; index: number; total: number; answer: unknown; explanation: string; status: SaveStatus; locked: boolean; formatError: string | null;
  onAnswer: (v: unknown, formatOk: boolean) => void; onExplanation: (v: string) => void; preview?: boolean;
}) {
  const statusText = status === "saving" ? "Saving…" : status === "saved" ? "Saved" : status === "failed" ? "Not saved" : locked ? "Locked" : preview ? "Preview — nothing is saved" : "";
  return (
    <div className="overflow-hidden rounded-box border border-line bg-card">
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">Question {index + 1} of {total} · {q.category}</div>
          <h2 className="mt-1 text-[17px] font-semibold leading-snug">{q.title || <span className="text-faint">Untitled question</span>}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="navy">{q.points} pts</Badge>
          {q.explain_points > 0 && <Badge variant="neutral">+{q.explain_points} reasoning</Badge>}
        </div>
      </div>
      <div className="space-y-5 p-5">
        {q.body_md.trim() ? <Markdown>{q.body_md}</Markdown> : <p className="text-[13px] text-faint">The question text goes here.</p>}
        <section className="rounded-box border border-line bg-page p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Your answer</div>
            <span className={`text-[11.5px] ${status === "failed" ? "font-semibold text-red" : "text-faint"}`} aria-live="polite">{statusText}</span>
          </div>
          <AnswerInput q={q} value={answer} disabled={locked} onChange={onAnswer} />
          {formatError && <p className="mt-2 flex items-center gap-1 text-[12px] font-semibold text-red"><Icon.Alert size={12} /> {formatError}</p>}
        </section>
        {q.explain_points > 0 && (
          <section>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Your reasoning <span className="font-normal normal-case tracking-normal text-faint">— marked by an evaluator, up to {q.explain_points} pts</span>
            </div>
            <Textarea rows={5} disabled={locked} value={explanation} onChange={(e) => onExplanation(e.target.value)} placeholder="Show how you got there." />
          </section>
        )}
      </div>
    </div>
  );
}

/** The control for one kind of answer. Reports whether the value passes the format check. */
export function AnswerInput({ q, value, disabled, onChange }: { q: PuzzleView; value: unknown; disabled: boolean; onChange: (v: unknown, formatOk: boolean) => void }) {
  const formatOk = (s: string) => !q.format_regex || safeRegex(q.format_regex).test(s);
  const options = q.config.options ?? [];

  if (q.kind === "mcq_single") {
    return (
      <div className="space-y-1.5">
        {options.length === 0 && <p className="text-[12.5px] text-faint">No options yet.</p>}
        {options.map((o, i) => (
          <label key={i} className={`flex cursor-pointer items-center gap-3 rounded-box border px-3 py-2.5 text-[13px] transition-colors ${value === i ? "border-green bg-green-tint" : "border-line bg-card hover:border-line-2"} ${disabled ? "cursor-default" : ""}`}>
            <input type="radio" className="accent-brand" disabled={disabled} checked={value === i} onChange={() => onChange(i, true)} />
            <span className="min-w-0 flex-1">{o || <span className="text-faint">Option {i + 1}</span>}</span>
          </label>
        ))}
      </div>
    );
  }
  if (q.kind === "mcq_multi") {
    const arr = Array.isArray(value) ? (value as number[]) : [];
    return (
      <div className="space-y-1.5">
        {options.length === 0 && <p className="text-[12.5px] text-faint">No options yet.</p>}
        {options.map((o, i) => (
          <label key={i} className={`flex cursor-pointer items-center gap-3 rounded-box border px-3 py-2.5 text-[13px] transition-colors ${arr.includes(i) ? "border-green bg-green-tint" : "border-line bg-card hover:border-line-2"} ${disabled ? "cursor-default" : ""}`}>
            <input type="checkbox" className="accent-brand" disabled={disabled} checked={arr.includes(i)} onChange={(e) => onChange(e.target.checked ? [...arr, i].sort((a, b) => a - b) : arr.filter((x) => x !== i), true)} />
            <span className="min-w-0 flex-1">{o || <span className="text-faint">Option {i + 1}</span>}</span>
          </label>
        ))}
        <p className="pt-1 text-[11.5px] text-faint">Select every option that applies.</p>
      </div>
    );
  }
  if (q.kind === "fill_blank" || q.kind === "numeric") {
    const s = String(value ?? "");
    return <Input className="max-w-sm" disabled={disabled} value={s} inputMode={q.kind === "numeric" ? "decimal" : undefined} placeholder={q.format_hint ?? (q.kind === "numeric" ? "A number" : "Your answer")} onChange={(e) => onChange(e.target.value, formatOk(e.target.value))} />;
  }
  if (q.kind === "sequence") return <SequenceInput items={q.config.items ?? []} value={Array.isArray(value) ? (value as number[]) : []} disabled={disabled} onChange={(v) => onChange(v, true)} />;
  if (q.kind === "set") return <ListInput value={Array.isArray(value) ? (value as string[]) : []} max={q.max_entries} disabled={disabled} hint={q.format_hint} check={formatOk} onChange={(v) => onChange(v, true)} />;
  return <Textarea rows={8} disabled={disabled} value={String(value ?? "")} onChange={(e) => onChange(e.target.value, true)} placeholder={q.format_hint ?? "Write your answer"} />;
}

function safeRegex(src: string): RegExp {
  try { return new RegExp(src); } catch { return /.*/; }
}

export function SequenceInput({ items, value, disabled, onChange }: { items: string[]; value: number[]; disabled: boolean; onChange: (v: number[]) => void }) {
  const order = value.length === items.length && new Set(value).size === items.length ? value : items.map((_, i) => i);
  const move = (from: number, dir: -1 | 1) => { const to = from + dir; if (to < 0 || to >= order.length) return; const next = [...order]; [next[from], next[to]] = [next[to], next[from]]; onChange(next); };
  if (items.length === 0) return <p className="text-[12.5px] text-faint">No items yet.</p>;
  return (
    <ol className="space-y-1.5">
      {order.map((idx, pos) => (
        <li key={idx} className="flex items-center gap-2 rounded-box border border-line bg-card px-3 py-2 text-[13px]">
          <span className="w-5 font-semibold tabular-nums text-faint">{pos + 1}.</span>
          <span className="min-w-0 flex-1">{items[idx]}</span>
          <button type="button" disabled={disabled || pos === 0} onClick={() => move(pos, -1)} className="rounded p-1 text-muted-foreground hover:bg-page disabled:opacity-30" aria-label="Move up">↑</button>
          <button type="button" disabled={disabled || pos === order.length - 1} onClick={() => move(pos, 1)} className="rounded p-1 text-muted-foreground hover:bg-page disabled:opacity-30" aria-label="Move down">↓</button>
        </li>
      ))}
      <li className="pt-1 text-[11.5px] text-faint">Use the arrows to put the items in the right order.</li>
    </ol>
  );
}

export function ListInput({ value, max, disabled, hint, check, onChange }: { value: string[]; max: number; disabled: boolean; hint: string | null; check: (s: string) => boolean; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const add = () => {
    const s = draft.trim();
    if (!s) return;
    if (!check(s)) { setErr(`Expected: ${hint ?? "a different format"}`); return; }
    if (value.includes(s)) { setErr("Already added."); return; }
    if (value.length >= max) { setErr(`At most ${max} entries.`); return; }
    onChange([...value, s]); setDraft(""); setErr(null);
  };
  return (
    <div>
      <div className="flex max-w-md gap-2">
        <Input disabled={disabled} value={draft} placeholder={hint ?? "Add an entry, press Enter"} onChange={(e) => { setDraft(e.target.value); setErr(null); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <Button type="button" variant="outline" disabled={disabled || value.length >= max} onClick={add}>Add</Button>
      </div>
      {err && <p className="mt-1.5 flex items-center gap-1 text-[12px] font-semibold text-red"><Icon.Alert size={12} /> {err}</p>}
      {value.length > 0 && (
        <ul className="mt-2.5 flex flex-wrap gap-1.5">
          {value.map((v, i) => (
            <li key={i} className="flex items-center gap-1.5 rounded-box border border-line bg-card px-2 py-1 font-mono text-[12px]">
              {v}
              {!disabled && <button type="button" className="text-faint hover:text-red" aria-label={`Remove ${v}`} onClick={() => onChange(value.filter((_, j) => j !== i))}><Icon.X size={12} /></button>}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1.5 text-[11.5px] text-faint">{value.length} of {max} entries. Whether each is correct is revealed when the section closes.</p>
    </div>
  );
}
