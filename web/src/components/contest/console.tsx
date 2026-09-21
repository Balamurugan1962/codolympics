"use client";

/**
 * The console under the editor: test cases on one tab, the verdict on the other.
 *
 * "Test cases" is where code is tried before it is submitted: the samples from
 * the statement, plus an input of your own. A run is the code compiled once
 * and executed on each input under the real limits, with nothing at stake: no
 * verdict on the record, no cooldown, no coins. Everything that comes back is
 * the program's own doing, so all of it is shown: stdout, stderr, the
 * compiler's complaint. Hidden tests are never run here.
 *
 * "Result" is the newest submission, followed from "sent" to a verdict. While
 * it runs this is the only thing on screen that changes, so it says which
 * stage it is at and how far through; a bar that fills is the difference
 * between "it is working" and "it has hung".
 */
import { useCallback, useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { VERDICTS } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage } from "@/lib/client";
import { useFollow, type Judgement, type Stage } from "@/lib/use-judgement";
import { cn } from "@/lib/utils";

export type RunOutput = { verdict: string; stdout: string; stderr: string; time_ms: number; memory_kb: number };
export type Run = {
  id: number;
  state: "pending" | "queued" | "running" | "done";
  verdict: string | null;
  message: string | null;
  compile_output: string;
  outputs: RunOutput[] | null;
};

/**
 * Starts a run and follows it to the end. One at a time: the server refuses a
 * second while the first is going, and the button is disabled to match.
 */
export function useRun(questionId: string) {
  const [runId, setRunId] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const { value: run, gone } = useFollow<Run>(runId === null ? null : `/api/runs/${runId}`, {
    signature: (r) => `${r.state}:${r.verdict ?? ""}`,
    finished: (r) => r.state === "done",
  });

  const start = useCallback(async (language: string, source: string, customInput: string | null) => {
    setSending(true);
    try {
      const { id } = await api.post<{ id: number }>(`/api/questions/${questionId}/run`, { language, source, custom_input: customInput });
      setRunId(id);
    } catch (err) {
      throw new Error(errorMessage(err));
    } finally {
      setSending(false);
    }
  }, [questionId]);

  const busy = sending || (runId !== null && !gone && (run === null || run.state !== "done"));
  return { run, sending, busy, start };
}

/** The verdicts on a dark surface: the badge's words, the console's colours. */
const DARK: Record<string, { text: string; dot: string }> = {
  success: { text: "text-green-bright", dot: "bg-green-bright" },
  destructive: { text: "text-[#ff8a80]", dot: "bg-[#ff8a80]" },
  warning: { text: "text-[#ffcc66]", dot: "bg-[#ffcc66]" },
  neutral: { text: "text-white/70", dot: "bg-white/40" },
};

function tone(verdict: string | null | undefined): { text: string; dot: string; label: string } | null {
  if (!verdict) return null;
  const v = VERDICTS[verdict];
  return { ...DARK[v?.variant ?? "destructive"], label: v?.label ?? verdict };
}

const STAGE_LABEL: Record<Stage, string> = {
  sending: "Sending to the judge",
  queued: "Queued, waiting for a free slot",
  running: "Running",
  done: "",
  gone: "",
};

/**
 * What a verdict means, in words a competitor can act on.
 *
 * Never the abbreviation on its own: "TLE" teaches nothing to someone seeing
 * it for the first time, and a contest is not the place to learn the judge's
 * vocabulary. Where the failure is on a sample it says so, because that means
 * the output format is wrong rather than the algorithm.
 */
export function explain(j: { verdict: string | null; first_fail: number | null; total: number | null; cancelled: boolean }, sampleCount: number): string {
  if (j.cancelled) return "You cancelled this submission. It was not judged and does not count.";
  const at = j.first_fail !== null ? `test ${j.first_fail + 1}${j.total ? ` of ${j.total}` : ""}` : "a hidden test";
  const onSample = j.first_fail !== null && j.first_fail < sampleCount;
  switch (j.verdict) {
    case "AC": return "Every testcase passed. This question is solved, and it stays solved.";
    case "WA": return `Wrong answer on ${at}.${onSample ? " That is one of the samples. Check your output format before your logic." : ""}`;
    case "TLE": return `Too slow on ${at}. The logic may be right; the complexity is not.`;
    case "MLE": return `Used too much memory on ${at}.`;
    case "OLE": return `Printed far too much on ${at}. Check for a stray debug print or a loop that never ends.`;
    case "RE": return `Crashed on ${at}: an exception, a bad index, or a non-zero exit code.`;
    case "CE": return "It did not compile. The compiler's own output is below.";
    case "IE": return "The judge failed on our side. This is not counted against you. Tell an organiser if it happens again.";
    default: return "";
  }
}

export type ConsoleTab = "tests" | "result";
type Sample = { input: string; output: string };

/** The test-cases tab: what is run, and what the last run said. */
export type Tests = { run: Run | null; sending: boolean; samples: Sample[]; customInput: string; onCustomInput: (v: string) => void };
/** The result tab: the newest submission as `useJudgement` follows it. */
export type Verdict = { judgement: Judgement | null; stage: Stage; stalled: boolean; unreachable: boolean };

export function Console({ tab, onTab, open, onToggle, tests, verdict }: {
  tab: ConsoleTab;
  onTab: (t: ConsoleTab) => void;
  open: boolean;
  onToggle: () => void;
  tests: Tests;
  verdict: Verdict;
}) {
  const { run, sending, samples } = tests;
  const { judgement, stage } = verdict;
  const running = sending || (run !== null && run.state !== "done");
  const done = run?.state === "done" ? run : null;
  const judging = judgement !== null && stage !== "done";
  const passed = done?.outputs ? done.outputs.slice(0, samples.length).filter((o) => o.verdict === "AC").length : null;
  const verdictTone = tone(judgement?.verdict);
  const pct = judgement?.progress.total ? Math.round((100 * judgement.progress.done) / judgement.progress.total) : 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col border-t border-white/10 bg-[#252526] text-white/90">
      <div className="flex shrink-0 items-center gap-1 px-2 text-[12px]">
        <button className="rounded p-1 hover:bg-white/10" onClick={onToggle} aria-label={open ? "Collapse the console" : "Expand the console"} aria-expanded={open}>
          <Icon.ChevronDown size={14} className={open ? "" : "-rotate-90"} />
        </button>
        <ConsoleTabButton active={tab === "tests"} onClick={() => { onTab("tests"); if (!open) onToggle(); }}>
          {running ? <Icon.Spinner size={12} className="text-brand-bright" /> : <Icon.Terminal size={12} className="text-white/50" />}
          Test cases
          {passed !== null && samples.length > 0 && (
            <span className={cn("tabular-nums", passed === samples.length ? "text-green-bright" : "text-[#ff8a80]")}>{passed}/{samples.length}</span>
          )}
          {done?.verdict === "CE" && <span className="size-1.5 rounded-full bg-[#ffcc66]" />}
        </ConsoleTabButton>
        <ConsoleTabButton active={tab === "result"} onClick={() => { onTab("result"); if (!open) onToggle(); }}>
          {judging ? <Icon.Spinner size={12} className="text-brand-bright" /> : <span className={cn("size-1.5 rounded-full", verdictTone?.dot ?? "bg-white/30")} />}
          Result
          {!judging && judgement && <span className={verdictTone?.text}>{judgement.cancelled ? "Cancelled" : (verdictTone?.label ?? "")}</span>}
        </ConsoleTabButton>
        <span className="ml-auto pr-1 text-[11.5px] tabular-nums text-white/45">
          {tab === "tests" ? testsStatus(run, running) : resultStatus(judgement, stage)}
        </span>
      </div>

      {/* The bar lives outside the collapsible part: someone who has folded the
          console away still needs to know whether anything is happening. */}
      {judging && (
        <div className="h-0.5 w-full shrink-0 bg-white/10">
          <div className="h-0.5 bg-brand-bright transition-[width] duration-300" style={{ width: `${stage === "running" ? Math.max(4, pct) : 2}%` }} />
        </div>
      )}

      {open && (
        <div className="pane min-h-0 flex-1 overflow-auto px-3 pb-3 text-[12.5px]">
          {tab === "tests" ? (
            <TestCases tests={tests} done={done} running={running} />
          ) : judgement ? (
            <VerdictBody verdict={{ ...verdict, judgement }} sampleCount={samples.length} />
          ) : (
            <p className="pt-2 text-white/50">Nothing submitted yet. Try the samples first; Submit when they pass.</p>
          )}
        </div>
      )}
    </div>
  );
}

function testsStatus(run: Run | null, running: boolean): string {
  if (running) return run?.state === "running" ? "Running" : "Queued";
  if (run?.state === "done" && run.outputs?.length) return `${Math.max(...run.outputs.map((o) => o.time_ms)).toFixed(0)} ms`;
  return "Nothing here is scored";
}

function resultStatus(j: Judgement | null, stage: Stage): string {
  if (!j) return "";
  if (stage !== "done") {
    if (stage === "running" && j.progress.total) return `Test ${Math.min(j.progress.done + 1, j.progress.total)} of ${j.progress.total}`;
    return STAGE_LABEL[stage];
  }
  if (j.verdict === "CE" || !j.total) return "";
  return `${j.passed}/${j.total} tests${j.max_time_ms ? ` · ${j.max_time_ms.toFixed(0)} ms` : ""}`;
}

function ConsoleTabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button role="tab" aria-selected={active} onClick={onClick}
      className={cn("flex items-center gap-1.5 border-b-2 px-2 py-2 font-semibold", active ? "border-brand-bright text-white" : "border-transparent text-white/60 hover:text-white")}>
      {children}
    </button>
  );
}

function TestCases({ tests, done, running }: { tests: Tests; done: Run | null; running: boolean }) {
  const { samples, customInput, onCustomInput } = tests;
  const cases = [...samples.map((_, i) => `Sample ${i + 1}`), "Custom"];
  const [which, setWhich] = useState(0);
  // A finished run opens on its first failure, which is what you want to read.
  useEffect(() => {
    const firstFail = done?.outputs?.findIndex((o) => o.verdict !== "AC") ?? -1;
    if (firstFail >= 0) setWhich(firstFail);
  }, [done]);

  const isCustom = which >= samples.length;
  const out = done?.outputs?.[which] ?? null;
  // Nothing ran: the same complaint stands in for every case's output.
  const failure =
    done?.verdict === "CE" ? { tone: "text-[#ffcc66]", text: done.compile_output || "The compiler gave no output." }
    : done?.verdict === "IE" ? { tone: "text-white/70", text: done.message ?? "The judge could not run it. Nothing is lost; try again." }
    : null;

  return (
    <>
      <div className="mb-2 flex flex-wrap gap-1 pt-2">
        {cases.map((label, i) => {
          const t = tone(done?.outputs?.[i]?.verdict);
          return (
            <button key={label} onClick={() => setWhich(i)} aria-pressed={which === i}
              className={cn("flex items-center gap-1.5 rounded px-2 py-1 text-[11.5px]", which === i ? "bg-white/15 text-white" : "text-white/60 hover:bg-white/10 hover:text-white")}>
              {t && <span className={cn("size-1.5 rounded-full", t.dot)} />}
              {label}
            </button>
          );
        })}
      </div>
      {isCustom ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Input">
            <Textarea value={customInput} onChange={(e) => onCustomInput(e.target.value)} spellCheck={false}
              placeholder={samples[0]?.input.trim() ? `e.g.\n${samples[0].input.trim()}` : "Your input"}
              className="min-h-24 border-white/15 bg-black/40 font-mono text-[12px] text-white placeholder:text-white/30 hover:border-white/30 focus-visible:border-brand-bright" />
          </Field>
          <Output out={out} failure={failure} running={running} placeholder="Run to see what your program prints." />
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-3">
          <Field label="Input"><Mono>{samples[which]?.input}</Mono></Field>
          <Field label="Expected"><Mono>{samples[which]?.output}</Mono></Field>
          <Output out={out} failure={failure} running={running} placeholder="Run to compare." />
        </div>
      )}
    </>
  );
}

function VerdictBody({ verdict: { judgement: j, stage, stalled, unreachable }, sampleCount }: { verdict: Verdict & { judgement: Judgement }; sampleCount: number }) {
  if (stage !== "done") {
    return (
      <p className="pt-2 text-white/60">
        {stalled
          ? "Still waiting on the judge. Nothing is lost. It is queued and will be judged."
          : unreachable
            ? "Lost contact with the server for a moment. Still trying; your submission is safe."
            : "Your submission is with the judge. You can keep editing while it runs."}
      </p>
    );
  }
  const t = tone(j.verdict);
  return (
    <div className="pt-2">
      <p className={cn("font-semibold", t?.text ?? "text-white/80")}>{j.cancelled ? "Cancelled" : (t?.label ?? "Pending")}</p>
      <p className="mt-1 text-white/80">{explain(j, sampleCount)}</p>
      {j.verdict === "CE" && j.compile_output && <Mono tone="mt-2 text-[#ffcc66]">{j.compile_output}</Mono>}
    </div>
  );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center gap-2 text-[10.5px] font-semibold tracking-[0.08em] text-white/45 uppercase">{label}</div>
      {children}
    </div>
  );
}

function Mono({ children, tone }: { children?: string | null; tone?: string }) {
  return <pre className={cn("max-h-48 min-h-9 overflow-auto rounded bg-black/40 p-2 font-mono text-[12px] leading-relaxed whitespace-pre-wrap", tone)}>{children || ""}</pre>;
}

/** What the program printed, and how the run of it went. */
function Output({ out, failure, running, placeholder }: { out: RunOutput | null; failure: { tone: string; text: string } | null; running: boolean; placeholder: string }) {
  const t = tone(out?.verdict);
  const label = out?.verdict === "AC" ? "Passed" : t?.label;
  return (
    <Field label={<>Your output{label && <span className={cn("normal-case tracking-normal", t?.text)}>{label}{out?.time_ms ? ` · ${out.time_ms.toFixed(0)} ms` : ""}</span>}</>}>
      {failure ? (
        <Mono tone={failure.tone}>{failure.text}</Mono>
      ) : out ? (
        <>
          <Mono tone={out.verdict === "AC" ? undefined : "text-[#ffb3ad]"}>{out.stdout}</Mono>
          {out.stderr && <Mono tone="mt-1 text-[#ffcc66]">{out.stderr}</Mono>}
        </>
      ) : (
        <div className="flex min-h-9 items-center rounded bg-black/20 px-2 text-[12px] text-white/40">{running ? "Running…" : placeholder}</div>
      )}
    </Field>
  );
}
