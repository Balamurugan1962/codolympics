"use client";

/** Section B: read the flawed solution, submit a test input that breaks it (US-P3-03). */
import { useCallback, useEffect, useState } from "react";

import { useContest } from "@/components/contest-provider";
import { Countdown } from "@/components/countdown";
import { Markdown } from "@/components/markdown";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { api, errorMessage } from "@/lib/client";

type HQ = { id: number; title: string; statement_md: string; constraints_md: string; given_source: string; given_language: string; hack_points: number; fail_penalty: number };
type Attempt = { id: number; question_id: number; state: string; valid_input: boolean | null; invalid_reason: string | null; hacked: boolean | null; points_awarded: number; created_at: string };
type Data = { open: boolean; phase_ends_at: string | null; questions: HQ[]; attempts: Attempt[] };

export default function HackingPage() {
  const { state, lastEvent, refresh } = useContest();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState(0);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => { try { setData(await api.get<Data>("/api/phase1/hacking")); } catch (err) { setError(errorMessage(err)); } }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (lastEvent?.name === "hack") void load(); }, [lastEvent, load]);

  if (error) return <Alert tone="info" title="Section B">{error}</Alert>;
  if (!data) return null;
  const finished = state?.me?.p1_hacking_finished;
  const locked = !data.open || finished;
  const q = data.questions[current];
  const attempts = q ? data.attempts.filter((a) => a.question_id === q.id) : [];
  const inFlight = data.attempts.some((a) => a.state !== "done");
  const alreadyHacked = attempts.some((a) => a.hacked);

  async function submit() {
    if (!q) return;
    setBusy(true); setError(null);
    try { await api.post(`/api/phase1/hacking/${q.id}/attempts`, { input }); await load(); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-4">
      <Card>
        <CardHeader title="Solutions" action={<Countdown until={data.phase_ends_at} className="text-sm font-semibold" />} />
        <CardBody className="space-y-1 p-2">
          {data.questions.map((x, i) => {
            const hacked = data.attempts.some((a) => a.question_id === x.id && a.hacked);
            return (
              <button key={x.id} onClick={() => { setCurrent(i); setInput(""); }}
                className={`flex w-full items-center justify-between rounded-box px-3 py-2 text-left text-sm ${i === current ? "bg-green-tint font-semibold" : "hover:bg-page"}`}>
                <span>{i + 1}. {x.title}</span>{hacked && <Badge tone="green">hacked</Badge>}
              </button>
            );
          })}
          <div className="border-t border-line pt-3 text-center">
            {finished ? <Badge tone="green">Finished</Badge> : <Button size="sm" variant="secondary" className="w-full" disabled={locked} onClick={async () => { await api.post("/api/phase1/finish", { section: "hacking" }); await refresh(); }}>Finish section</Button>}
          </div>
        </CardBody>
      </Card>

      {q && (
        <div className="lg:col-span-3 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title={<span className="flex items-center gap-2">{q.title} <Badge tone="grey">{q.hack_points} pts per solution</Badge>{q.fail_penalty > 0 && <Badge tone="amber">−{q.fail_penalty} per failed attempt</Badge>}</span>} />
            <CardBody className="space-y-3">
              <Markdown>{q.statement_md}</Markdown>
              {q.constraints_md && <><h3 className="text-sm font-semibold">Constraints</h3><Markdown>{q.constraints_md}</Markdown></>}
            </CardBody>
          </Card>
          <div className="space-y-4">
            <Card>
              <CardHeader title={`The given solution (${q.given_language}) — it is wrong somewhere`} />
              <pre className="max-h-80 overflow-auto bg-navy p-3 text-xs text-white">{q.given_source}</pre>
            </Card>
            <Card>
              <CardHeader title="Your test input" />
              <CardBody className="space-y-3">
                {!data.open && !finished && <Alert tone="warning">Section B is closed.</Alert>}
                {alreadyHacked && <Alert tone="success">You have already broken this solution. Further hacks on it score nothing.</Alert>}
                <Textarea rows={6} className="font-mono" disabled={Boolean(locked)} value={input} onChange={(e) => setInput(e.target.value)} placeholder="An input that obeys the constraints and makes the solution fail" />
                {error && <Alert tone="error">{error}</Alert>}
                <div className="flex items-center gap-3">
                  <Button onClick={submit} disabled={Boolean(locked) || busy || inFlight || !input.trim()}>{inFlight ? "Judging…" : "Submit hack"}</Button>
                  <span className="text-xs text-faint">You will be told whether the input was valid and whether it broke the solution — nothing more.</span>
                </div>
                {attempts.length > 0 && (
                  <ul className="divide-y divide-line text-sm">
                    {attempts.map((a) => (
                      <li key={a.id} className="flex items-center gap-2 py-2">
                        {a.state !== "done" ? <Badge tone="grey">judging</Badge> : a.valid_input === false ? <Badge tone="amber">invalid input</Badge> : a.hacked === true ? <Badge tone="green">hacked</Badge> : a.hacked === false ? <Badge tone="red">did not break it</Badge> : <Badge tone="grey">problem error — not counted</Badge>}
                        <span className="text-muted">{a.valid_input === false ? a.invalid_reason : ""}</span>
                        <span className="ml-auto text-faint">{a.points_awarded ? `${a.points_awarded > 0 ? "+" : ""}${a.points_awarded}` : ""} {new Date(a.created_at).toLocaleTimeString()}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
