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
import { cn } from "@/lib/utils";
import { useJudgement, type Judgement as LiveJudgement, type Stage } from "@/lib/use-judgement";

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

  /*
   * The newest submission is followed until it reaches a verdict. The SSE
   * stream is a nudge to look now rather than the thing being relied on: it is
   * the part that goes missing when a laptop sleeps or the hall's wifi hands a
   * machine to another access point, and "Judging…" that never resolves is the
   * worst thing this screen can do to someone.
   */
  const newest = q?.history[0] ?? null;
  const following = newest && newest.judgement.state !== "done" ? newest.id : null;
  const { judgement: live, stage, stalled, unreachable, poke } = useJudgement(following, newest?.judgement as LiveJudgement | null);

  useEffect(() => {
    if (lastEvent?.name === "balance") { void load(); return; }
    if (lastEvent?.name !== "verdict") return;
    const d = lastEvent.data as { submission_id?: number; rejudge?: boolean };
    // A verdict for something this page is not watching — another tab, or an
    // administrator rejudging the question — means the history is stale.
    if (d.rejudge || (d.submission_id !== undefined && d.submission_id !== following)) void load();
    else poke();
  }, [lastEvent, poke, load, following]);

  // One reload when it lands, for the things the narrow poll does not carry:
  // the history row, the question's status, the cooldown.
  const settled = useRef<number | null>(null);
  useEffect(() => {
    if (live?.state === "done" && settled.current !== live.id) { settled.current = live.id; void load(); }
  }, [live, load]);
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

  // The polled copy is fresher than the page load it came with.
  const latest = (live ?? q.history[0]?.judgement ?? null) as LiveJudgement | null;
  const solved = q.history.some((h) => h.judgement.verdict === "AC") || latest?.verdict === "AC";
  const inFlight = following !== null && stage !== "done";
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
                {q.hints.revealed.map((h) => <div key={h.idx} className="rounded-box border border-line bg-muted p-3 text-sm"><div className="mb-1 text-xs font-semibold text-faint">Hint {h.idx + 1} · bought for {h.price}</div><Markdown>{h.body_md}</Markdown></div>)}
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
        <ResultPanel j={latest} stage={following === null ? "done" : stage} stalled={stalled} unreachable={unreachable}
          sampleCount={q.sample_count} open={panel} onToggle={() => setPanel((p) => !p)} />
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

/**
 * What a verdict means, in words a competitor can act on.
 *
 * Never the abbreviation on its own: "TLE" teaches nothing to someone seeing
 * it for the first time, and a contest is not the place to learn the judge's
 * vocabulary. Where the failure is on a sample it says so, because that means
 * the output format is wrong rather than the algorithm.
 */
function explain(j: { verdict: string | null; state: string; first_fail: number | null; total: number | null; cancelled: boolean; progress: { done: number; total: number } }, sampleCount: number): string {
  if (j.cancelled) return "You cancelled this submission. It was not judged and does not count.";
  const at = j.first_fail !== null ? `test ${j.first_fail + 1}${j.total ? ` of ${j.total}` : ""}` : "a hidden test";
  const onSample = j.first_fail !== null && j.first_fail < sampleCount;
  switch (j.verdict) {
    case "AC": return "Every testcase passed. This question is solved, and it stays solved.";
    case "WA": return `Wrong answer on ${at}.${onSample ? " That is one of the samples — check your output format before your logic." : ""}`;
    case "TLE": return `Too slow on ${at}. The logic may be right; the complexity is not.`;
    case "MLE": return `Used too much memory on ${at}.`;
    case "OLE": return `Printed far too much on ${at} — check for a stray debug print or a loop that never ends.`;
    case "RE": return `Crashed on ${at} — an exception, a bad index, or a non-zero exit code.`;
    case "CE": return "It did not compile. The compiler's own output is below.";
    case "IE": return "The judge failed on our side. This is not counted against you — tell an organiser if it happens again.";
    default: return "";
  }
}

/** The five things that can be true, and how each one should look. */
const TONE: Record<string, { text: string; bar: string; label: string }> = {
  AC: { text: "text-green-bright", bar: "bg-green-bright", label: "Accepted" },
  WA: { text: "text-[#ff8a80]", bar: "bg-[#ff8a80]", label: "Wrong answer" },
  TLE: { text: "text-[#ff8a80]", bar: "bg-[#ff8a80]", label: "Time limit exceeded" },
  MLE: { text: "text-[#ff8a80]", bar: "bg-[#ff8a80]", label: "Memory limit exceeded" },
  OLE: { text: "text-[#ff8a80]", bar: "bg-[#ff8a80]", label: "Output limit exceeded" },
  RE: { text: "text-[#ff8a80]", bar: "bg-[#ff8a80]", label: "Runtime error" },
  CE: { text: "text-[#ffcc66]", bar: "bg-[#ffcc66]", label: "Compile error" },
  IE: { text: "text-white/70", bar: "bg-white/40", label: "Judge error" },
};

const STAGE_LABEL: Record<Stage, string> = {
  sending: "Sending to the judge",
  queued: "Queued — waiting for a free slot",
  running: "Running",
  done: "",
  gone: "",
};

/**
 * The live state of the newest submission, in the code pane's footer.
 *
 * While it runs this is the only thing on screen that changes, so it says
 * which stage it is at and how far through — a bar that fills is the
 * difference between "it is working" and "it has hung". When it lands it
 * becomes the verdict and stops moving.
 */
function ResultPanel({ j, stage, stalled, unreachable, sampleCount, open, onToggle }: {
  j: LiveJudgement; stage: Stage; stalled: boolean; unreachable: boolean; sampleCount: number; open: boolean; onToggle: () => void;
}) {
  const running = stage !== "done";
  const tone = j.verdict ? TONE[j.verdict] : null;
  const pct = j.progress.total ? Math.round((100 * j.progress.done) / j.progress.total) : 0;

  return (
    <div className="shrink-0 border-t border-white/10 bg-[#252526] text-white/90">
      <button className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] hover:bg-white/5" onClick={onToggle} aria-expanded={open}>
        <Icon.ChevronDown size={14} className={open ? "" : "-rotate-90"} />
        {running ? (
          <>
            <Icon.Spinner size={13} className="text-brand-bright" />
            <span className="font-semibold">
              {stage === "running" && j.progress.total ? `Running test ${Math.min(j.progress.done + 1, j.progress.total)} of ${j.progress.total}` : STAGE_LABEL[stage]}
            </span>
          </>
        ) : (
          <>
            <span className={cn("size-1.5 rounded-full", tone?.bar ?? "bg-white/40")} />
            <span className={cn("font-semibold", tone?.text ?? "text-white/80")}>{j.cancelled ? "Cancelled" : (tone?.label ?? j.verdict ?? "Pending")}</span>
          </>
        )}
        <span className="ml-auto text-[11.5px] num text-white/45">
          {!running && j.verdict !== "CE" && j.total ? `${j.passed}/${j.total} tests` : ""}
          {!running && j.max_time_ms ? ` · ${j.max_time_ms.toFixed(0)} ms` : ""}
        </span>
      </button>

      {/* The bar lives outside the collapsible part: someone who has folded the
          panel away still needs to know whether anything is happening. */}
      {running && (
        <div className="h-0.5 w-full bg-white/10">
          <div className="h-0.5 bg-brand-bright transition-[width] duration-300" style={{ width: `${stage === "running" ? Math.max(4, pct) : 2}%` }} />
        </div>
      )}

      {open && (
        <div className="max-h-48 overflow-auto px-3 pb-3 text-[12.5px]">
          {running ? (
            <p className="text-white/60">
              {stalled
                ? "Still waiting on the judge. Nothing is lost — it is queued and will be judged."
                : unreachable
                  ? "Lost contact with the server for a moment. Still trying; your submission is safe."
                  : "Your submission is with the judge. You can keep editing while it runs."}
            </p>
          ) : (
            <>
              <p className="text-white/80">{explain(j, sampleCount)}</p>
              {j.verdict === "CE" && j.compile_output && (
                <pre className="mt-2 max-h-32 overflow-auto rounded bg-black/40 p-2 text-[11.5px] leading-relaxed whitespace-pre-wrap text-[#ffcc66]">
                  {j.compile_output}
                </pre>
              )}
            </>
          )}
        </div>
      )}
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
