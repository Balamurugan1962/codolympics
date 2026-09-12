"use client";

/** Section B: read the flawed code, craft an input that breaks it. */
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";

import { useContest } from "@/components/contest-provider";
import { Countdown } from "@/components/countdown";
import { Icon } from "@/components/icons";
import { Markdown } from "@/components/markdown";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Textarea } from "@/components/ui/input";
import { CardSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/client";

const CodeEditor = dynamic(() => import("@/components/editor").then((m) => m.CodeEditor), { ssr: false, loading: () => <div className="h-72 bg-[#1e1e1e]" /> });

type HQ = { id: number; title: string; statement_md: string; constraints_md: string; given_source: string; given_language: string; hack_points: number; fail_penalty: number };
type Attempt = { id: number; question_id: number; state: string; valid_input: boolean | null; invalid_reason: string | null; hacked: boolean | null; points_awarded: number; created_at: string };
type Data = { open: boolean; phase_ends_at: string | null; questions: HQ[]; attempts: Attempt[] };

export default function HackingPage() {
  const { state, lastEvent, refresh } = useContest();
  const { toast } = useToast();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState(0);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => { try { setData(await api.get<Data>("/api/phase1/hacking")); } catch (err) { setError(errorMessage(err)); } }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (lastEvent?.name === "hack") void load(); }, [lastEvent, load]);

  if (error) return <EmptyState icon={<Icon.Bug size={22} />} title="Section B is not open" body={error} />;
  if (!data) return <div className="grid gap-4 lg:grid-cols-[260px_1fr]"><CardSkeleton lines={6} /><CardSkeleton lines={12} /></div>;
  const finished = state?.me?.p1_hacking_finished;
  const locked = !data.open || finished;
  const q = data.questions[current];
  const attempts = q ? data.attempts.filter((a) => a.question_id === q.id) : [];
  const inFlight = data.attempts.some((a) => a.state !== "done");
  const hackedIds = new Set(data.attempts.filter((a) => a.hacked).map((a) => a.question_id));

  async function submit() {
    if (!q) return;
    setBusy(true);
    try { await api.post(`/api/phase1/hacking/${q.id}/attempts`, { input }); toast({ title: "Attempt submitted", description: "Judging — the result appears below.", tone: "info", duration: 2500 }); await load(); }
    catch (err) { toast({ title: "Not submitted", description: errorMessage(err), tone: "error" }); }
    finally { setBusy(false); }
  }

  return (
    <div className="animate-fade-in pb-16">
      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <Card>
            <div className="border-b border-line px-4 py-3 text-sm"><span className="font-semibold">Solutions</span><span className="ml-2 text-muted">{hackedIds.size}/{data.questions.length} hacked</span></div>
            <ol className="p-2">{data.questions.map((x, i) => (
              <li key={x.id}><button onClick={() => { setCurrent(i); setInput(""); }} aria-current={i === current ? "true" : undefined}
                className={`flex w-full items-center gap-2 rounded-box px-3 py-2 text-left text-sm ${i === current ? "bg-green-tint font-semibold text-ink" : "text-muted hover:bg-page hover:text-ink"}`}>
                <span className={`h-2 w-2 shrink-0 rounded-full ${hackedIds.has(x.id) ? "bg-green" : "border border-line-2"}`} /><span className="truncate">{i + 1}. {x.title}</span><span className="ml-auto text-xs text-faint">{x.hack_points}</span></button></li>
            ))}</ol>
            <div className="border-t border-line p-3 text-center">{finished ? <Badge tone="green">Finished</Badge> : <Button size="sm" variant="secondary" className="w-full" icon={<Icon.Flag />} disabled={locked} onClick={async () => { await api.post("/api/phase1/finish", { section: "hacking" }); await refresh(); toast({ title: "Section B finished", tone: "success" }); }}>Finish section</Button>}</div>
          </Card>
        </aside>

        {q ? (
          <div className="space-y-4">
            {!data.open && !finished && <Alert tone="warning" title="Section B is closed" />}
            <Card>
              <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
                <div><div className="text-[11px] font-semibold uppercase tracking-wide text-faint">Solution {current + 1} of {data.questions.length} · <Countdown until={data.phase_ends_at} /> left</div><h2 className="mt-0.5 text-lg font-semibold">{q.title}</h2></div>
                <div className="flex gap-2"><Badge tone="navy">{q.hack_points} pts</Badge>{q.fail_penalty > 0 && <Badge tone="amber">−{q.fail_penalty} per miss</Badge>}{hackedIds.has(q.id) && <Badge tone="green">hacked</Badge>}</div>
              </div>
              <CardBody className="grid gap-5 px-5 lg:grid-cols-2">
                <div className="space-y-4">
                  <Markdown>{q.statement_md}</Markdown>
                  {q.constraints_md && <div className="rounded-box border border-line bg-page p-3 text-sm"><div className="mb-1 text-xs font-semibold uppercase text-muted">Constraints</div><Markdown>{q.constraints_md}</Markdown></div>}
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted"><span>The given solution · {q.given_language}</span><span className="normal-case font-normal text-faint">read only — it is wrong somewhere</span></div>
                  <div className="overflow-hidden rounded-box border border-line"><CodeEditor value={q.given_source} language={q.given_language} readOnly height="320px" /></div>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Your test input" description="Must obey the constraints. You are told whether it was valid and whether it broke the solution — nothing more." />
              <CardBody className="space-y-3">
                {hackedIds.has(q.id) && <Alert tone="success">You have already broken this solution. Further hacks on it score nothing — move on.</Alert>}
                <Textarea rows={5} className="font-mono" disabled={Boolean(locked)} value={input} onChange={(e) => setInput(e.target.value)} placeholder={"e.g.\n-2 3"} aria-label="Test input" />
                <div className="flex items-center gap-3">
                  <Button icon={<Icon.Bug />} onClick={submit} loading={busy || inFlight} disabled={Boolean(locked) || !input.trim()}>{inFlight ? "Judging…" : "Submit hack"}</Button>
                  {attempts.length > 0 && <span className="text-xs text-faint">{attempts.length} attempt{attempts.length === 1 ? "" : "s"} on this solution</span>}
                </div>
                {attempts.length > 0 && (
                  <ol className="divide-y divide-line rounded-box border border-line">{attempts.map((a) => (
                    <li key={a.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                      {a.state !== "done" ? <Badge tone="blue">judging</Badge> : a.valid_input === false ? <Badge tone="amber">invalid input</Badge> : a.hacked === true ? <Badge tone="green">hacked</Badge> : a.hacked === false ? <Badge tone="red">did not break it</Badge> : <Badge tone="grey">problem error · not counted</Badge>}
                      <span className="min-w-0 flex-1 truncate text-muted">{a.valid_input === false ? a.invalid_reason : ""}</span>
                      <span className={`tabular-nums text-xs ${a.points_awarded > 0 ? "font-semibold text-green-dark" : a.points_awarded < 0 ? "text-red" : "text-faint"}`}>{a.points_awarded ? `${a.points_awarded > 0 ? "+" : ""}${a.points_awarded}` : ""}</span>
                      <span className="text-xs text-faint">{new Date(a.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </li>
                  ))}</ol>
                )}
              </CardBody>
            </Card>
          </div>
        ) : <EmptyState icon={<Icon.Bug size={22} />} title="No hacking questions published" />}
      </div>
    </div>
  );
}
