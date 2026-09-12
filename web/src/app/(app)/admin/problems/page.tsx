"use client";

/**
 * Problems: the judge's view of every package, upload a new version, validate
 * it, publish it (with the blast radius shown), and the contest-facing form
 * -- title, statement, difficulty, score, base price, samples, hints
 * (US-F9-01..03, decision: form + zip).
 */
import { useCallback, useEffect, useState } from "react";

import { ReasonAction } from "@/components/reason-action";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { api, errorMessage } from "@/lib/client";

type P = { problem_id: string; testcases: number; bytes: number; version: string; validated: boolean; compare: string; time_limit_ms: number; memory_limit_mb: number; has_reference: boolean; hack_only: boolean; modified_at: string | null; versions: string[]; current: string | null };
type Q = { id: string; title: string; difficulty: string; score: number; basePrice: number; statementMd: string; sampleCount: number; auctionOrder: number; status: string; validated: boolean; hints: { idx: number; price: number; bodyMd: string }[] };
type Report = { ok: boolean; issues: string[]; reference: { verdict: string; first_fail: number | null; passed: number; max_time_ms: number } | null; wrong_solution: { verdict: string } | null; checker: { compiled: boolean; output: string } | null };

export default function ProblemsPage() {
  const [problems, setProblems] = useState<P[]>([]);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const load = useCallback(async () => {
    const [p, q] = await Promise.all([api.get<{ problems: P[] }>("/api/admin/problems"), api.get<{ questions: Q[] }>("/api/admin/questions")]);
    setProblems(p.problems); setQuestions(q.questions);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const ids = [...new Set([...problems.map((p) => p.problem_id), ...questions.map((q) => q.id)])].sort();

  return (
    <div className="space-y-6">
      <Upload onDone={load} />
      <Card>
        <CardHeader title="Problem set" />
        <Table>
          <thead><tr><Th>Id</Th><Th>Title</Th><Th>Tests</Th><Th>Size</Th><Th>Live</Th><Th>Validated</Th><Th>Kind</Th><Th></Th></tr></thead>
          <tbody>{ids.map((id) => {
            const p = problems.find((x) => x.problem_id === id); const q = questions.find((x) => x.id === id);
            return (
              <tr key={id} className={selected === id ? "bg-green-tint" : ""}>
                <Td className="font-mono text-xs">{id}</Td>
                <Td>{q?.title ?? <span className="text-faint">no contest details yet</span>}</Td>
                <Td>{p?.testcases ?? "—"}</Td><Td>{p ? `${(p.bytes / 1024 / 1024).toFixed(1)} MB` : "—"}</Td>
                <Td>{p?.current ?? <span className="text-faint">unpublished</span>}</Td>
                <Td>{p ? (p.validated || q?.validated ? <Badge tone="green">ready</Badge> : <Badge tone="amber">not validated</Badge>) : <Badge tone="red">missing from judge</Badge>}</Td>
                <Td>{p?.hack_only ? <Badge tone="blue">hacking</Badge> : q?.status === "void" ? <Badge tone="red">void</Badge> : q?.status === "sold" ? <Badge tone="grey">sold</Badge> : null}</Td>
                <Td><Button size="sm" variant="ghost" onClick={() => setSelected(selected === id ? null : id)}>{selected === id ? "Close" : "Manage"}</Button></Td>
              </tr>
            );
          })}</tbody>
        </Table>
      </Card>
      {selected && <Manage id={selected} problem={problems.find((p) => p.problem_id === selected) ?? null} question={questions.find((q) => q.id === selected) ?? null} onChange={load} />}
    </div>
  );
}

function Upload({ onDone }: { onDone: () => void }) {
  const [id, setId] = useState(""); const [reason, setReason] = useState(""); const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  async function submit() {
    if (!file) return;
    const form = new FormData(); form.set("id", id); form.set("reason", reason); form.set("package", file);
    try { const r = await api.post<{ version: string }>("/api/admin/problems", form); setMsg({ tone: "success", text: `Uploaded as ${r.version}. Validate it, then publish.` }); onDone(); }
    catch (err) { setMsg({ tone: "error", text: errorMessage(err) }); }
  }
  return (
    <Card>
      <CardHeader title="Upload a package" />
      <CardBody className="grid gap-3 md:grid-cols-4">
        <Input placeholder="problem id, e.g. hard-03" value={id} onChange={(e) => setId(e.target.value)} />
        <input type="file" accept=".zip" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
        <Input placeholder="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        <Button onClick={submit} disabled={!id || !file || reason.length < 3}>Upload as new version</Button>
        <p className="col-span-full text-xs text-faint">A zip with problem.json, tests/, and optionally checker.py, validator.py and a reference solution. It becomes a new version; the live one is untouched until you publish.</p>
        {msg && <div className="col-span-full"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
      </CardBody>
    </Card>
  );
}

function Manage({ id, problem, question, onChange }: { id: string; problem: P | null; question: Q | null; onChange: () => void }) {
  const [version, setVersion] = useState(problem?.versions.at(-1) ?? "");
  const [report, setReport] = useState<Report | null>(null);
  const [reference, setReference] = useState(""); const [wrong, setWrong] = useState(""); const [lang, setLang] = useState("cpp");
  const [blast, setBlast] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function validate() {
    setError(null);
    try { setReport(await api.post<Report>(`/api/admin/problems/${id}/validate`, { version, reference_source: reference || undefined, wrong_source: wrong || undefined, language: reference || wrong ? lang : undefined })); onChange(); }
    catch (err) { setError(errorMessage(err)); }
  }
  useEffect(() => { void api.post<{ submissions: number }>(`/api/admin/problems/${id}/blast-radius`, {}).then((r) => setBlast(r.submissions)).catch(() => setBlast(0)); }, [id]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title={`${id} — versions`} />
        <CardBody className="space-y-4">
          {problem ? (
            <>
              <div className="flex items-center gap-2 text-sm">Version <Select className="w-28" value={version} onChange={(e) => setVersion(e.target.value)}>{problem.versions.map((v) => <option key={v}>{v}</option>)}</Select> <span className="text-faint">live: {problem.current ?? "none"}</span></div>
              <Field label="Reference solution (optional if the package stores one)"><Textarea rows={4} className="font-mono text-xs" value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
              <Field label="Known-wrong solution (optional)"><Textarea rows={3} className="font-mono text-xs" value={wrong} onChange={(e) => setWrong(e.target.value)} /></Field>
              <div className="flex items-center gap-2"><Select className="w-32" value={lang} onChange={(e) => setLang(e.target.value)}>{["cpp", "c", "python", "pypy", "java", "javascript"].map((l) => <option key={l}>{l}</option>)}</Select><Button variant="secondary" onClick={validate} disabled={!version}>Validate {version}</Button></div>
              {error && <Alert tone="error">{error}</Alert>}
              {report && (
                <Alert tone={report.ok ? "success" : "error"} title={report.ok ? "Validation passed" : "Validation failed"}>
                  {report.issues.length > 0 && <ul className="list-disc pl-5">{report.issues.map((i) => <li key={i}>{i}</li>)}</ul>}
                  {report.reference && <p>Reference: <strong>{report.reference.verdict}</strong>{report.reference.first_fail !== null && <> — first fail at testcase <strong>{report.reference.first_fail}</strong></>} · slowest {report.reference.max_time_ms.toFixed(0)} ms</p>}
                  {report.wrong_solution && <p>Known-wrong solution: <strong>{report.wrong_solution.verdict}</strong>{report.wrong_solution.verdict === "AC" && " — the testcases do not catch it"}</p>}
                </Alert>
              )}
              <div className="flex items-center gap-3 border-t border-line pt-3">
                <ReasonAction label={`Publish ${version}`} variant="primary" title={`Publish ${version}?`}
                  description={blast ? <span className="font-semibold text-red">This will rejudge {blast} submission(s). Confirm you understand.</span> : "No submissions exist yet; publishing is immediate."}
                  onConfirm={async (reason) => { await api.post(`/api/admin/problems/${id}/publish`, { version, reason, confirmed_rejudge: blast ?? 0 }); onChange(); }} />
                {!report?.ok && <span className="text-xs text-amber">Publishing an unvalidated version is allowed but warned against.</span>}
              </div>
              {blast ? (
                <div className="flex gap-2 border-t border-line pt-3">
                  <span className="text-xs text-muted">After a rejudge, choose the outcome:</span>
                  {(["stand", "refund", "void"] as const).map((o) => <ReasonAction key={o} label={o} title={`Rejudge outcome: ${o}`} onConfirm={async (reason) => { await api.post(`/api/admin/questions/${id}/rejudge-outcome`, { reason, outcome: o }); onChange(); }} />)}
                </div>
              ) : null}
            </>
          ) : <Alert tone="warning">No package on the judge for this id. Upload one above.</Alert>}
        </CardBody>
      </Card>
      <QuestionForm id={id} question={question} onChange={onChange} />
    </div>
  );
}

function QuestionForm({ id, question, onChange }: { id: string; question: Q | null; onChange: () => void }) {
  const [q, setQ] = useState({ title: question?.title ?? "", difficulty: question?.difficulty ?? "easy", score: question?.score ?? 100, base_price: question?.basePrice ?? 100, statement_md: question?.statementMd ?? "", sample_count: question?.sampleCount ?? 1, auction_order: question?.auctionOrder ?? 0, hints: question?.hints.map((h) => ({ price: h.price, body_md: h.bodyMd })) ?? [] });
  const [reason, setReason] = useState(""); const [msg, setMsg] = useState<string | null>(null);
  async function save() {
    try { await api.post("/api/admin/questions", { id, ...q, reason }); setMsg("Saved."); onChange(); } catch (err) { setMsg(errorMessage(err)); }
  }
  return (
    <Card>
      <CardHeader title="Contest details (what participants see)" />
      <CardBody>
        <Field label="Title"><Input value={q.title} onChange={(e) => setQ({ ...q, title: e.target.value })} /></Field>
        <div className="grid grid-cols-4 gap-3">
          <Field label="Difficulty"><Select value={q.difficulty} onChange={(e) => setQ({ ...q, difficulty: e.target.value })}><option>easy</option><option>medium</option><option>hard</option></Select></Field>
          <Field label="Score"><Input type="number" value={q.score} onChange={(e) => setQ({ ...q, score: Number(e.target.value) })} /></Field>
          <Field label="Base price"><Input type="number" value={q.base_price} onChange={(e) => setQ({ ...q, base_price: Number(e.target.value) })} /></Field>
          <Field label="Auction order"><Input type="number" value={q.auction_order} onChange={(e) => setQ({ ...q, auction_order: Number(e.target.value) })} /></Field>
        </div>
        <Field label="Statement (Markdown)"><Textarea rows={10} value={q.statement_md} onChange={(e) => setQ({ ...q, statement_md: e.target.value })} /></Field>
        <Field label="Sample count K" hint="The first K testcases of the package are shown as samples; their text is read from the package."><Input type="number" value={q.sample_count} onChange={(e) => setQ({ ...q, sample_count: Number(e.target.value) })} /></Field>
        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between text-[13px] font-semibold text-muted">Hints (unlock in order) <Button size="sm" variant="ghost" onClick={() => setQ({ ...q, hints: [...q.hints, { price: 50, body_md: "" }] })}>+ add</Button></div>
          {q.hints.map((h, i) => (
            <div key={i} className="mb-2 flex gap-2"><Input className="w-24" type="number" value={h.price} onChange={(e) => setQ({ ...q, hints: q.hints.map((x, j) => (j === i ? { ...x, price: Number(e.target.value) } : x)) })} /><Textarea rows={2} value={h.body_md} onChange={(e) => setQ({ ...q, hints: q.hints.map((x, j) => (j === i ? { ...x, body_md: e.target.value } : x)) })} /><Button size="sm" variant="ghost" onClick={() => setQ({ ...q, hints: q.hints.filter((_, j) => j !== i) })}>×</Button></div>
          ))}
        </div>
        <Field label="Reason"><Input value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        {msg && <div className="mb-3"><Alert tone={msg === "Saved." ? "success" : "error"}>{msg}</Alert></div>}
        <div className="flex gap-2">
          <Button onClick={save} disabled={reason.length < 3 || !q.title}>Save details</Button>
          {question && question.status !== "void" && <ReasonAction label="Void question" variant="danger" title={`Void ${id}?`} description="Scores for nobody; the owner is refunded the price and every hint by default." onConfirm={async (reason) => { await api.post(`/api/admin/questions/${id}/void`, { reason }); onChange(); }} />}
        </div>
      </CardBody>
    </Card>
  );
}
