"use client";

/** The grading queue: one question at a time, every participant's answer beneath it, J/K to move. */
import { useCallback, useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { Markdown } from "@/components/markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Kbd } from "@/components/ui/kbd";
import { PageBody, PageHeader } from "@/components/ui/page";
import { CardSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/client";

type Item = { participant_id: string; name: string; answer: unknown; explanation: string | null; manual_score: number | null; explain_score: number | null; comment: string | null; graded_by: string | null };
type Group = { question: { id: number; title: string; body_md: string; kind: string; grading: string; points: number; explain_points: number; model_answer: string | null }; items: Item[] };
type Data = { ungraded: number; total: number; groups: Group[] };

const leftIn = (x: Group) => x.items.filter((it) => (x.question.grading === "manual" && it.manual_score === null) || (x.question.explain_points > 0 && it.explain_score === null)).length;

export default function GradePage() {
  const [data, setData] = useState<Data | null>(null);
  const [hideNames, setHideNames] = useState(true);
  const [current, setCurrent] = useState(0);
  const load = useCallback(async () => setData(await api.get<Data>("/api/grade/queue")), []);
  useEffect(() => { void load(); }, [load]);
  const n = data?.groups.length ?? 0;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName?.match(/INPUT|TEXTAREA|SELECT/)) return;
      if (e.key === "j") setCurrent((c) => Math.min(n - 1, c + 1)); if (e.key === "k") setCurrent((c) => Math.max(0, c - 1));
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [n]);

  if (!data) return <PageBody width="wide"><CardSkeleton lines={8} /></PageBody>;
  const g = data.groups[current];
  const graded = data.total - data.ungraded;
  const pct = data.total ? Math.round((100 * graded) / data.total) : 0;

  return (
    <PageBody width="wide" className="animate-fade-in">
      <PageHeader
        title="Grading queue"
        description="Manual answers and explanations, grouped by question so each is marked consistently across everyone. Names are hidden by default."
        actions={<Checkbox label="Hide names" checked={hideNames} onChange={(e) => setHideNames(e.target.checked)} />}
      />
      <div className="mb-4 rounded-box border border-line bg-card px-4 py-3">
        <div className="flex items-center justify-between text-[13px]"><span className="font-semibold">{graded} of {data.total} graded</span><span className="text-muted">{data.ungraded} left</span></div>
        <div className="mt-2 h-1.5 w-full rounded bg-line"><div className="h-1.5 rounded bg-green transition-[width]" style={{ width: `${pct}%` }} /></div>
      </div>
      {data.groups.length === 0 || !g ? <EmptyState icon={<Icon.Check size={20} />} title="Nothing to grade" body="No manual answers or explanations have been submitted yet." /> : (
        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="rounded-box border border-line bg-card">
              <ol className="pane max-h-[60vh] overflow-auto p-2">{data.groups.map((x, i) => {
                const left = leftIn(x);
                return (
                  <li key={x.question.id}>
                    <button onClick={() => setCurrent(i)} className={`flex w-full items-center gap-2.5 rounded-box px-3 py-2 text-left text-[13px] ${i === current ? "bg-green-tint font-semibold" : "text-muted hover:bg-page hover:text-ink"}`}>
                      <span className={`h-2 w-2 shrink-0 rounded-full ${left ? "bg-amber" : "bg-green"}`} /><span className="truncate">{x.question.title}</span><span className="ml-auto text-[11.5px] text-faint">{left ? `${left} left` : "done"}</span>
                    </button>
                  </li>
                );
              })}</ol>
              <div className="border-t border-line px-3 py-2 text-[11.5px] text-faint"><Kbd>J</Kbd> next · <Kbd>K</Kbd> previous</div>
            </div>
          </aside>
          <div className="min-w-0 space-y-4">
            <section className="overflow-hidden rounded-box border border-line bg-card">
              <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-3.5">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">Question {current + 1} of {n}</div>
                  <h2 className="mt-0.5 text-[15px] font-semibold">{g.question.title}</h2>
                  <p className="mt-0.5 text-[12px] text-muted">{g.question.points} pts{g.question.explain_points ? ` · +${g.question.explain_points} for reasoning` : ""} · {g.items.length} answer{g.items.length === 1 ? "" : "s"} · {leftIn(g)} to grade</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant="ghost" disabled={current === 0} onClick={() => setCurrent(current - 1)} aria-label="Previous question"><Icon.ChevronLeft size={16} /></Button>
                  <Button size="sm" variant="ghost" disabled={current >= n - 1} onClick={() => setCurrent(current + 1)} aria-label="Next question"><Icon.ChevronRight size={16} /></Button>
                </div>
              </div>
              <div className="grid gap-4 p-5 lg:grid-cols-2">
                <Markdown>{g.question.body_md}</Markdown>
                {g.question.model_answer && (
                  <div className="rounded-box border border-line bg-page p-3 text-[13px]">
                    <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted"><Icon.Lock size={12} /> Model answer — never shown to participants</div>
                    <Markdown>{g.question.model_answer}</Markdown>
                  </div>
                )}
              </div>
            </section>
            {g.items.map((it, i) => <GradeRow key={it.participant_id} item={it} q={g.question} label={hideNames ? `Participant ${i + 1}` : it.name} onGraded={load} />)}
          </div>
        </div>
      )}
    </PageBody>
  );
}

function GradeRow({ item, q, label, onGraded }: { item: Item; q: Group["question"]; label: string; onGraded: () => void }) {
  const { toast } = useToast();
  const [manual, setManual] = useState(item.manual_score ?? "");
  const [explain, setExplain] = useState(item.explain_score ?? "");
  const [comment, setComment] = useState(item.comment ?? "");
  const [busy, setBusy] = useState(false);
  const done = (q.grading !== "manual" || item.manual_score !== null) && (q.explain_points === 0 || item.explain_score !== null);

  async function save() {
    setBusy(true);
    try {
      await api.post("/api/grade", { participant_id: item.participant_id, question_id: q.id, manual_score: q.grading === "manual" ? Number(manual) : undefined, explain_score: q.explain_points ? Number(explain) : undefined, comment });
      toast({ title: `Graded ${label}`, tone: "success", duration: 2000 }); onGraded();
    } catch (err) { toast({ title: "Not saved", description: errorMessage(err), tone: "error" }); } finally { setBusy(false); }
  }

  return (
    <section className={`overflow-hidden rounded-box border bg-card ${done ? "border-green/40" : "border-line"}`}>
      <div className="flex items-center gap-2 border-b border-line px-5 py-2.5">
        <span className="text-[13px] font-semibold">{label}</span>
        {done ? <Badge tone="green">graded</Badge> : <Badge tone="amber">to grade</Badge>}
      </div>
      <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-3 text-[13px]">
          {q.grading === "manual" && <div><div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Answer</div><pre className="whitespace-pre-wrap rounded-box border border-line bg-page p-3 font-mono text-[12px]">{renderAnswer(item.answer)}</pre></div>}
          {q.explain_points > 0 && <div><div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Reasoning</div><div className="whitespace-pre-wrap rounded-box border border-line bg-page p-3">{item.explanation || <span className="text-faint">— nothing written —</span>}</div></div>}
        </div>
        <div className="space-y-3">
          {q.grading === "manual" && <div><div className="mb-1 text-[12px] font-semibold text-muted">Answer score · 0–{q.points}</div><Input type="number" min={0} max={q.points} value={manual} onChange={(e) => setManual(e.target.value)} /></div>}
          {q.explain_points > 0 && <div><div className="mb-1 text-[12px] font-semibold text-muted">Reasoning score · 0–{q.explain_points}</div><Input type="number" min={0} max={q.explain_points} value={explain} onChange={(e) => setExplain(e.target.value)} /></div>}
          <div><div className="mb-1 text-[12px] font-semibold text-muted">Comment <span className="font-normal text-faint">(the participant sees this)</span></div><Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} /></div>
          <Button size="sm" onClick={save} loading={busy} icon={<Icon.Check size={14} />}>{done ? "Update grade" : "Save grade"}</Button>
        </div>
      </div>
    </section>
  );
}

function renderAnswer(a: unknown): string { if (a === null || a === undefined) return "— no answer —"; if (Array.isArray(a)) return a.join("\n"); return String(a); }
