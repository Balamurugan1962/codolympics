"use client";

/**
 * The body of one judge request, by kind.
 *
 * The kinds do not share a body, because they do not share a question. For a
 * submission you want the code and the testcase it died on; for a hack you
 * want the input the participant crafted and the solution it was aimed at;
 * for a practice run you want each input beside what came out; for a
 * validator run you want the entries it was asked to check. Forcing them all
 * through one layout would mean columns that are empty most of the time.
 */
import { Code } from "@/components/admin/timeline";
import { Icon } from "@/components/icons";
import { Badge, VerdictBadge } from "@/components/ui/badge";
import { Section } from "@/components/ui/page";
import { Skeleton } from "@/components/ui/skeleton";
import { Summary, SummaryItem } from "@/components/ui/summary";
import { languageName } from "@/lib/languages";

export type Envelope = {
  kind: "submission" | "hack" | "run" | "validator";
  who: { id: string; name: string };
  submitted_at: string;
  target: { title: string; problem_id: string | null; question_id: string | number | null };
  language: string | null;
  request: {
    job_id: string | null;
    state: string;
    attempt: number | null;
    retries: number;
    cancelled: boolean;
    superseded_at: string | null;
    problem_version: string | null;
    created_at: string;
    ended_at: string | null;
  };
};

export type SubmissionDetail = Envelope & {
  kind: "submission";
  source: string;
  result: {
    verdict: string | null;
    passed: number | null;
    total: number | null;
    first_fail: number | null;
    max_time_ms: number | null;
    max_memory_kb: number | null;
    message: string | null;
    jury_detail: string | null;
    compile_output: string | null;
    progress: { done: number; total: number };
  };
  failing_testcase: { input: string; answer: string; truncated: boolean; version: string } | null;
  attempts: { id: number; attempt: number; verdict: string | null; state: string; createdAt: string }[];
};

export type HackDetail = Envelope & {
  kind: "hack";
  input: string;
  source: string;
  result: {
    valid_input: boolean | null;
    invalid_reason: string | null;
    hacked: boolean | null;
    verdict: string | null;
    /** The judge's own words. When the verdict is a judge error, this is the error. */
    message: string | null;
    points_awarded: number;
    outcome: string | null;
  };
  stakes: { hack_points: number; fail_penalty: number };
};

export type RunOutput = { verdict: string; stdout: string; stderr: string; time_ms: number; memory_kb: number };
export type RunDetail = Envelope & {
  kind: "run";
  /** Null for a run from before these were kept. */
  source: string | null;
  custom_input: string | null;
  sample_count: number;
  result: { verdict: string | null; message: string | null; compile_output: string; outputs: RunOutput[] | null };
};

export type ValidatorDetail = Envelope & {
  kind: "validator";
  entries: string[];
  result: { score: number | null; points_per_entry: number | null; error: string | null };
};

export type Detail = SubmissionDetail | HackDetail | RunDetail | ValidatorDetail;

export function SubmissionBody({ d }: { d: SubmissionDetail }) {
  const r = d.result;
  return (
    <>
      <Section title="The verdict">
        <div className="flex flex-wrap items-center gap-2">
          <VerdictBadge verdict={d.request.state === "done" ? r.verdict : null} />
          {d.request.state !== "done" && r.progress.total > 0 && (
            <span className="text-[12.5px] text-muted-foreground">
              test {r.progress.done} of {r.progress.total}
            </span>
          )}
        </div>
        {r.message && <p className="mt-2 text-[13px]">{r.message}</p>}
        {r.jury_detail && (
          <p className="mt-1.5 font-mono text-[11.5px] text-red" title="Jury detail, never sent to a participant">
            {r.jury_detail}
          </p>
        )}
        <Summary cols={4} className="mt-3 border-t pt-3">
          <SummaryItem label="Tests passed">
            <span className="tabular-nums">
              {r.passed ?? "—"}
              <span className="text-faint">/{r.total ?? "—"}</span>
            </span>
          </SummaryItem>
          <SummaryItem label="First failure">{r.first_fail ?? <span className="text-faint">none</span>}</SummaryItem>
          <SummaryItem label="Slowest test">{r.max_time_ms !== null ? `${Math.round(r.max_time_ms)} ms` : "—"}</SummaryItem>
          <SummaryItem label="Peak memory">{r.max_memory_kb !== null ? `${Math.round(r.max_memory_kb / 1024)} MB` : "—"}</SummaryItem>
        </Summary>
      </Section>

      {r.compile_output && (
        <Section title="Compiler output" padded={false}>
          <pre className="pane max-h-48 overflow-auto bg-muted p-3 text-[11.5px]">{r.compile_output}</pre>
        </Section>
      )}

      {d.failing_testcase && (
        <Section
          title="The testcase it failed"
          description={`Read back at version ${d.failing_testcase.version}, the one it was judged against${
            d.failing_testcase.truncated ? ", truncated to 1 MB" : ""
          }.`}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Pane label="Input" body={d.failing_testcase.input} />
            <Pane label="Expected output" body={d.failing_testcase.answer} />
          </div>
        </Section>
      )}

      <Section title="What they submitted" description={d.language ? `In ${languageName(d.language)}, exactly as sent.` : undefined} padded={false}>
        <Code source={d.source} language={d.language ?? "plaintext"} maxLines={40} />
      </Section>

      {d.attempts.length > 1 && (
        <Section title="Every attempt" description="A rejudge keeps the verdict it replaced, for the record." padded={false}>
          <ul className="divide-y">
            {d.attempts.map((a) => (
              <li key={a.id} className="flex items-center gap-2 px-5 py-2.5 text-[12.5px]">
                <span className="w-16 text-muted-foreground">attempt {a.attempt}</span>
                <VerdictBadge verdict={a.state === "done" ? a.verdict : null} />
                <span className="ml-auto text-faint">{new Date(a.createdAt).toLocaleTimeString()}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}

export function HackBody({ d }: { d: HackDetail }) {
  const r = d.result;
  const tone = r.hacked === true ? "success" : r.valid_input === false ? "warning" : r.hacked === false ? "neutral" : "neutral";
  return (
    <>
      <Section title="The outcome">
        <div className="flex flex-wrap items-center gap-2">
          {d.request.state === "done" ? (
            <Badge variant={tone as "success" | "warning" | "neutral"} size="lg">
              {r.outcome ?? "Finished"}
            </Badge>
          ) : (
            <Badge variant="info" size="lg">
              Still being checked
            </Badge>
          )}
          {r.points_awarded !== 0 && (
            <Badge variant={r.points_awarded > 0 ? "success" : "destructive"}>
              {r.points_awarded > 0 ? "+" : ""}
              {r.points_awarded} points
            </Badge>
          )}
        </div>
        <Summary cols={3} className="mt-3 border-t pt-3">
          <SummaryItem label="Input accepted">
            {r.valid_input === null ? <span className="text-faint">not yet</span> : r.valid_input ? "Yes" : "No"}
          </SummaryItem>
          <SummaryItem label="Broke it">
            {r.hacked === null ? <span className="text-faint">—</span> : r.hacked ? "Yes" : "No"}
          </SummaryItem>
          <SummaryItem label="Verdict on the solution">
            {r.valid_input === false ? <span className="text-faint">never run. The input was rejected</span> : <VerdictBadge verdict={r.verdict} />}
          </SummaryItem>
        </Summary>
        {r.verdict === "IE" && <JudgeErrorNote message={r.message} note="Nothing was scored; the fault is in the question or the judge, not the attempt." />}
        <p className="mt-3 text-[12.5px] text-muted-foreground">
          A hit is worth {d.stakes.hack_points}; a miss costs {d.stakes.fail_penalty}.
        </p>
      </Section>

      <Section title="The input they sent" description="This is the whole submission. A hack is data, not code." padded={false}>
        <pre className="pane max-h-72 overflow-auto bg-muted p-3 text-[11.5px]">{d.input}</pre>
      </Section>

      <Section title="The solution it was aimed at" description={d.language ? `The ${languageName(d.language)} copy, deliberately wrong somewhere.` : undefined} padded={false}>
        <Code source={d.source} language={d.language ?? "plaintext"} maxLines={40} />
      </Section>
    </>
  );
}

export function RunBody({ d }: { d: RunDetail }) {
  const r = d.result;
  const outputs = r.outputs ?? [];
  const inputs = [...Array.from({ length: d.sample_count }, (_, i) => `Sample ${i + 1}`), ...(d.custom_input !== null ? ["Their own input"] : [])];
  return (
    <>
      <Section title="What happened" description="Nothing was scored. A run is the participant trying their code before submitting it.">
        <div className="flex flex-wrap items-center gap-2">
          <VerdictBadge verdict={d.request.state === "done" ? r.verdict : null} />
          {r.message && <span className="text-[13px]">{r.message}</span>}
        </div>
        {r.verdict === "IE" && <JudgeErrorNote message={r.message} />}
      </Section>

      {r.compile_output && (
        <Section title="Compiler output" padded={false}>
          <pre className="pane max-h-48 overflow-auto bg-muted p-3 text-[11.5px]">{r.compile_output}</pre>
        </Section>
      )}

      {outputs.length > 0 && (
        <Section title="Each input, and what came out" description="The samples from the statement, then the input they typed, if any." padded={false}>
          <ul className="divide-y">
            {outputs.map((o, i) => (
              <li key={i} className="px-5 py-3">
                <div className="flex flex-wrap items-center gap-2 text-[13px]">
                  <span className="font-medium">{inputs[i] ?? `Input ${i + 1}`}</span>
                  <VerdictBadge verdict={o.verdict} />
                  <span className="text-[12px] text-faint tabular-nums">{Math.round(o.time_ms)} ms, {Math.round(o.memory_kb / 1024)} MB</span>
                </div>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {i >= d.sample_count && d.custom_input !== null && <Pane label="Input" body={d.custom_input} />}
                  <Pane label="Output" body={o.stdout || "(nothing)"} />
                  {o.stderr && <Pane label="Stderr" body={o.stderr} />}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {d.request.state === "done" && r.outputs === null && r.verdict !== "IE" && (
        <Section title="Each input, and what came out">
          <p className="text-[13px] text-muted-foreground">Not kept. This run is from before outputs were stored.</p>
        </Section>
      )}

      <Section title="What they ran" description={d.language ? `In ${languageName(d.language)}, exactly as sent.` : undefined} padded={false}>
        {d.source !== null
          ? <Code source={d.source} language={d.language ?? "plaintext"} maxLines={40} />
          : <p className="px-5 py-4 text-[13px] text-muted-foreground">Not kept. This run is from before the code was stored.</p>}
      </Section>
    </>
  );
}

export function ValidatorBody({ d }: { d: ValidatorDetail }) {
  return (
    <>
      <Section title="The outcome">
        {d.result.error ? (
          <div className="flex items-start gap-2 text-[13px] text-red">
            <Icon.Alert size={15} className="mt-0.5 shrink-0" />
            <span>{d.result.error}</span>
          </div>
        ) : d.request.state === "done" ? (
          <p className="text-[13px]">
            <span className="font-semibold tabular-nums">{d.result.score ?? 0}</span> points
            {d.result.points_per_entry ? ` · ${d.result.points_per_entry} per accepted entry` : ""}
          </p>
        ) : (
          <p className="text-[13px] text-muted-foreground">Waiting on the judge.</p>
        )}
      </Section>

      <Section
        title={`The ${d.entries.length} ${d.entries.length === 1 ? "entry" : "entries"} sent`}
        description="The validator itself is an answer key and is not shown here."
        padded={false}
      >
        <ul className="divide-y">
          {d.entries.map((e, i) => (
            <li key={i} className="flex gap-3 px-5 py-2 font-mono text-[11.5px]">
              <span className="w-6 shrink-0 text-right text-faint tabular-nums">{i + 1}</span>
              <span className="break-all">{e}</span>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

/** The drawer's own shape while it loads: the envelope, a result, a code pane. */
export function DetailSkeleton() {
  return (
    <div className="space-y-5" aria-hidden>
      <div className="rounded-lg border bg-card p-5 shadow-xs">
        <Skeleton className="h-3.5 w-28" />
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-2.5 w-16" />
              <Skeleton className="mt-1.5 h-3.5 w-24" />
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg border bg-card p-5 shadow-xs">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="mt-4 h-5 w-32 rounded-[4px]" />
        <Skeleton className="mt-3 h-3 w-2/3" />
      </div>
      <div className="overflow-hidden rounded-lg border bg-card shadow-xs">
        <div className="p-5">
          <Skeleton className="h-3.5 w-36" />
        </div>
        <Skeleton className="h-56 rounded-none" />
      </div>
    </div>
  );
}

/** A judge error is ours to fix, so its message is shown in full, with what it means for the person. */
function JudgeErrorNote({ message, note }: { message: string | null; note?: string }) {
  return (
    <div className="mt-3 flex items-start gap-2 rounded-md border border-red/30 bg-red-tint px-3 py-2.5 text-[13px]">
      <Icon.Alert size={15} className="mt-0.5 shrink-0 text-red" />
      <div>
        <div className="font-semibold text-red">The judge could not run this</div>
        <div className="mt-0.5 text-muted-foreground">{message || "It gave no reason. The judge's own log will have it."}</div>
        {note && <div className="mt-1 text-[12px] text-faint">{note}</div>}
      </div>
    </div>
  );
}

function Pane({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">{label}</div>
      <pre className="pane max-h-56 overflow-auto rounded-md border bg-muted p-2.5 text-[11.5px]">{body}</pre>
    </div>
  );
}
