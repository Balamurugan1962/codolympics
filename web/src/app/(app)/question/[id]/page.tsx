"use client";

/**
 * The workspace: problem on the left, code on the right, verdict underneath,
 * no page scroll -- the way an IDE is laid out. Ctrl/Cmd+Enter submits.
 * Drafts autosave to the server so a machine swap finds them (US-F5-03).
 */
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { useContest, useEngineEvent } from "@/components/contest-provider";
import { Console, type ConsoleTab, explain, useRun } from "@/components/contest/console";
import { Icon } from "@/components/icons";
import { Markdown } from "@/components/markdown";
import { StatementView } from "@/components/problems/statement-view";
import { Badge, VerdictBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { SimpleCombobox } from "@/components/ui/combobox";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { SplitPane, VerticalSplit } from "@/components/ui/split-pane";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/client";
import { cn } from "@/lib/utils";
import { useJudgement, type Judgement as LiveJudgement } from "@/lib/use-judgement";
import { difficultyLabel, difficultyVariant } from "@/lib/difficulty";

const CodeEditor = dynamic(() => import("@/components/editor").then((m) => m.CodeEditor), { ssr: false, loading: () => <div className="h-full bg-[#1e1e1e]" /> });

type Judgement = { id: number; state: string; verdict: string | null; passed: number | null; total: number | null; failed_on_sample: boolean | null; max_time_ms: number | null; compile_output: string | null; message: string | null; progress: { done: number; total: number }; cancelled: boolean; created_at: string };
type Question = {
  id: string; title: string; difficulty: string | null; score: number | null; common?: boolean; status: string; statement_md: string;
  time_limit_ms: number | null; memory_limit_mb: number | null; hidden_testcases: number | null; sample_count: number;
  samples: { input: string; output: string }[];
  hints: { total: number; revealed: { idx: number; body_md: string; price: number }[]; next: { idx: number; price: number } | null };
  history: { id: number; language: string; created_at: string; judgement: Judgement }[];
  // Newest first: the first is the language they were last writing in.
  drafts: { source: string; language: string; updated_at: string }[];
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
  const { state, serverNow } = useContest();
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
  const [resetDialog, setResetDialog] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [consoleTab, setConsoleTab] = useState<ConsoleTab>("tests");
  const [customInput, setCustomInput] = useState("");
  const { run, sending, busy: running, start: startRun } = useRun(id);
  // What was written in each language, so switching back brings it up again.
  const codeByLang = useRef<Record<string, string>>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedDraft = useRef(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get<Question>(`/api/questions/${id}`);
      setQ(data);
      if (!loadedDraft.current) {
        loadedDraft.current = true;
        // The server copy of each language, then anything newer this browser kept.
        for (const d of data.drafts) {
          const local = safeGet(`draft:${id}:${d.language}`);
          codeByLang.current[d.language] = local && local.at > Date.parse(d.updated_at) ? local.source : d.source;
        }
        const lang = data.drafts[0]?.language ?? preferred;
        setLanguage(lang);
        setSource(codeByLang.current[lang] ?? TEMPLATE[lang] ?? TEMPLATE.cpp);
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

  useEngineEvent(["balance", "verdict"], (event) => {
    if (event.name === "balance") { void load(); return; }
    const d = event.data as { submission_id?: number; rejudge?: boolean };
    // A verdict for something this page is not watching, another tab or an
    // administrator rejudging the question, means the history is stale.
    if (d.rejudge || (d.submission_id !== undefined && d.submission_id !== following)) void load();
    else poke();
  });

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
    codeByLang.current[language] = next;
    safeSet(`draft:${id}:${language}`, { source: next, at: Date.now() });
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
    try { await api.post("/api/submissions", { question_id: id, language, source }); setTab("submissions"); setConsoleTab("result"); setConsoleOpen(true); await load(); }
    catch (err) { toast({ title: "Not submitted", description: errorMessage(err), tone: "error" }); }
    finally { setBusy(false); }
  }, [q, id, language, source, load, toast]);

  const runSamples = useCallback(async () => {
    if (!q || running) return;
    setConsoleTab("tests"); setConsoleOpen(true);
    try { await startRun(language, source, customInput.trim() === "" ? null : customInput); }
    catch (err) { toast({ title: "Not run", description: errorMessage(err), tone: "error" }); }
  }, [q, running, startRun, language, source, customInput, toast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === "Enter") { e.preventDefault(); void submit(); }
      if (e.key === "'") { e.preventDefault(); void runSamples(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submit, runSamples]);

  async function cancel() { try { await api.del("/api/submissions/current"); await load(); } catch (err) { toast({ title: "Could not cancel", description: errorMessage(err), tone: "error" }); } }
  async function buyHint() {
    setBusy(true);
    // Naming the hint being bought makes a double click buy it once, not this one and the next.
    try { const h = await api.post<{ idx: number; balance: number }>(`/api/questions/${id}/hints`, { idx: q?.hints.next?.idx }); setHintDialog(false); toast({ title: `Hint ${h.idx + 1} revealed`, description: `Balance now ${h.balance}.`, tone: "success" }); setTab("hints"); await load(); }
    catch (err) { toast({ title: "Not bought", description: errorMessage(err), tone: "error" }); }
    finally { setBusy(false); }
  }

  if (error) return <div className="p-6"><EmptyState icon={<Icon.Lock size={22} />} title="You don't own this question" body={error} action={<Link href="/dashboard"><Button variant="outline" size="sm">Back to home</Button></Link>} /></div>;
  if (!q) return <WorkspaceSkeleton />;

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
        {q.difficulty && <Badge variant={difficultyVariant(q.difficulty)}>{difficultyLabel(q.difficulty)}</Badge>}
        {q.score !== null && <Badge variant="neutral">{q.score} pts</Badge>}
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
          <StatementView title={q.title} statementMd={q.statement_md} timeLimitMs={q.time_limit_ms} memoryLimitMb={q.memory_limit_mb} hiddenTestcases={q.hidden_testcases} samples={q.samples}
            onCopied={() => toast({ title: "Copied", tone: "info", duration: 1500 })} />
        )}
        {tab === "submissions" && <History history={q.history} onRestore={(h) => { void api.get<{ source?: string }>(`/api/questions/${id}`); void h; }} />}
        {tab === "hints" && (
          <div className="space-y-3">
            {q.hints.total === 0 ? <EmptyState icon={<Icon.Lightbulb size={22} />} title="No hints for this question" /> : (
              <>
                {q.hints.revealed.map((h) => <div key={h.idx} className="rounded-box border border-line bg-muted p-3 text-sm"><div className="mb-1 text-xs font-semibold text-faint">Hint {h.idx + 1} · bought for {h.price}</div><Markdown className="problem-statement compact">{h.body_md}</Markdown></div>)}
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
        <SimpleCombobox
          className="w-44 [&_svg]:text-white/60"
          inputClassName="border-white/20 bg-white/10 text-white hover:border-white/40 focus-visible:border-brand-bright"
          value={language}
          aria-label="Language"
          onValueChange={(v) => {
            // Each language keeps its own code: first the boilerplate, then
            // whatever was last written in it. Saving on the switch makes it
            // the newest draft, so a reload opens in the language left selected.
            codeByLang.current[language] = source;
            const next = codeByLang.current[v] ?? TEMPLATE[v] ?? "";
            setLanguage(v);
            setSource(next);
            void api.put(`/api/drafts/${id}`, { source: next, language: v }).catch(() => undefined);
          }}
          options={languages.length === 0 ? [{ value: language, label: language }] : languages.map((l) => ({ value: l.key, label: l.name }))}
        />
        <button className="rounded px-2 py-1 text-xs hover:bg-white/10" onClick={() => setResetDialog(true)}>Reset</button>
        <span className="flex items-center gap-1 text-xs"><button className="rounded px-1.5 hover:bg-white/10" onClick={() => setFontSize((f) => Math.max(11, f - 1))} aria-label="Smaller text">A−</button><button className="rounded px-1.5 hover:bg-white/10" onClick={() => setFontSize((f) => Math.min(20, f + 1))} aria-label="Larger text">A+</button></span>
        <span className={`ml-auto text-xs ${saved === "failed" ? "font-semibold text-red" : "text-white/50"}`} aria-live="polite">{saved === "saving" ? "Saving…" : saved === "saved" ? "Saved" : saved === "failed" ? "Not saved!" : ""}</span>
      </div>
      <VerticalSplit storageKey="console" open={consoleOpen}
        top={<CodeEditor value={source} language={language} onChange={onChange} height="100%" fontSize={fontSize} theme="dark" />}
        bottom={
          <Console tab={consoleTab} onTab={setConsoleTab} open={consoleOpen} onToggle={() => setConsoleOpen((o) => !o)}
            tests={{ run, sending, samples: q.samples, customInput, onCustomInput: setCustomInput }}
            verdict={{ judgement: latest, stage: following === null ? "done" : stage, stalled, unreachable }} />
        } />
      <div className="flex items-center gap-3 border-t border-white/10 px-3 py-2">
        <span className="hidden text-xs text-white/50 sm:inline"><Kbd>Ctrl</Kbd> + <Kbd>'</Kbd> to run, <Kbd>Ctrl</Kbd> + <Kbd>Enter</Kbd> to submit</span>
        <div className="ml-auto flex items-center gap-2">
          {inFlight && <Button variant="ghost" size="sm" className="!text-white/70 hover:!bg-white/10" onClick={cancel}>Cancel</Button>}
          <Button variant="outline" className="border-white/20 bg-transparent !text-white hover:!bg-white/10" onClick={runSamples} loading={running} disabled={running || q.status === "void"}>
            <Icon.Terminal /> {running ? "Running…" : "Run"}
          </Button>
          <Button onClick={submit} loading={busy || inFlight} disabled={!canSubmit}><Icon.Play />
            {inFlight ? "Judging…" : cooldown > 0 ? `Wait ${Math.ceil(cooldown / 1000)}s` : "Submit"}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <Workspace>
      <SplitPane left={problemPane} right={codePane} storageKey="workspace" />
      <Modal open={resetDialog} onClose={() => setResetDialog(false)} title="Start this language over?">
        <p className="text-sm">Your {languages.find((l) => l.key === language)?.name ?? language} code for this question is replaced with the blank template. Other languages keep theirs. This cannot be undone.</p>
        <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setResetDialog(false)}>Keep my code</Button><Button variant="destructive" onClick={() => { onChange(TEMPLATE[language] ?? ""); setResetDialog(false); }}>Reset</Button></div>
      </Modal>
      <Modal open={hintDialog} onClose={() => setHintDialog(false)} title="Buy a hint">
        <p className="text-sm">Reveal hint <strong>{(q.hints.next?.idx ?? 0) + 1}</strong> for <strong>{q.hints.next?.price}</strong> coins? This cannot be undone.</p>
        <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setHintDialog(false)}>Cancel</Button><Button onClick={buyHint} loading={busy}>Buy for {q.hints.next?.price}</Button></div>
      </Modal>
    </Workspace>
  );
}

/**
 * Fills the viewport below whatever the shell put above it. The shell can add
 * a banner (connection lost, disqualified) at any moment, so the top edge is
 * measured rather than assumed, and re-measured when the page or window
 * changes size.
 */
function Workspace({ className, ...props }: React.ComponentProps<"div">) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => el.style.setProperty("--workspace-top", `${Math.round(el.getBoundingClientRect().top + window.scrollY)}px`);
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(document.body);
    window.addEventListener("resize", measure);
    return () => { watch.disconnect(); window.removeEventListener("resize", measure); };
  }, []);
  return <div ref={ref} className={cn("workspace", className)} {...props} />;
}

function History({ history }: { history: Question["history"]; onRestore: (h: Question["history"][number]) => void }) {
  if (history.length === 0) return <EmptyState icon={<Icon.Code size={22} />} title="No submissions yet" body="Write your solution and press Submit, or Ctrl+Enter." />;
  return (
    <ol className="divide-y divide-line">
      {history.map((h, i) => (
        <li key={h.id} className="py-3 text-sm">
          <div className="flex items-center gap-3"><span className="w-6 text-xs text-faint">#{history.length - i}</span><VerdictBadge verdict={h.judgement.state === "done" ? h.judgement.verdict : null} /><span className="text-faint">{new Date(h.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })} · {h.language}</span>{h.judgement.max_time_ms ? <span className="ml-auto text-xs text-faint">{h.judgement.max_time_ms.toFixed(0)} ms</span> : null}</div>
          <div className="mt-1 pl-9 text-muted-foreground">{explain(h.judgement)}</div>
        </li>
      ))}
    </ol>
  );
}

function safeGet(key: string): { source: string; at: number } | null { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; } }
function safeSet(key: string, value: unknown) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* the server copy still saves */ } }

/**
 * The workspace, waiting.
 *
 * Two grey rectangles told a competitor nothing and then jumped into a
 * completely different screen. This is the real thing with the words taken
 * out: the statement pane on the left with its header and tabs, the editor
 * dark on the right. The dark half matters most — the editor is the one
 * surface that would otherwise flash white and then go black.
 */
function WorkspaceSkeleton() {
  return (
    <Workspace className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" role="status" aria-label="Loading" aria-busy>
      <div className="flex h-full flex-col border-r bg-card">
        <div className="flex items-center gap-3 border-b px-4 py-2.5">
          <Skeleton className="size-4" />
          <Skeleton className="h-3 w-44" />
          <Skeleton className="h-4 w-12" />
        </div>
        <div className="flex gap-5 border-b px-4 py-2.5">
          <Skeleton className="h-2.5 w-14" />
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="h-2.5 w-12" />
        </div>
        <div className="space-y-2.5 p-4">
          <Skeleton className="h-2.5 w-full" />
          <Skeleton className="h-2.5 w-11/12" />
          <Skeleton className="h-2.5 w-4/5" />
          <Skeleton className="mt-5 h-2.5 w-24" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="mt-4 h-2.5 w-28" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
      <div className="flex h-full flex-col bg-[#1e1e1e]">
        <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
          <div className="h-7 w-44 animate-pulse rounded-[3px] bg-white/10" />
          <div className="h-4 w-12 animate-pulse rounded-[3px] bg-white/5" />
        </div>
        <div className="min-h-0 flex-1 space-y-2.5 p-4">
          {[11, 8, 6, 9, 5, 10, 7].map((w, i) => (
            <div key={i} className="h-2.5 animate-pulse rounded-[3px] bg-white/5" style={{ width: `${w * 6}%` }} />
          ))}
        </div>
        {/* The console and the submit bar are the editor's floor. Without them
            here the editor fills the pane and then shrinks when they arrive. */}
        <div className="h-[38%] shrink-0 border-t border-white/10 bg-[#252526] px-3 pt-2">
          <div className="flex gap-3"><div className="h-4 w-20 animate-pulse rounded-[3px] bg-white/10" /><div className="h-4 w-14 animate-pulse rounded-[3px] bg-white/5" /></div>
        </div>
        <div className="flex shrink-0 items-center gap-3 border-t border-white/10 px-3 py-2">
          <div className="hidden h-4 w-40 animate-pulse rounded-[3px] bg-white/5 sm:block" />
          <div className="ml-auto h-9 w-24 animate-pulse rounded-[3px] bg-white/10" />
        </div>
      </div>
    </Workspace>
  );
}
