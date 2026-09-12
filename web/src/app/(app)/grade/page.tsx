"use client";

/** The grading queue (US-P5-02): manual answers and explanations, grouped by question. */
import { useCallback, useEffect, useState } from "react";

import { Markdown } from "@/components/markdown";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { api, errorMessage } from "@/lib/client";

type Item = { participant_id: string; name: string; answer: unknown; explanation: string | null; manual_score: number | null; explain_score: number | null; comment: string | null; graded_by: string | null };
type Group = { question: { id: number; title: string; body_md: string; kind: string; grading: string; points: number; explain_points: number; model_answer: string | null }; items: Item[] };

export default function GradePage() {
  const [data, setData] = useState<{ ungraded: number; groups: Group[] } | null>(null);
  const [hideNames, setHideNames] = useState(true);
  const [current, setCurrent] = useState(0);
  const load = useCallback(async () => setData(await api.get("/api/grade/queue")), []);
  useEffect(() => { void load(); }, [load]);
  if (!data) return null;
  const g = data.groups[current];

  return (
    <div className="grid gap-6 lg:grid-cols-4">
      <Card>
        <CardHeader title={<span>Queue <Badge tone={data.ungraded ? "amber" : "green"}>{data.ungraded} ungraded</Badge></span>} />
        <CardBody className="space-y-1 p-2">
          {data.groups.map((x, i) => {
            const left = x.items.filter((it) => (x.question.grading === "manual" && it.manual_score === null) || (x.question.explain_points > 0 && it.explain_score === null)).length;
            return <button key={x.question.id} onClick={() => setCurrent(i)} className={`flex w-full items-center justify-between rounded-box px-3 py-2 text-left text-sm ${i === current ? "bg-green-tint font-semibold" : "hover:bg-page"}`}><span>{x.question.title}</span><span className="text-xs text-faint">{left} left</span></button>;
          })}
          <label className="mt-3 flex items-center gap-2 border-t border-line px-3 pt-3 text-xs"><input type="checkbox" checked={hideNames} onChange={(e) => setHideNames(e.target.checked)} /> Hide participant names</label>
        </CardBody>
      </Card>
      <div className="lg:col-span-3 space-y-4">
        {!g ? <Alert tone="info">Nothing to grade.</Alert> : (
          <>
            <Card>
              <CardHeader title={`${g.question.title} — ${g.question.points} pts${g.question.explain_points ? ` + ${g.question.explain_points} reasoning` : ""}`} />
              <CardBody className="grid gap-4 lg:grid-cols-2">
                <Markdown>{g.question.body_md}</Markdown>
                {g.question.model_answer && <div className="rounded-box border border-line bg-page p-3 text-sm"><div className="mb-1 text-xs font-semibold uppercase text-muted">Model answer (never shown to participants)</div><Markdown>{g.question.model_answer}</Markdown></div>}
              </CardBody>
            </Card>
            {g.items.map((it, i) => <GradeRow key={it.participant_id} item={it} q={g.question} label={hideNames ? `Participant ${i + 1}` : it.name} onGraded={load} />)}
          </>
        )}
      </div>
    </div>
  );
}

function GradeRow({ item, q, label, onGraded }: { item: Item; q: Group["question"]; label: string; onGraded: () => void }) {
  const [manual, setManual] = useState(item.manual_score ?? "");
  const [explain, setExplain] = useState(item.explain_score ?? "");
  const [comment, setComment] = useState(item.comment ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const done = (q.grading !== "manual" || item.manual_score !== null) && (q.explain_points === 0 || item.explain_score !== null);

  async function save() {
    setBusy(true); setError(null);
    try {
      await api.post("/api/grade", { participant_id: item.participant_id, question_id: q.id, manual_score: q.grading === "manual" ? Number(manual) : undefined, explain_score: q.explain_points ? Number(explain) : undefined, comment });
      onGraded();
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }

  return (
    <Card className={done ? "border-green/40" : ""}>
      <CardHeader title={<span className="flex items-center gap-2">{label} {done && <Badge tone="green">graded</Badge>}</span>} />
      <CardBody className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2 text-sm">
          {q.grading === "manual" && <div><div className="text-xs font-semibold uppercase text-muted">Answer</div><pre className="whitespace-pre-wrap rounded-box border border-line bg-page p-2 font-mono text-xs">{renderAnswer(item.answer)}</pre></div>}
          {q.explain_points > 0 && <div><div className="text-xs font-semibold uppercase text-muted">Reasoning</div><div className="whitespace-pre-wrap rounded-box border border-line bg-page p-2">{item.explanation || <span className="text-faint">— nothing written —</span>}</div></div>}
        </div>
        <div className="space-y-3">
          {q.grading === "manual" && <div><div className="mb-1 text-xs font-semibold text-muted">Answer score (0–{q.points})</div><Input type="number" min={0} max={q.points} value={manual} onChange={(e) => setManual(e.target.value)} /></div>}
          {q.explain_points > 0 && <div><div className="mb-1 text-xs font-semibold text-muted">Reasoning score (0–{q.explain_points})</div><Input type="number" min={0} max={q.explain_points} value={explain} onChange={(e) => setExplain(e.target.value)} /></div>}
          <div><div className="mb-1 text-xs font-semibold text-muted">Comment (optional, shown to the participant)</div><Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} /></div>
          {error && <Alert tone="error">{error}</Alert>}
          <Button size="sm" onClick={save} disabled={busy}>Save grade</Button>
        </div>
      </CardBody>
    </Card>
  );
}

function renderAnswer(a: unknown): string {
  if (a === null || a === undefined) return "— no answer —";
  if (Array.isArray(a)) return a.join("\n");
  return String(a);
}
