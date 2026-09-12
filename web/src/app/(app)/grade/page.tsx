"use client";

/** The grading queue: one question at a time, every participant's answer beneath it, J/K to move. */
import { useCallback, useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { Markdown } from "@/components/markdown";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Textarea } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { PageHeader } from "@/components/ui/page-header";
import { CardSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/client";

type Item = { participant_id: string; name: string; answer: unknown; explanation: string | null; manual_score: number | null; explain_score: number | null; comment: string | null; graded_by: string | null };
type Group = { question: { id: number; title: string; body_md: string; kind: string; grading: string; points: number; explain_points: number; model_answer: string | null }; items: Item[] };
type Data = { ungraded: number; total: number; groups: Group[] };

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

  if (!data) return <CardSkeleton lines={8} />;
  const g = data.groups[current];
  const graded = data.total - data.ungraded;
  const pct = data.total ? Math.round((100 * graded) / data.total) : 0;

  return (
    <div className="animate-fade-in">
      <PageHeader title="Grading queue" description="Manual answers and explanations, grouped by question so each is marked consistently across everyone."
        actions={<label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" className="accent-green" checked={hideNames} onChange={(e) => setHideNames(e.target.checked)} /> Hide names</label>} />
      <div className="mb-4 rounded-box border border-line bg-card px-4 py-3">
        <div className="flex items-center justify-between text-sm"><span className="font-semibold">{graded} of {data.total} graded</span><span className="text-muted">{data.ungraded} left</span></div>
        <div className="mt-2 h-2 w-full rounded bg-line"><div className="h-2 rounded bg-green transition-[width]" style={{ width: `${pct}%` }} /></div>
      </div>
      {data.groups.length === 0 ? <EmptyState icon={<Icon.Check size={22} />} title="Nothing to grade" body="No manual answers or explanations have been submitted yet." /> : (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <Card>
              <ol className="p-2">{data.groups.map((x, i) => {
                const left = x.items.filter((it) => (x.question.grading === "manual" && it.manual_score === null) || (x.question.explain_points > 0 && it.explain_score === null)).length;
                return <li key={x.question.id}><button onClick={() => setCurrent(i)} className={`flex w-full items-center gap-2 rounded-box px-3 py-2 text-left text-sm ${i === current ? "bg-green-tint font-semibold" : "text-muted hover:bg-page hover:text-ink"}`}><span className={`h-2 w-2 rounded-full ${left ? "bg-amber" : "bg-green"}`} /><span className="truncate">{x.question.title}</span><span className="ml-auto text-xs text-faint">{left ? `${left} left` : "done"}</span></button></li>;
              })}</ol>
              <div className="border-t border-line px-3 py-2 text-xs text-faint"><Kbd>J</Kbd> next · <Kbd>K</Kbd> previous</div>
            </Card>
          </aside>
          <div className="space-y-4">
            <Card>
              <CardHeader title={g.question.title} description={`${g.question.points} pts${g.question.explain_points ? ` · +${g.question.explain_points} for reasoning` : ""} · ${g.items.length} answers`}
                action={<div className="flex gap-1"><Button size="sm" variant="ghost" icon={<Icon.ChevronLeft />} disabled={current === 0} onClick={() => setCurrent(current - 1)} aria-label="Previous question" /><Button size="sm" variant="ghost" disabled={current >= n - 1} onClick={() => setCurrent(current + 1)} aria-label="Next question"><Icon.ChevronRight /></Button></div>} />
              <CardBody className="grid gap-4 lg:grid-cols-2">
                <Markdown>{g.question.body_md}</Markdown>
                {g.question.model_answer && <div className="rounded-box border border-line bg-page p-3 text-sm"><div className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase text-muted"><Icon.Lock size={12} /> Model answer — never shown to participants</div><Markdown>{g.question.model_answer}</Markdown></div>}
              </CardBody>
            </Card>
            {g.items.map((it, i) => <GradeRow key={it.participant_id} item={it} q={g.question} label={hideNames ? `Participant ${i + 1}` : it.name} onGraded={load} />)}
          </div>
        </div>
      )}
    </div>
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
    <Card className={done ? "border-green/40" : ""}>
      <CardHeader title={<span className="flex items-center gap-2">{label} {done ? <Badge tone="green">graded</Badge> : <Badge tone="amber">to grade</Badge>}</span>} />
      <CardBody className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="space-y-3 text-sm">
          {q.grading === "manual" && <div><div className="mb-1 text-xs font-semibold uppercase text-muted">Answer</div><pre className="whitespace-pre-wrap rounded-box border border-line bg-page p-3 font-mono text-xs">{renderAnswer(item.answer)}</pre></div>}
          {q.explain_points > 0 && <div><div className="mb-1 text-xs font-semibold uppercase text-muted">Reasoning</div><div className="whitespace-pre-wrap rounded-box border border-line bg-page p-3">{item.explanation || <span className="text-faint">— nothing written —</span>}</div></div>}
        </div>
        <div className="space-y-3">
          {q.grading === "manual" && <div><div className="mb-1 text-xs font-semibold text-muted">Answer score · 0–{q.points}</div><Input type="number" min={0} max={q.points} value={manual} onChange={(e) => setManual(e.target.value)} /></div>}
          {q.explain_points > 0 && <div><div className="mb-1 text-xs font-semibold text-muted">Reasoning score · 0–{q.explain_points}</div><Input type="number" min={0} max={q.explain_points} value={explain} onChange={(e) => setExplain(e.target.value)} /></div>}
          <div><div className="mb-1 text-xs font-semibold text-muted">Comment <span className="font-normal text-faint">(the participant sees this)</span></div><Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} /></div>
          <Button size="sm" onClick={save} loading={busy} icon={<Icon.Check />}>{done ? "Update grade" : "Save grade"}</Button>
        </div>
      </CardBody>
    </Card>
  );
}

function renderAnswer(a: unknown): string { if (a === null || a === undefined) return "— no answer —"; if (Array.isArray(a)) return a.join("\n"); return String(a); }
