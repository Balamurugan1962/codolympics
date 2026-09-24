"use client";

/**
 * Phase 1 on one screen and one clock: the puzzles and the hacking questions in
 * a single list on the left, whichever is picked on the right. Somebody who
 * finishes the puzzles early moves straight on to hacking, and one finish
 * records the time for both.
 */
import { useCallback, useEffect, useState } from "react";

import { useContest, useEngineEvent } from "@/components/contest-provider";
import { Countdown } from "@/components/countdown";
import { Icon } from "@/components/icons";
import type { PuzzleView } from "@/components/phase1/puzzle-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Kbd } from "@/components/ui/kbd";
import { Modal } from "@/components/ui/modal";
import { PageBody } from "@/components/ui/page";
import { ContestSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/client";

import { LiveQuestion } from "./section-a";
import { HackPane, type HackData } from "./section-b";

type PuzzleData = { open: boolean; phase_ends_at: string | null; questions: PuzzleView[]; answers: Record<number, { answer: unknown; explanation: string | null }> };
type Pick = { kind: "puzzle" | "hack"; id: number };

const key = (p: Pick) => `${p.kind}:${p.id}`;

export function Phase1() {
  const { state, refresh } = useContest();
  const { toast } = useToast();
  const [puzzles, setPuzzles] = useState<PuzzleData | null>(null);
  const [hacks, setHacks] = useState<HackData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);

  const loadPuzzles = useCallback(async () => { try { setPuzzles(await api.get<PuzzleData>("/api/phase1/puzzles")); } catch (err) { setError(errorMessage(err)); } }, []);
  const loadHacks = useCallback(async () => { try { setHacks(await api.get<HackData>("/api/phase1/hacking")); } catch { setHacks({ open: false, phase_ends_at: null, questions: [], attempts: [] }); } }, []);
  useEffect(() => { void loadPuzzles(); void loadHacks(); }, [loadPuzzles, loadHacks]);
  useEngineEvent("hack", loadHacks);
  // Organisers edit, publish and reorder while the section is on screen.
  useEngineEvent("hacking", loadHacks);

  const list: Pick[] = [
    ...(puzzles?.questions ?? []).map((q) => ({ kind: "puzzle" as const, id: q.id })),
    ...(hacks?.questions ?? []).map((q) => ({ kind: "hack" as const, id: q.id })),
  ];
  const at = Math.max(0, list.findIndex((p) => key(p) === picked));
  const move = useCallback((d: number) => { if (list.length) setPicked(key(list[Math.min(list.length - 1, Math.max(0, at + d))])); }, [list, at]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName?.match(/INPUT|TEXTAREA|SELECT/)) return;
      if (e.key === "ArrowRight") move(1);
      if (e.key === "ArrowLeft") move(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move]);

  if (error) return <PageBody><EmptyState icon={<Icon.Puzzle size={20} />} title="Phase 1 is not open" body={error} /></PageBody>;
  if (!puzzles || !hacks) return <ContestSkeleton rail={7} />;

  const finished = Boolean(state?.me?.p1_puzzles_finished || state?.me?.p1_hacking_finished);
  const open = puzzles.open;
  const locked = !open || finished;
  const answered = new Set(Object.keys(puzzles.answers).map(Number));
  const hackedIds = new Set(hacks.attempts.filter((a) => a.hacked).map((a) => a.question_id));
  const inFlight = hacks.attempts.some((a) => a.state !== "done");
  const done = answered.size + hackedIds.size;
  const total = puzzles.questions.length + hacks.questions.length;
  const pct = total ? Math.round((100 * done) / total) : 0;
  const current = list[at];
  const puzzle = current?.kind === "puzzle" ? puzzles.questions.find((q) => q.id === current.id) : undefined;
  const hack = current?.kind === "hack" ? hacks.questions.find((q) => q.id === current.id) : undefined;

  async function finish() {
    try {
      await api.post("/api/phase1/finish", {});
      setFinishOpen(false);
      await refresh();
      await Promise.all([loadPuzzles(), loadHacks()]);
      toast({ title: "Phase 1 finished", description: "Your submission time is recorded.", tone: "success" });
    } catch (err) { toast({ title: "Could not finish", description: errorMessage(err), tone: "error" }); }
  }

  const row = (p: Pick, label: string, points: number, isDone: boolean) => {
    const selected = list[at] && key(list[at]) === key(p);
    return (
      <li key={key(p)}>
        <button onClick={() => setPicked(key(p))} aria-current={selected ? "true" : undefined}
          className={`flex w-full items-center gap-2.5 rounded-box px-3 py-2 text-left text-[13px] ${selected ? "bg-brand-tint font-semibold text-ink" : "text-muted-foreground hover:bg-muted hover:text-ink"}`}>
          <span className={`h-2 w-2 shrink-0 rounded-full ${isDone ? "bg-green" : "border border-line-2"}`} aria-label={isDone ? "done" : "not done"} />
          <span className="truncate">{label}</span>
          <span className="ml-auto text-[11.5px] tabular-nums text-faint">{points}</span>
        </button>
      </li>
    );
  };

  return (
    <PageBody width="wide" className="animate-fade-in pb-20">
      {/* Finishing is irreversible and happens once, so it lives up here, away
          from the hand that moves between questions. */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">Phase 1 · Puzzles and hacking</div>
          <div className="mt-0.5 text-[13px] text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">{answered.size}</span> of <span className="tabular-nums">{puzzles.questions.length}</span> answered ·{" "}
            <span className="font-semibold text-foreground tabular-nums">{hackedIds.size}</span> of <span className="tabular-nums">{hacks.questions.length}</span> hacked
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <Icon.Clock size={14} />
            <Countdown until={puzzles.phase_ends_at} className="font-semibold text-ink" />
          </span>
          {finished ? <Badge variant="success">Finished</Badge> : (
            <Button size="sm" disabled={locked} onClick={() => setFinishOpen(true)}><Icon.Flag size={14} /> Submit &amp; finish</Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-box border border-line bg-card">
            <div className="border-b border-line px-4 py-3">
              <div className="flex items-center justify-between text-[13px]"><span className="font-semibold">Questions</span><span className="text-muted-foreground">{done} of {total} done</span></div>
              <div className="mt-2 h-1.5 w-full rounded bg-line"><div className="h-1.5 rounded bg-brand transition-[width]" style={{ width: `${pct}%` }} /></div>
            </div>
            <div className="pane max-h-[50vh] overflow-auto p-2 lg:max-h-[calc(100vh-15rem)]">
              {puzzles.questions.length > 0 && (
                <>
                  <div className="px-3 pt-1 pb-1 text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">Puzzles</div>
                  <ol>{puzzles.questions.map((x, i) => row({ kind: "puzzle", id: x.id }, `${i + 1}. ${x.title}`, x.points, answered.has(x.id)))}</ol>
                </>
              )}
              {hacks.questions.length > 0 && (
                <>
                  <div className="px-3 pt-3 pb-1 text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">Hacking</div>
                  <ol>{hacks.questions.map((x, i) => row({ kind: "hack", id: x.id }, `${i + 1}. ${x.title}`, x.hack_points, hackedIds.has(x.id)))}</ol>
                </>
              )}
            </div>
          </div>
        </aside>

        <div className="min-w-0 space-y-3">
          {!open && !finished && <Alert variant="warning"><AlertTitle>Phase 1 is closed</AlertTitle><AlertDescription>Your answers are recorded as they were when it closed.</AlertDescription></Alert>}
          {finished && <Alert variant="success"><AlertTitle>You finished Phase 1</AlertTitle><AlertDescription>Your answers and hacks are locked and your submission time is recorded.</AlertDescription></Alert>}
          {puzzle ? (
            <LiveQuestion key={key(current)} index={puzzles.questions.indexOf(puzzle)} total={puzzles.questions.length} q={puzzle} saved={puzzles.answers[puzzle.id]} locked={locked} onSaved={loadPuzzles} />
          ) : hack ? (
            <HackPane key={key(current)} q={hack} index={hacks.questions.indexOf(hack)} total={hacks.questions.length} data={hacks} locked={locked} finished={finished} onChanged={loadHacks} />
          ) : <EmptyState icon={<Icon.Puzzle size={20} />} title="Nothing published" body="The organisers have not published any questions yet." />}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
          <span className="text-[12.5px] text-muted-foreground tabular-nums">
            Question <span className="font-semibold text-foreground">{list.length ? at + 1 : 0}</span> of {list.length}
          </span>
          <span className="hidden text-[11.5px] text-faint sm:inline"><Kbd>←</Kbd> <Kbd>→</Kbd> to move</span>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => move(-1)} disabled={at === 0}><Icon.ChevronLeft size={14} /> Previous</Button>
            <Button variant="outline" size="sm" onClick={() => move(1)} disabled={at >= list.length - 1}>Next <Icon.ChevronRight size={14} /></Button>
          </div>
        </div>
      </div>

      <Modal open={finishOpen} onClose={() => setFinishOpen(false)} title="Finish Phase 1?">
        <p className="text-[13px]">You have answered <strong>{answered.size}</strong> of <strong>{puzzles.questions.length}</strong> puzzles and hacked <strong>{hackedIds.size}</strong> of <strong>{hacks.questions.length}</strong> solutions. After finishing you cannot change an answer or send another attempt. Your submission time, which is the tiebreak, is recorded now.</p>
        {answered.size < puzzles.questions.length && <div className="mt-3"><Alert variant="warning"><AlertDescription>{puzzles.questions.length - answered.size} puzzle{puzzles.questions.length - answered.size === 1 ? "" : "s"} unanswered.</AlertDescription></Alert></div>}
        {inFlight && <div className="mt-3"><Alert variant="warning"><AlertDescription>A hacking attempt is still being judged. It will still count.</AlertDescription></Alert></div>}
        {hackedIds.size < hacks.questions.length && !inFlight && <div className="mt-3"><Alert variant="warning"><AlertDescription>{hacks.questions.length - hackedIds.size} solution{hacks.questions.length - hackedIds.size === 1 ? "" : "s"} not hacked yet.</AlertDescription></Alert></div>}
        <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setFinishOpen(false)}>Keep working</Button><Button onClick={finish}><Icon.Flag size={14} /> Finish</Button></div>
      </Modal>
    </PageBody>
  );
}
