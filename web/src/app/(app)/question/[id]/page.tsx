"use client";

/**
 * The question page: statement, samples, hints, editor, submit, verdicts.
 * Owner only -- the API refuses anyone else (US-F3-02). Drafts autosave to
 * the server so a machine swap finds them (US-F5-03).
 */
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { useContest } from "@/components/contest-provider";
import { Markdown } from "@/components/markdown";
import { Alert } from "@/components/ui/alert";
import { Badge, VerdictBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tabs";
import { api, errorMessage } from "@/lib/client";

const CodeEditor = dynamic(() => import("@/components/editor").then((m) => m.CodeEditor), { ssr: false, loading: () => <div className="h-[60vh] rounded-box border border-line bg-navy" /> });

type Judgement = { id: number; state: string; verdict: string | null; passed: number | null; total: number | null; first_fail: number | null; max_time_ms: number | null; compile_output: string | null; message: string | null; progress: { done: number; total: number }; cancelled: boolean; created_at: string };
type Question = {
  id: string; title: string; difficulty: string; score: number; status: string; statement_md: string;
  time_limit_ms: number | null; memory_limit_mb: number | null; hidden_testcases: number | null; sample_count: number;
  samples: { input: string; output: string }[];
  hints: { total: number; revealed: { idx: number; body_md: string; price: number }[]; next: { idx: number; price: number } | null };
  history: { id: number; language: string; created_at: string; judgement: Judgement }[];
  draft: { source: string; language: string; updated_at: string } | null;
  submit: { in_flight: boolean; cooldown_ms: number };
  awarded_at: string;
};

const TEMPLATE: Record<string, string> = {
  cpp: "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n    \n    return 0;\n}\n",
  c: "#include <stdio.h>\n\nint main(void) {\n    \n    return 0;\n}\n",
  python: "import sys\n\ndef main():\n    data = sys.stdin.read().split()\n    \n\nmain()\n",
  pypy: "import sys\n\ndef main():\n    data = sys.stdin.read().split()\n    \n\nmain()\n",
  java: "import java.util.*;\nimport java.io.*;\n\npublic class Main {\n    public static void main(String[] args) throws IOException {\n        \n    }\n}\n",
  javascript: "const lines = require('fs').readFileSync(0, 'utf8').split('\\n');\n\n",
};

export default function QuestionPage() {
  const { id } = useParams<{ id: string }>();
  const { state, lastEvent, serverNow } = useContest();
  const [q, setQ] = useState<Question | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [languages, setLanguages] = useState<{ key: string; name: string }[]>([]);
  const [language, setLanguage] = useState("cpp");
  const [source, setSource] = useState("");
  const [saved, setSaved] = useState<"saved" | "saving" | "failed" | "idle">("idle");
  const [tab, setTab] = useState<"statement" | "history">("statement");
  const [hintDialog, setHintDialog] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedDraft = useRef(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get<Question>(`/api/questions/${id}`);
      setQ(data);
      if (!loadedDraft.current) {
        loadedDraft.current = true;
        const local = safeGet(`draft:${id}`);
        const remote = data.draft;
        // The newer of the server draft and the local mirror.
        const pick = local && (!remote || local.at > Date.parse(remote.updated_at ?? "0")) ? local : remote ? { source: remote.source, language: remote.language } : null;
        if (pick) { setSource(pick.source); setLanguage(pick.language); }
        else setSource(TEMPLATE.cpp);
      }
    } catch (err) { setError(errorMessage(err)); }
  }, [id]);

  useEffect(() => { void load(); void api.get<{ languages: { key: string; name: string }[] }>("/api/languages").then((r) => setLanguages(r.languages)); }, [load]);
  useEffect(() => { if (lastEvent?.name === "verdict" || lastEvent?.name === "balance") void load(); }, [lastEvent, load]);

  // Cooldown ticker (US-F5-02).
  useEffect(() => {
    if (!q) return;
    const end = serverNow() + q.submit.cooldown_ms;
    const t = setInterval(() => setCooldown(Math.max(0, end - serverNow())), 200);
    return () => clearInterval(t);
  }, [q, serverNow]);

  // Autosave: local mirror immediately, server after ~1.5 s of quiet.
  function onChange(next: string) {
    setSource(next);
    safeSet(`draft:${id}`, { source: next, language, at: Date.now() });
    setSaved("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try { await api.put(`/api/drafts/${id}`, { source: next, language }); setSaved("saved"); }
      catch { setSaved("failed"); }
    }, 1500);
  }

  async function submit() {
    setBusy(true); setError(null);
    try { await api.post("/api/submissions", { question_id: id, language, source }); setTab("history"); await load(); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }

  async function cancel() {
    try { await api.del("/api/submissions/current"); await load(); } catch (err) { setError(errorMessage(err)); }
  }

  async function buyHint() {
    setBusy(true); setError(null);
    try { await api.post(`/api/questions/${id}/hints`); setHintDialog(false); await load(); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }

  if (error && !q) return <Alert tone="error">{error}</Alert>;
  if (!q) return null;
  const solved = q.history.some((h) => h.judgement.verdict === "AC");
  const inFlight = q.submit.in_flight;
  const canSubmit = !inFlight && cooldown === 0 && !busy && state?.contest.phase !== "ended" && q.status !== "void";

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <Card>
          <CardHeader
            title={<span className="flex items-center gap-2">{q.title} <Badge tone={q.difficulty === "hard" ? "red" : q.difficulty === "medium" ? "amber" : "green"}>{q.difficulty}</Badge> <Badge tone="grey">{q.score} pts</Badge>{solved && <Badge tone="green">Solved</Badge>}</span>}
          />
          <div className="border-b border-line px-4"><Tabs value={tab} onChange={setTab} tabs={[{ value: "statement", label: "Problem" }, { value: "history", label: `Submissions (${q.history.length})` }]} /></div>
          <CardBody>
            {tab === "statement" ? (
              <div className="space-y-4">
                <div className="flex gap-4 text-xs text-muted">
                  <span>Time limit: <strong>{q.time_limit_ms ? `${q.time_limit_ms / 1000} s` : "—"}</strong></span>
                  <span>Memory: <strong>{q.memory_limit_mb ? `${q.memory_limit_mb} MB` : "—"}</strong></span>
                  <span>Hidden testcases: <strong>{q.hidden_testcases ?? "—"}</strong></span>
                </div>
                <Markdown>{q.statement_md}</Markdown>
                {q.samples.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold">Sample testcases</h3>
                    {q.samples.map((s, i) => (
                      <div key={i} className="grid grid-cols-2 gap-3">
                        <SampleBox label={`Sample input ${i + 1}`} text={s.input} />
                        <SampleBox label={`Sample output ${i + 1}`} text={s.output} />
                      </div>
                    ))}
                    <p className="text-xs text-faint">Hidden testcases are never shown, for free or for payment.</p>
                  </div>
                )}
                <div className="rounded-box border border-line bg-page p-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Hints <span className="font-normal text-faint">{q.hints.revealed.length}/{q.hints.total} revealed</span></h3>
                    {q.hints.next && <Button size="sm" variant="secondary" onClick={() => setHintDialog(true)}>Buy hint {q.hints.next.idx + 1} · {q.hints.next.price}</Button>}
                  </div>
                  {q.hints.revealed.map((h) => (
                    <div key={h.idx} className="mt-2 rounded-box border border-line bg-card p-3 text-sm"><div className="mb-1 text-xs font-semibold text-faint">Hint {h.idx + 1}</div><Markdown>{h.body_md}</Markdown></div>
                  ))}
                  {q.hints.total === 0 && <p className="mt-1 text-xs text-faint">This question has no hints.</p>}
                </div>
              </div>
            ) : (
              <History history={q.history} sampleCount={q.sample_count} onRestore={(h) => { const s = h; void s; }} />
            )}
          </CardBody>
        </Card>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-52">
            <Select value={language} onChange={(e) => { setLanguage(e.target.value); if (!source.trim()) setSource(TEMPLATE[e.target.value] ?? ""); }}>
              {languages.length === 0 && <option value={language}>{language}</option>}
              {languages.map((l) => <option key={l.key} value={l.key}>{l.name}</option>)}
            </Select>
          </div>
          <span className={`text-xs ${saved === "failed" ? "font-semibold text-red" : "text-faint"}`}>
            {saved === "saving" ? "Saving…" : saved === "saved" ? "Draft saved" : saved === "failed" ? "Draft NOT saved — check your connection" : ""}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {inFlight && <Button variant="ghost" size="sm" onClick={cancel}>Cancel</Button>}
            <Button onClick={submit} disabled={!canSubmit}>
              {inFlight ? "Judging…" : cooldown > 0 ? `Wait ${Math.ceil(cooldown / 1000)}s` : "Submit"}
            </Button>
          </div>
        </div>
        {error && <Alert tone="error">{error}</Alert>}
        <CodeEditor value={source} language={language} onChange={onChange} />
        <LatestVerdict history={q.history} sampleCount={q.sample_count} />
      </div>

      <Dialog open={hintDialog} onClose={() => setHintDialog(false)} title="Buy a hint">
        <p className="text-sm">Reveal hint <strong>{(q.hints.next?.idx ?? 0) + 1}</strong> for <strong>{q.hints.next?.price}</strong> coins? Purchases are final.</p>
        <div className="mt-4 flex justify-end gap-2"><Button variant="secondary" onClick={() => setHintDialog(false)}>Cancel</Button><Button onClick={buyHint} disabled={busy}>Buy for {q.hints.next?.price}</Button></div>
      </Dialog>
    </div>
  );
}

function SampleBox({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs font-semibold text-muted">
        {label}
        <button className="text-green-dark" onClick={() => navigator.clipboard?.writeText(text)}>Copy</button>
      </div>
      <pre className="max-h-40 overflow-auto rounded-box border border-line bg-page p-2 text-xs">{text}</pre>
    </div>
  );
}

function explain(j: Judgement, sampleCount: number): string {
  if (j.cancelled) return "Cancelled.";
  switch (j.verdict) {
    case "AC": return "Accepted — every testcase passed. This question is solved and stays solved.";
    case "WA": return `Wrong answer on test ${j.first_fail}.${j.first_fail !== null && j.first_fail < sampleCount ? " That is a sample testcase — check your output format." : ""}`;
    case "TLE": return `Time limit exceeded on test ${j.first_fail}. Your program is too slow for this input size.`;
    case "MLE": return `Memory limit exceeded on test ${j.first_fail}.`;
    case "OLE": return `Output limit exceeded on test ${j.first_fail} — far too much output.`;
    case "RE": return `Runtime error on test ${j.first_fail} — a crash, or a non-zero exit code.`;
    case "CE": return "Compilation failed. The compiler output is below.";
    case "IE": return "The judge failed on our side. This is not counted against you — tell an organiser if it persists.";
    default: return j.state === "queued" ? "Queued…" : `Running test ${j.progress.done}/${j.progress.total}…`;
  }
}

function LatestVerdict({ history, sampleCount }: { history: Question["history"]; sampleCount: number }) {
  const latest = history[0];
  if (!latest) return null;
  const j = latest.judgement;
  const tone = j.verdict === "AC" ? "success" : j.verdict === "IE" || !j.verdict ? "info" : "error";
  return (
    <Alert tone={tone} title={j.state !== "done" ? "Judging" : undefined}>
      <div className="flex items-center gap-2"><VerdictBadge verdict={j.state === "done" ? j.verdict : null} /><span>{explain(j, sampleCount)}</span></div>
      {j.state === "running" && <div className="mt-2 h-1.5 w-full rounded bg-line"><div className="h-1.5 rounded bg-green" style={{ width: `${j.progress.total ? (100 * j.progress.done) / j.progress.total : 0}%` }} /></div>}
      {j.verdict === "CE" && j.compile_output && <pre className="mt-2 max-h-40 overflow-auto rounded-box bg-navy p-2 text-xs text-white">{j.compile_output}</pre>}
    </Alert>
  );
}

function History({ history, sampleCount }: { history: Question["history"]; sampleCount: number; onRestore: (h: Question["history"][number]) => void }) {
  if (history.length === 0) return <p className="text-sm text-muted">No submissions yet.</p>;
  return (
    <ul className="divide-y divide-line">
      {history.map((h) => (
        <li key={h.id} className="py-3 text-sm">
          <div className="flex items-center gap-3">
            <VerdictBadge verdict={h.judgement.state === "done" ? h.judgement.verdict : null} />
            <span className="text-faint">{new Date(h.created_at).toLocaleTimeString()} · {h.language}</span>
            {h.judgement.max_time_ms ? <span className="text-faint">{h.judgement.max_time_ms.toFixed(0)} ms</span> : null}
          </div>
          <div className="mt-1 text-muted">{explain(h.judgement, sampleCount)}</div>
        </li>
      ))}
    </ul>
  );
}

function safeGet(key: string): { source: string; language: string; at: number } | null {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; }
}
function safeSet(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable; the server copy still saves */ }
}
