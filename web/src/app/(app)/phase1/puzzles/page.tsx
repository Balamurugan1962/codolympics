"use client";

/** Section A: a rail of questions with progress, one question at a time, a sticky bar to move, save and finish. */
import { useCallback, useEffect, useRef, useState } from "react";

import { useContest } from "@/components/contest-provider";
import { Countdown } from "@/components/countdown";
import { Icon } from "@/components/icons";
import { PuzzleCard, defaultAnswer, type PuzzleView, type SaveStatus } from "@/components/phase1/puzzle-card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Kbd } from "@/components/ui/kbd";
import { PageBody } from "@/components/ui/page";
import { CardSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/client";

type Data = { open: boolean; phase_ends_at: string | null; questions: PuzzleView[]; answers: Record<number, { answer: unknown; explanation: string | null }> };

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

  if (error) return <PageBody><EmptyState icon={<Icon.Puzzle size={20} />} title="Section A is not open" body={error} /></PageBody>;
  if (!data) return <PageBody><div className="grid gap-4 lg:grid-cols-[260px_1fr]"><CardSkeleton lines={8} /><CardSkeleton lines={12} /></div></PageBody>;
  const finished = Boolean(state?.me?.p1_puzzles_finished);
  const locked = !data.open || finished;
  const q = data.questions[current];
  const answered = new Set(Object.keys(data.answers).map(Number));
  const pct = total ? Math.round((100 * answered.size) / total) : 0;

  async function finish() {
    try { await api.post("/api/phase1/finish", { section: "puzzles" }); setFinishOpen(false); await refresh(); await load(); toast({ title: "Section A finished", description: "Your submission time is recorded.", tone: "success" }); }
    catch (err) { toast({ title: "Could not finish", description: errorMessage(err), tone: "error" }); }
  }

  return (
    <PageBody width="wide" className="animate-fade-in pb-24">
      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-box border border-line bg-card">
            <div className="border-b border-line px-4 py-3">
              <div className="flex items-center justify-between text-[13px]"><span className="font-semibold">Questions</span><span className="text-muted">{answered.size} of {total} answered</span></div>
              <div className="mt-2 h-1.5 w-full rounded bg-line"><div className="h-1.5 rounded bg-green transition-[width]" style={{ width: `${pct}%` }} /></div>
            </div>
            <ol className="pane max-h-[50vh] overflow-auto p-2 lg:max-h-[calc(100vh-15rem)]">
              {data.questions.map((x, i) => (
                <li key={x.id}>
                  <button onClick={() => setCurrent(i)} aria-current={i === current ? "true" : undefined}
                    className={`flex w-full items-center gap-2.5 rounded-box px-3 py-2 text-left text-[13px] ${i === current ? "bg-green-tint font-semibold text-ink" : "text-muted hover:bg-page hover:text-ink"}`}>
                    <span className={`h-2 w-2 shrink-0 rounded-full ${answered.has(x.id) ? "bg-green" : "border border-line-2"}`} aria-label={answered.has(x.id) ? "answered" : "unanswered"} />
                    <span className="truncate">{i + 1}. {x.title}</span>
                    <span className="ml-auto text-[11.5px] tabular-nums text-faint">{x.points}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </aside>

        <div className="min-w-0 space-y-3">
          {!data.open && !finished && <Alert tone="warning" title="Section A is closed">Your answers are recorded as they were when it closed.</Alert>}
          {finished && <Alert tone="success" title="You finished Section A">Your answers are locked and your submission time is recorded.</Alert>}
          {q ? <LiveQuestion key={q.id} index={current} total={total} q={q} saved={data.answers[q.id]} locked={locked} onSaved={load} />
            : <EmptyState icon={<Icon.Puzzle size={20} />} title="No puzzles published" body="The organisers have not published any questions yet." />}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
          <Button variant="secondary" size="sm" icon={<Icon.ChevronLeft size={14} />} onClick={() => go(-1)} disabled={current === 0}>Previous</Button>
          <Button variant="secondary" size="sm" onClick={() => go(1)} disabled={current >= total - 1}>Next <Icon.ChevronRight size={14} /></Button>
          <span className="hidden text-[11.5px] text-faint sm:inline"><Kbd>←</Kbd> <Kbd>→</Kbd> to move</span>
          <span className="ml-auto flex items-center gap-1.5 text-[13px] text-muted"><Icon.Clock size={14} /><Countdown until={data.phase_ends_at} className="font-semibold text-ink" /></span>
          {finished ? <Badge tone="green">Finished</Badge> : <Button size="sm" icon={<Icon.Flag size={14} />} disabled={locked} onClick={() => setFinishOpen(true)}>Submit &amp; finish</Button>}
        </div>
      </div>

      <Dialog open={finishOpen} onClose={() => setFinishOpen(false)} title="Finish Section A?">
        <p className="text-[13px]">You have answered <strong>{answered.size}</strong> of <strong>{total}</strong>. After finishing you cannot change anything. Your submission time — the tiebreak — is recorded now.</p>
        {answered.size < total && <div className="mt-3"><Alert tone="warning">{total - answered.size} question{total - answered.size === 1 ? "" : "s"} unanswered.</Alert></div>}
        <div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={() => setFinishOpen(false)}>Keep working</Button><Button onClick={finish} icon={<Icon.Flag size={14} />}>Finish</Button></div>
      </Dialog>
    </PageBody>
  );
}

/** One question wired to autosave. */
function LiveQuestion({ index, total, q, saved, locked, onSaved }: { index: number; total: number; q: PuzzleView; saved?: { answer: unknown; explanation: string | null }; locked: boolean; onSaved: () => void }) {
  const [answer, setAnswer] = useState<unknown>(saved?.answer ?? defaultAnswer(q));
  const [explanation, setExplanation] = useState(saved?.explanation ?? "");
  const [status, setStatus] = useState<SaveStatus>("idle");
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

  return (
    <PuzzleCard
      q={q} index={index} total={total} answer={answer} explanation={explanation} status={status} locked={locked} formatError={formatError}
      onAnswer={(v, ok) => { setAnswer(v); if (ok) { setFormatError(null); schedule({ answer: v }); } else setFormatError(`Expected: ${q.format_hint ?? "a different format"}`); }}
      onExplanation={(v) => { setExplanation(v); schedule({ explanation: v }); }}
    />
  );
}
