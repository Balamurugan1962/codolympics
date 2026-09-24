"use client";

/**
 * One hacking question: read the flawed code, craft an input that breaks it.
 *
 * The code comes in several languages. Each question opens in the language the
 * participant prefers (asked at registration); changing it from the dropdown
 * makes that the preference from then on. Phase 1 puts it beside the puzzles.
 */
import { useState } from "react";

import { useContest } from "@/components/contest-provider";
import { Icon } from "@/components/icons";
import { HackQuestionView, type HackView } from "@/components/phase1/hack-view";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/page";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/client";

export type Attempt = { id: number; question_id: number; solution_id: number | null; state: string; valid_input: boolean | null; invalid_reason: string | null; hacked: boolean | null; points_awarded: number; created_at: string };
export type HackData = { open: boolean; phase_ends_at: string | null; questions: HackView[]; attempts: Attempt[] };

export function HackPane({ q, index, total, data, locked, finished, onChanged }: { q: HackView; index: number; total: number; data: HackData; locked: boolean; finished: boolean; onChanged: () => Promise<void> }) {
  const { state, refresh } = useContest();
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const preferred = state?.me?.preferred_language ?? null;
  const solution = q.solutions.find((x) => x.language === preferred) ?? q.solutions[0];
  const attempts = data.attempts.filter((a) => a.question_id === q.id);
  const inFlight = data.attempts.some((a) => a.state !== "done");
  const hacked = data.attempts.some((a) => a.hacked && a.question_id === q.id);

  async function chooseLanguage(id: number) {
    const language = q.solutions.find((x) => x.id === id)?.language;
    if (!language) return;
    try { await api.put("/api/me/language", { language }); await refresh(); }
    catch (err) { toast({ title: "Language not changed", description: errorMessage(err), tone: "error" }); }
  }

  async function submit() {
    if (!solution) return;
    setBusy(true);
    try { await api.post(`/api/phase1/hacking/${q.id}/attempts`, { input, solution_id: solution.id }); toast({ title: "Attempt submitted", description: "Judging. The result appears below.", tone: "info", duration: 2500 }); await onChanged(); }
    catch (err) { toast({ title: "Not submitted", description: errorMessage(err), tone: "error" }); }
    finally { setBusy(false); }
  }

  return (
    <div className="min-w-0 space-y-4">
      {!data.open && !finished && (
        <Alert variant="warning">
          <Icon.Lock />
          <AlertTitle>Phase 1 is closed</AlertTitle>
        </Alert>
      )}
      <HackQuestionView q={q} index={index} total={total} hacked={hacked} solutionId={solution?.id} onSelectSolution={chooseLanguage} />
      <Section title="Your test input" description="Must obey the constraints. You are told whether it was valid and whether it broke the solution, nothing more.">
        <div className="space-y-3">
          {hacked && <Alert variant="success"><AlertDescription>You have already broken this solution. Further hacks on it score nothing. Move on.</AlertDescription></Alert>}
          <Textarea rows={5} className="font-mono" disabled={locked} value={input} onChange={(e) => setInput(e.target.value)} placeholder={"e.g.\n-2 3"} aria-label="Test input" />
          <div className="flex items-center gap-3">
            <Button onClick={submit} loading={busy || inFlight} disabled={locked || !input.trim() || !solution}><Icon.Bug size={14} /> {inFlight ? "Judging…" : `Submit hack against the ${solution?.language ?? ""} code`}</Button>
            {attempts.length > 0 && <span className="text-[12px] text-faint">{attempts.length} attempt{attempts.length === 1 ? "" : "s"} on this solution</span>}
          </div>
          {attempts.length > 0 && (
            <ol className="divide-y divide-line rounded-box border border-line">{attempts.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-3 py-2 text-[13px]">
                {a.state !== "done" ? <Badge variant="info">judging</Badge> : a.valid_input === false ? <Badge variant="warning">invalid input</Badge> : a.hacked === true ? <Badge variant="success">hacked</Badge> : a.hacked === false ? <Badge variant="destructive">did not break it</Badge> : <Badge variant="neutral">problem error · not counted</Badge>}
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{a.valid_input === false ? a.invalid_reason : ""}</span>
                <span className={`text-[12px] tabular-nums ${a.points_awarded > 0 ? "font-semibold text-green-dark" : a.points_awarded < 0 ? "text-red" : "text-faint"}`}>{a.points_awarded ? `${a.points_awarded > 0 ? "+" : ""}${a.points_awarded}` : ""}</span>
                <span className="text-[11.5px] text-faint">{new Date(a.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              </li>
            ))}</ol>
          )}
        </div>
      </Section>
    </div>
  );
}
