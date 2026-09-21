"use client";

/**
 * Section B: read the flawed code, craft an input that breaks it.
 *
 * The code comes in several languages. Each question opens in the language the
 * participant prefers (asked at registration); changing it from the dropdown
 * makes that the preference from then on. The section is re-read whenever an
 * organiser changes it, so what is on screen is always what is published.
 */
import { useCallback, useEffect, useState } from "react";

import { useContest, useEngineEvent } from "@/components/contest-provider";
import { Countdown } from "@/components/countdown";
import { Icon } from "@/components/icons";
import { HackQuestionView, type HackView } from "@/components/phase1/hack-view";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { PageBody, Section } from "@/components/ui/page";
import { ContestSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/client";

type Attempt = { id: number; question_id: number; solution_id: number | null; state: string; valid_input: boolean | null; invalid_reason: string | null; hacked: boolean | null; points_awarded: number; created_at: string };
type Data = { open: boolean; phase_ends_at: string | null; questions: HackView[]; attempts: Attempt[] };

export function SectionB() {
  const { state, refresh } = useContest();
  const { toast } = useToast();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);

  const load = useCallback(async () => { try { setData(await api.get<Data>("/api/phase1/hacking")); } catch (err) { setError(errorMessage(err)); } }, []);
  useEffect(() => { void load(); }, [load]);
  useEngineEvent("hack", load);
  // Organisers edit, publish and reorder while the section is on screen.
  useEngineEvent("hacking", load);
  const preferred = state?.me?.preferred_language ?? null;

  if (error) return <PageBody><EmptyState icon={<Icon.Bug size={20} />} title="Section B is not open" body={error} /></PageBody>;
  if (!data) return <ContestSkeleton rail={3} code />;
  const finished = Boolean(state?.me?.p1_hacking_finished);
  const locked = !data.open || finished;
  // A reorder or an unpublish can move or remove the open question, so it is held by id.
  const q = data.questions.find((x) => x.id === currentId) ?? data.questions[0];
  const solution = q ? (q.solutions.find((x) => x.language === preferred) ?? q.solutions[0]) : undefined;
  const attempts = q ? data.attempts.filter((a) => a.question_id === q.id) : [];
  const inFlight = data.attempts.some((a) => a.state !== "done");
  const hackedIds = new Set(data.attempts.filter((a) => a.hacked).map((a) => a.question_id));
  const unhacked = data.questions.length - hackedIds.size;

  // Finishing is irreversible and happens once, so it asks first, like Section A.
  async function finish() {
    try {
      await api.post("/api/phase1/finish", { section: "hacking" });
      setFinishOpen(false);
      await refresh();
      toast({ title: "Section B finished", description: "Your submission time is recorded.", tone: "success" });
    } catch (err) {
      toast({ title: "Could not finish", description: errorMessage(err), tone: "error" });
    }
  }

  async function chooseLanguage(id: number) {
    const language = q?.solutions.find((x) => x.id === id)?.language;
    if (!language) return;
    try { await api.put("/api/me/language", { language }); await refresh(); }
    catch (err) { toast({ title: "Language not changed", description: errorMessage(err), tone: "error" }); }
  }

  async function submit() {
    if (!q || !solution) return;
    setBusy(true);
    try { await api.post(`/api/phase1/hacking/${q.id}/attempts`, { input, solution_id: solution.id }); toast({ title: "Attempt submitted", description: "Judging. The result appears below.", tone: "info", duration: 2500 }); await load(); }
    catch (err) { toast({ title: "Not submitted", description: errorMessage(err), tone: "error" }); }
    finally { setBusy(false); }
  }

  return (
    <PageBody width="wide" className="animate-fade-in">
      {/* The finish lives up here, away from the list, the same place as in
          Section A: it is irreversible and happens once. */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">Section B · Hacking</div>
          <div className="mt-0.5 text-[13px] text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">{hackedIds.size}</span> of{" "}
            <span className="tabular-nums">{data.questions.length}</span> hacked
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <Icon.Clock size={14} />
            <Countdown until={data.phase_ends_at} className="font-semibold text-ink" />
          </span>
          {finished ? (
            <Badge variant="success">Finished</Badge>
          ) : (
            <Button size="sm" disabled={locked} onClick={() => setFinishOpen(true)}>
              <Icon.Flag size={14} /> Submit &amp; finish
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-box border border-line bg-card">
            <div className="flex items-center justify-between border-b border-line px-4 py-3 text-[13px]"><span className="font-semibold">Solutions</span><span className="text-muted-foreground">{hackedIds.size} of {data.questions.length} hacked</span></div>
            <ol className="p-2">{data.questions.map((x, i) => (
              <li key={x.id}><button onClick={() => { setCurrentId(x.id); setInput(""); }} aria-current={x.id === q?.id ? "true" : undefined}
                className={`flex w-full items-center gap-2.5 rounded-box px-3 py-2 text-left text-[13px] ${x.id === q?.id ? "bg-brand-tint font-semibold text-ink" : "text-muted-foreground hover:bg-muted hover:text-ink"}`}>
                <span className={`h-2 w-2 shrink-0 rounded-full ${hackedIds.has(x.id) ? "bg-green" : "border border-line-2"}`} /><span className="truncate">{i + 1}. {x.title}</span><span className="ml-auto text-[11.5px] tabular-nums text-faint">{x.hack_points}</span></button></li>
            ))}</ol>
          </div>
        </aside>

        {q ? (
          <div className="min-w-0 space-y-4">
            {!data.open && !finished && (
              <Alert variant="warning">
                <Icon.Lock />
                <AlertTitle>Section B is closed</AlertTitle>
              </Alert>
            )}
            <HackQuestionView q={q} index={data.questions.indexOf(q)} total={data.questions.length} hacked={hackedIds.has(q.id)} solutionId={solution?.id} onSelectSolution={chooseLanguage} />
            <Section title="Your test input" description="Must obey the constraints. You are told whether it was valid and whether it broke the solution, nothing more.">
              <div className="space-y-3">
                {hackedIds.has(q.id) && <Alert variant="success"><AlertDescription>You have already broken this solution. Further hacks on it score nothing. Move on.</AlertDescription></Alert>}
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
        ) : <EmptyState icon={<Icon.Bug size={20} />} title="No hacking questions published" body="The organisers have not published any yet." />}
      </div>
      <Modal open={finishOpen} onClose={() => setFinishOpen(false)} title="Finish Section B?">
        <p className="text-[13px]">You have hacked <strong>{hackedIds.size}</strong> of <strong>{data.questions.length}</strong>. After finishing you cannot send another attempt. Your submission time, which is the tiebreak, is recorded now.</p>
        {inFlight && <div className="mt-3"><Alert variant="warning"><AlertDescription>An attempt is still being judged. It will still count.</AlertDescription></Alert></div>}
        {unhacked > 0 && !inFlight && <div className="mt-3"><Alert variant="warning"><AlertDescription>{unhacked} solution{unhacked === 1 ? "" : "s"} not hacked yet.</AlertDescription></Alert></div>}
        <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setFinishOpen(false)}>Keep working</Button><Button onClick={finish}><Icon.Flag size={14} /> Finish</Button></div>
      </Modal>
    </PageBody>
  );
}
