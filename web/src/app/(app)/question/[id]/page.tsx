"use client";

/**
 * The workspace: problem on the left, code on the right, verdict underneath,
 * no page scroll -- the way an IDE is laid out. Ctrl/Cmd+Enter submits.
 * Drafts autosave to the server so a machine swap finds them (US-F5-03).
 */
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { useContest } from "@/components/contest-provider";
import { Icon } from "@/components/icons";
import { Markdown } from "@/components/markdown";
import { StatementView } from "@/components/problems/statement-view";
import { Badge, VerdictBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { SimpleSelect } from "@/components/ui/select";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { SplitPane } from "@/components/ui/split-pane";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/client";

const CodeEditor = dynamic(() => import("@/components/editor").then((m) => m.CodeEditor), { ssr: false, loading: () => <div className="h-full bg-[#1e1e1e]" /> });

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

export default function WorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const { state, lastEvent, serverNow } = useContest();
  const { toast } = useToast();
  const [q, setQ] = useState<Question | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [languages, setLanguages] = useState<{ key: string; name: string }[]>([]);
  const preferred = state?.me?.preferred_language ?? "cpp";
  const [language, setLanguage] = useState(preferred);
  const [source, setSource] = useState("");
  const [fontSize, setFontSize] = useState(13);
  const [saved, setSaved] = useState<"saved" | "saving" | "failed" | "idle">("idle");
  const [tab, setTab] = useState<"problem" | "submissions" | "hints">("problem");
  const [hintDialog, setHintDialog] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [panel, setPanel] = useState(true);
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
        const pick = local && (!remote || local.at > Date.parse(remote.updated_at)) ? local : remote ? { source: remote.source, language: remote.language } : null;
        if (pick) { setSource(pick.source); setLanguage(pick.language); } else { setLanguage(preferred); setSource(TEMPLATE[preferred] ?? TEMPLATE.cpp); }
      }
    } catch (err) { setError(errorMessage(err)); }
  }, [id]);

  useEffect(() => { void load(); void api.get<{ languages: { key: string; name: string }[] }>("/api/languages").then((r) => setLanguages(r.languages)); }, [load]);
  useEffect(() => { if (lastEvent?.name === "verdict" || lastEvent?.name === "balance") void load(); }, [lastEvent, load]);
  useEffect(() => {
    if (!q) return;
    const end = serverNow() + q.submit.cooldown_ms;
    const t = setInterval(() => setCooldown(Math.max(0, end - serverNow())), 200);
    return () => clearInterval(t);
  }, [q, serverNow]);

  function onChange(next: string) {
    setSource(next);
    safeSet(`draft:${id}`, { source: next, language, at: Date.now() });
    setSaved("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try { await api.put(`/api/drafts/${id}`, { source: next, language }); setSaved("saved"); }
      catch { setSaved("failed"); toast({ title: "Draft not saved", description: "Check the connection. Your code is still in this window.", tone: "error" }); }
    }, 1500);
  }

  const submit = useCallback(async () => {
    if (!q) return;
    setBusy(true);
    try { await api.post("/api/submissions", { question_id: id, language, source }); setTab("submissions"); setPanel(true); await load(); }
    catch (err) { toast({ title: "Not submitted", description: errorMessage(err), tone: "error" }); }
    finally { setBusy(false); }
  }, [q, id, language, source, load, toast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); void submit(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submit]);

  async function cancel() { try { await api.del("/api/submissions/current"); await load(); } catch (err) { toast({ title: "Could not cancel", description: errorMessage(err), tone: "error" }); } }
  async function buyHint() {
    setBusy(true);
    try { const h = await api.post<{ idx: number; balance: number }>(`/api/questions/${id}/hints`); setHintDialog(false); toast({ title: `Hint ${h.idx + 1} revealed`, description: `Balance now ${h.balance}.`, tone: "success" }); setTab("hints"); await load(); }
    catch (err) { toast({ title: "Not bought", description: errorMessage(err), tone: "error" }); }
    finally { setBusy(false); }
  }

  if (error) return <div className="p-6"><EmptyState icon={<Icon.Lock size={22} />} title="You don't own this question" body={error} action={<Link href="/dashboard"><Button variant="outline" size="sm">Back to home</Button></Link>} /></div>;
  if (!q) return <div className="workspace grid grid-cols-2 gap-1 p-1"><Skeleton className="h-full" /><Skeleton className="h-full" /></div>;

  const latest = q.history[0]?.judgement ?? null;
  const solved = q.history.some((h) => h.judgement.verdict === "AC");
  const inFlight = q.submit.in_flight;
  const canSubmit = !inFlight && cooldown === 0 && !busy && state?.contest.phase !== "ended" && q.status !== "void";

  const problemPane = (
    <div className="flex h-full flex-col bg-card">
      <div className="flex items-center gap-3 border-b border-line px-4 py-2">
        <Link href="/dashboard" className="text-faint hover:text-ink" aria-label="Back to my questions"><Icon.ChevronLeft /></Link>
        <h1 className="truncate text-[15px] font-semibold">{q.title}</h1>
        <Badge variant={q.difficulty === "hard" ? "destructive" : q.difficulty === "medium" ? "warning" : "success"}>{q.difficulty}</Badge>
        <Badge variant="neutral">{q.score} pts</Badge>
        {solved && <Badge variant="success"><Icon.Check size={12} strokeWidth={3} /> Solved</Badge>}
      </div>
      <div className="px-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList variant="line" className="w-full justify-start">
            <TabsTrigger value="problem">Problem</TabsTrigger>
            <TabsTrigger value="submissions">Submissions{q.history.length ? ` (${q.history.length})` : ""}</TabsTrigger>
            <TabsTrigger value="hints">
              Hints {q.hints.revealed.length}/{q.hints.total}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="pane min-h-0 flex-1 overflow-auto p-4">
        {tab === "problem" && (
          <StatementView statementMd={q.statement_md} timeLimitMs={q.time_limit_ms} memoryLimitMb={q.memory_limit_mb} hiddenTestcases={q.hidden_testcases} samples={q.samples}
            onCopied={() => toast({ title: "Copied", tone: "info", duration: 1500 })} />
        )}
        {tab === "submissions" && <History history={q.history} sampleCount={q.sample_count} onRestore={(h) => { void api.get<{ source?: string }>(`/api/questions/${id}`); void h; }} />}
        {tab === "hints" && (
          <div className="space-y-3">
            {q.hints.total === 0 ? <EmptyState icon={<Icon.Lightbulb size={22} />} title="No hints for this question" /> : (
              <>
                {q.hints.revealed.map((h) => <div key={h.idx} className="rounded-box border border-line bg-page p-3 text-sm"><div className="mb-1 text-xs font-semibold text-faint">Hint {h.idx + 1} · bought for {h.price}</div><Markdown>{h.body_md}</Markdown></div>)}
                {q.hints.next ? (
                  <div className="rounded-box border border-dashed border-line-2 p-4 text-center">
                    <div className="text-sm">Hint {q.hints.next.idx + 1} of {q.hints.total}</div>
                    <div className="mb-3 text-xs text-muted-foreground">Author-written. Purchases are final.</div>
                    <Button size="sm" variant="outline" onClick={() => setHintDialog(true)}><Icon.Lightbulb /> Buy for {q.hints.next.price}</Button>
                  </div>
                ) : <p className="text-center text-xs text-faint">Every hint is revealed.</p>}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const codePane = (
    <div className="flex h-full flex-col bg-[#1e1e1e]">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2 text-white/80">
        <SimpleSelect
          className="w-44 border-white/20 bg-white/10 text-white hover:border-white/40 [&_svg]:text-white/60"
          value={language}
          aria-label="Language"
          onValueChange={(v) => {
            setLanguage(v);
            if (!source.trim()) setSource(TEMPLATE[v] ?? "");
          }}
          options={languages.length === 0 ? [{ value: language, label: language }] : languages.map((l) => ({ value: l.key, label: l.name }))}
        />
        <button className="rounded px-2 py-1 text-xs hover:bg-white/10" onClick={() => { if (confirm("Replace your code with the template?")) onChange(TEMPLATE[language] ?? ""); }}>Reset</button>
        <span className="flex items-center gap-1 text-xs"><button className="rounded px-1.5 hover:bg-white/10" onClick={() => setFontSize((f) => Math.max(11, f - 1))} aria-label="Smaller text">A−</button><button className="rounded px-1.5 hover:bg-white/10" onClick={() => setFontSize((f) => Math.min(20, f + 1))} aria-label="Larger text">A+</button></span>
        <span className={`ml-auto text-xs ${saved === "failed" ? "font-semibold text-red" : "text-white/50"}`} aria-live="polite">{saved === "saving" ? "Saving…" : saved === "saved" ? "Saved" : saved === "failed" ? "Not saved!" : ""}</span>
      </div>
      <div className="min-h-0 flex-1"><CodeEditor value={source} language={language} onChange={onChange} height="100%" fontSize={fontSize} /></div>
      {latest && (
        <div className="border-t border-white/10 bg-[#252526] text-white/90">
          <button className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-white/5" onClick={() => setPanel((p) => !p)} aria-expanded={panel}>
            <Icon.ChevronDown size={14} className={panel ? "" : "-rotate-90"} /> Latest verdict
            <span className="ml-auto"><VerdictBadge verdict={latest.state === "done" ? latest.verdict : null} /></span>
          </button>
          {panel && <VerdictPanel j={latest} sampleCount={q.sample_count} />}
        </div>
      )}
      <div className="flex items-center gap-3 border-t border-white/10 px-3 py-2">
        <span className="hidden text-xs text-white/50 sm:inline"><Kbd>Ctrl</Kbd> + <Kbd>Enter</Kbd> to submit</span>
        <div className="ml-auto flex items-center gap-2">
          {inFlight && <Button variant="ghost" size="sm" className="!text-white/70 hover:!bg-white/10" onClick={cancel}>Cancel</Button>}
          <Button onClick={submit} loading={busy || inFlight} disabled={!canSubmit}><Icon.Play /> 
            {inFlight ? "Judging…" : cooldown > 0 ? `Wait ${Math.ceil(cooldown / 1000)}s` : "Submit"}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="workspace">
      <SplitPane left={problemPane} right={codePane} storageKey="workspace" />
      <Modal open={hintDialog} onClose={() => setHintDialog(false)} title="Buy a hint">
        <p className="text-sm">Reveal hint <strong>{(q.hints.next?.idx ?? 0) + 1}</strong> for <strong>{q.hints.next?.price}</strong> coins? This cannot be undone.</p>
        <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setHintDialog(false)}>Cancel</Button><Button onClick={buyHint} loading={busy}>Buy for {q.hints.next?.price}</Button></div>
      </Modal>
    </div>
  );
}

function explain(j: Judgement, sampleCount: number): string {
  if (j.cancelled) return "Cancelled.";
  switch (j.verdict) {
    case "AC": return "Every testcase passed. This question is solved and stays solved.";
    case "WA": return `Wrong answer on test ${j.first_fail}.${j.first_fail !== null && j.first_fail < sampleCount ? " That is a sample — check your output format." : ""}`;
    case "TLE": return `Time limit exceeded on test ${j.first_fail}. Too slow for that input size.`;
    case "MLE": return `Memory limit exceeded on test ${j.first_fail}.`;
    case "OLE": return `Output limit exceeded on test ${j.first_fail} — far too much output.`;
    case "RE": return `Runtime error on test ${j.first_fail} — a crash or a non-zero exit code.`;
    case "CE": return "Compilation failed. See the compiler output.";
    case "IE": return "The judge failed on our side. Not counted against you — tell an organiser if it repeats.";
    default: return j.state === "queued" ? "Queued…" : `Running test ${j.progress.done}/${j.progress.total}…`;
  }
}

function VerdictPanel({ j, sampleCount }: { j: Judgement; sampleCount: number }) {
  return (
    <div className="max-h-48 overflow-auto px-3 pb-3 text-sm">
      <p>{explain(j, sampleCount)}</p>
      {j.state === "running" && <div className="mt-2 h-1.5 w-full rounded bg-white/10"><div className="h-1.5 rounded bg-green transition-[width]" style={{ width: `${j.progress.total ? (100 * j.progress.done) / j.progress.total : 0}%` }} /></div>}
      {j.state === "done" && j.verdict !== "CE" && <p className="mt-1 text-xs text-white/50">{j.passed}/{j.total} tests · {j.max_time_ms?.toFixed(0)} ms</p>}
      {j.verdict === "CE" && j.compile_output && <pre className="mt-2 max-h-32 overflow-auto rounded bg-black/40 p-2 text-xs text-red-300">{j.compile_output}</pre>}
    </div>
  );
}

function History({ history, sampleCount }: { history: Question["history"]; sampleCount: number; onRestore: (h: Question["history"][number]) => void }) {
  if (history.length === 0) return <EmptyState icon={<Icon.Code size={22} />} title="No submissions yet" body="Write your solution and press Submit — or Ctrl+Enter." />;
  return (
    <ol className="divide-y divide-line">
      {history.map((h, i) => (
        <li key={h.id} className="py-3 text-sm">
          <div className="flex items-center gap-3"><span className="w-6 text-xs text-faint">#{history.length - i}</span><VerdictBadge verdict={h.judgement.state === "done" ? h.judgement.verdict : null} /><span className="text-faint">{new Date(h.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })} · {h.language}</span>{h.judgement.max_time_ms ? <span className="ml-auto text-xs text-faint">{h.judgement.max_time_ms.toFixed(0)} ms</span> : null}</div>
          <div className="mt-1 pl-9 text-muted-foreground">{explain(h.judgement, sampleCount)}</div>
        </li>
      ))}
    </ol>
  );
}

function safeGet(key: string): { source: string; language: string; at: number } | null { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; } }
function safeSet(key: string, value: unknown) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* the server copy still saves */ } }
