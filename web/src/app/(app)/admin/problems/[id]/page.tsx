"use client";

/** One problem: its versions on the judge, validate → publish, and the contest-facing details. */
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { ReasonAction } from "@/components/reason-action";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { CardSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/client";

import type { P, Q } from "../page";

type Report = { ok: boolean; issues: string[]; reference: { verdict: string; first_fail: number | null; passed: number; max_time_ms: number } | null; wrong_solution: { verdict: string } | null; checker: { compiled: boolean; output: string } | null };

export default function ProblemPage() {
  const { id } = useParams<{ id: string }>();
  const [problem, setProblem] = useState<P | null | undefined>(undefined);
  const [question, setQuestion] = useState<Q | null | undefined>(undefined);
  const load = useCallback(async () => {
    const [p, q] = await Promise.all([api.get<{ problems: P[] }>("/api/admin/problems"), api.get<{ questions: Q[] }>("/api/admin/questions")]);
    setProblem(p.problems.find((x) => x.problem_id === id) ?? null); setQuestion(q.questions.find((x) => x.id === id) ?? null);
  }, [id]);
  useEffect(() => { void load(); }, [load]);
  if (problem === undefined) return <CardSkeleton lines={10} />;

  return (
    <div className="animate-fade-in">
      <PageHeader eyebrow={<Link href="/admin/problems" className="hover:text-ink">← Problems</Link>} title={<span className="flex items-center gap-2">{question?.title ?? id} <span className="font-mono text-sm font-normal text-faint">{id}</span></span>}
        description={problem ? `${problem.testcases} testcases · ${problem.compare} · ${problem.time_limit_ms} ms / ${problem.memory_limit_mb} MB · live ${problem.current ?? "none"}` : "No package on the judge for this id."}
        actions={<>{problem?.hack_only && <Badge tone="blue">hacking package</Badge>}{question?.status === "void" && <Badge tone="red">voided</Badge>}{(problem?.validated || question?.validated) ? <Badge tone="green">validated</Badge> : <Badge tone="amber">not validated</Badge>}</>} />
      <div className="grid gap-4 lg:grid-cols-2">
        {problem ? <Versions id={id} problem={problem} onChange={load} /> : <Alert tone="warning" title="Upload a package first">Go back to Problems and upload a zip with this id.</Alert>}
        {!problem?.hack_only && <Details id={id} question={question ?? null} onChange={load} />}
      </div>
    </div>
  );
}

function Versions({ id, problem, onChange }: { id: string; problem: P; onChange: () => void }) {
  const { toast } = useToast();
  const [version, setVersion] = useState(problem.versions.at(-1) ?? "");
  const [report, setReport] = useState<Report | null>(null);
  const [reference, setReference] = useState(""); const [wrong, setWrong] = useState(""); const [lang, setLang] = useState("cpp");
  const [blast, setBlast] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => { void api.post<{ submissions: number }>(`/api/admin/problems/${id}/blast-radius`, {}).then((r) => setBlast(r.submissions)).catch(() => setBlast(0)); }, [id]);

  async function validate() {
    setBusy(true);
    try { setReport(await api.post<Report>(`/api/admin/problems/${id}/validate`, { version, reference_source: reference || undefined, wrong_source: wrong || undefined, language: reference || wrong ? lang : undefined })); onChange(); }
    catch (err) { toast({ title: "Validation failed to run", description: errorMessage(err), tone: "error" }); } finally { setBusy(false); }
  }

  return (
    <Card>
      <CardHeader title="Versions on the judge" description="Validate a version, then publish it. Publishing mid-contest rejudges every submission." />
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">Version</span>
          <div className="w-28"><Select value={version} onChange={(e) => { setVersion(e.target.value); setReport(null); }}>{problem.versions.map((v) => <option key={v}>{v}</option>)}</Select></div>
          {problem.current === version ? <Badge tone="green">live</Badge> : <Badge tone="grey">not live</Badge>}
          {problem.has_reference && <Badge tone="blue">stored reference</Badge>}
        </div>
        <details className="rounded-box border border-line">
          <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">Optional: supply solutions to validate against</summary>
          <div className="space-y-3 border-t border-line p-3">
            <Field label="Reference solution" hint={problem.has_reference ? "The package stores one; leave empty to use it." : "Runs against every testcase."}><Textarea rows={4} className="font-mono text-xs" value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
            <Field label="Known-wrong solution" hint="If it is accepted, the testcases do not catch it."><Textarea rows={3} className="font-mono text-xs" value={wrong} onChange={(e) => setWrong(e.target.value)} /></Field>
            <div className="w-40"><Select value={lang} onChange={(e) => setLang(e.target.value)}>{["cpp", "c", "python", "pypy", "java", "javascript"].map((l) => <option key={l}>{l}</option>)}</Select></div>
          </div>
        </details>
        <Button variant="secondary" onClick={validate} loading={busy} disabled={!version} icon={<Icon.Play />}>Validate {version}</Button>
        {report && (
          <Alert tone={report.ok ? "success" : "error"} title={report.ok ? "Validation passed" : "Validation failed"}>
            {report.issues.length > 0 && <ul className="list-disc pl-5">{report.issues.map((i) => <li key={i}>{i}</li>)}</ul>}
            {report.reference && <p>Reference solution: <strong>{report.reference.verdict}</strong>{report.reference.first_fail !== null && <> — first fails at testcase <strong>{report.reference.first_fail}</strong>, so that answer file or the solution is wrong</>} · slowest test {report.reference.max_time_ms.toFixed(0)} ms</p>}
            {report.wrong_solution && <p>Known-wrong solution: <strong>{report.wrong_solution.verdict}</strong>{report.wrong_solution.verdict === "AC" && " — the testcases do not catch it"}</p>}
            {report.checker && !report.checker.compiled && <p>Checker: {report.checker.output}</p>}
          </Alert>
        )}
      </CardBody>
      <CardFooter className="flex-wrap justify-between gap-y-3">
        <span className="text-xs text-muted">{blast ? <span className="font-semibold text-red">Publishing rejudges {blast} submission(s).</span> : "No submissions yet — publishing is immediate."}</span>
        <div className="flex flex-wrap items-center gap-2">
          {blast > 0 && <span className="text-xs text-faint">After rejudge:</span>}
          {blast > 0 && (["stand", "refund", "void"] as const).map((o) => <ReasonAction key={o} label={o[0].toUpperCase() + o.slice(1)} title={`After the rejudge: ${o}`} description={o === "refund" ? "The owner keeps the question and gets the price back." : o === "void" ? "Nobody scores it; the owner is refunded the price and hints." : "Verdicts stand as rejudged."} onConfirm={async (reason) => { await api.post(`/api/admin/questions/${id}/rejudge-outcome`, { reason, outcome: o }); toast({ title: `Recorded: ${o}`, tone: "success" }); }} />)}
          <ReasonAction label={`Publish ${version}`} variant="primary" title={`Publish ${version}?`} description={blast ? <span className="font-semibold text-red">This rejudges {blast} submission(s). The number is confirmed with the publish.</span> : "The symlink is swapped atomically; the judge sees the new version immediately."}
            onConfirm={async (reason) => { await api.post(`/api/admin/problems/${id}/publish`, { version, reason, confirmed_rejudge: blast }); toast({ title: `Published ${version}`, tone: "success" }); onChange(); }} />
        </div>
      </CardFooter>
    </Card>
  );
}

function Details({ id, question, onChange }: { id: string; question: Q | null; onChange: () => void }) {
  const { toast } = useToast();
  const [q, setQ] = useState({ title: question?.title ?? "", difficulty: question?.difficulty ?? "easy", score: question?.score ?? 100, base_price: question?.basePrice ?? 100, statement_md: question?.statementMd ?? "", sample_count: question?.sampleCount ?? 1, auction_order: question?.auctionOrder ?? 0, hints: question?.hints.map((h) => ({ price: h.price, body_md: h.bodyMd })) ?? [] });
  const [reason, setReason] = useState(""); const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try { await api.post("/api/admin/questions", { id, ...q, reason }); toast({ title: "Details saved", tone: "success" }); setReason(""); onChange(); }
    catch (err) { toast({ title: "Not saved", description: errorMessage(err), tone: "error" }); } finally { setBusy(false); }
  }
  return (
    <Card>
      <CardHeader title="What participants see" description="Title, statement, tier, price and hints. The judge never sees any of this." />
      <CardBody>
        <Field label="Title"><Input value={q.title} onChange={(e) => setQ({ ...q, title: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Tier"><Select value={q.difficulty} onChange={(e) => setQ({ ...q, difficulty: e.target.value })}><option>easy</option><option>medium</option><option>hard</option></Select></Field>
          <Field label="Score"><Input type="number" value={q.score} onChange={(e) => setQ({ ...q, score: Number(e.target.value) })} /></Field>
          <Field label="Base price"><Input type="number" value={q.base_price} onChange={(e) => setQ({ ...q, base_price: Number(e.target.value) })} /></Field>
          <Field label="Auction order"><Input type="number" value={q.auction_order} onChange={(e) => setQ({ ...q, auction_order: Number(e.target.value) })} /></Field>
        </div>
        <Field label="Statement (Markdown)"><Textarea rows={10} value={q.statement_md} onChange={(e) => setQ({ ...q, statement_md: e.target.value })} /></Field>
        <Field label="Samples: first K testcases" hint="Shown free; the text is read from the package so it can never disagree with what is judged."><Input type="number" className="w-24" value={q.sample_count} onChange={(e) => setQ({ ...q, sample_count: Number(e.target.value) })} /></Field>
        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between text-[13px] font-semibold text-muted">Hints, unlocked in order <Button size="sm" variant="ghost" onClick={() => setQ({ ...q, hints: [...q.hints, { price: 50, body_md: "" }] })}>+ Add hint</Button></div>
          {q.hints.length === 0 && <p className="text-xs text-faint">No hints. Participants with money and no idea will have nothing to buy.</p>}
          {q.hints.map((h, i) => (
            <div key={i} className="mb-2 flex gap-2"><span className="mt-2 w-5 text-xs text-faint">{i + 1}.</span><Input className="w-24" type="number" value={h.price} aria-label="Price" onChange={(e) => setQ({ ...q, hints: q.hints.map((x, j) => (j === i ? { ...x, price: Number(e.target.value) } : x)) })} /><Textarea rows={2} value={h.body_md} placeholder="Hint text (Markdown)" onChange={(e) => setQ({ ...q, hints: q.hints.map((x, j) => (j === i ? { ...x, body_md: e.target.value } : x)) })} /><Button size="sm" variant="ghost" aria-label="Remove hint" onClick={() => setQ({ ...q, hints: q.hints.filter((_, j) => j !== i) })}><Icon.X /></Button></div>
          ))}
        </div>
        <Field label="Reason"><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. initial details" /></Field>
      </CardBody>
      <CardFooter className="justify-between">
        {question && question.status !== "void" ? <ReasonAction label="Void question" variant="danger" title={`Void ${id}?`} description="Scores for nobody. The owner is refunded the price and every hint by default." onConfirm={async (reason) => { await api.post(`/api/admin/questions/${id}/void`, { reason }); toast({ title: "Question voided", tone: "success" }); onChange(); }} /> : <span />}
        <Button onClick={save} loading={busy} disabled={reason.length < 3 || !q.title} icon={<Icon.Check />}>Save details</Button>
      </CardFooter>
    </Card>
  );
}
