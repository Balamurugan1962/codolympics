"use client";

/**
 * One judge request, opened from the activity list.
 *
 * The three kinds do not share a body, because they do not share a question.
 * For a submission you want the code and the testcase it died on; for a hack
 * you want the input the participant crafted and the solution it was aimed at;
 * for a validator run you want the entries it was asked to check. Forcing all
 * three through one layout would mean columns that are empty two times in three.
 *
 * What they do share is the envelope — who, when, which job id, how long — and
 * that is the strip at the top, in the same place every time.
 */
import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { Badge, VerdictBadge } from "@/components/ui/badge";
import { Drawer } from "@/components/ui/drawer";
import { Section } from "@/components/ui/page";
import { Skeleton } from "@/components/ui/skeleton";
import { Summary, SummaryItem } from "@/components/ui/summary";
import { api } from "@/lib/client";

import { KIND, type Work, duration, stateTone } from "./work";

type Envelope = {
  kind: "submission" | "hack" | "validator";
  who: { id: string; name: string };
  submitted_at: string;
  target: { title: string; problem_id: string | null };
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

type SubmissionDetail = Envelope & {
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

type HackDetail = Envelope & {
  kind: "hack";
  input: string;
  source: string;
  result: {
    valid_input: boolean | null;
    invalid_reason: string | null;
    hacked: boolean | null;
    verdict: string | null;
    points_awarded: number;
    outcome: string | null;
  };
  stakes: { hack_points: number; fail_penalty: number };
};

type ValidatorDetail = Envelope & {
  kind: "validator";
  entries: string[];
  result: { score: number | null; points_per_entry: number | null; error: string | null };
};

type Detail = SubmissionDetail | HackDetail | ValidatorDetail;

export function WorkDrawer({ work, onClose }: { work: Work | null; onClose: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);

  useEffect(() => {
    setDetail(null);
    if (!work) return;
    let live = true;
    void api
      .get<Detail>(`/api/admin/judge/activity/${work.ref}`)
      .then((d) => { if (live) setDetail(d); })
      .catch(() => {});
    return () => { live = false; };
  }, [work]);

  const kind = work ? KIND[work.kind] : null;

  return (
    <Drawer
      open={Boolean(work)}
      onClose={onClose}
      width="xl"
      title={
        work ? (
          <span className="flex items-center gap-2">
            {kind!.icon}
            {kind!.noun} from {work.name}
          </span>
        ) : (
          ""
        )
      }
      description={work ? `${work.target} · ${new Date(work.created_at).toLocaleString()}` : undefined}
    >
      {!detail ? (
        <DetailSkeleton />
      ) : (
        <div className="space-y-5">
          <Section title="The request" description="What was sent to the judge, and what it did with it.">
            <Summary cols={3}>
              <SummaryItem label="Participant">{detail.who.name}</SummaryItem>
              <SummaryItem label="Sent">{new Date(detail.request.created_at).toLocaleTimeString()}</SummaryItem>
              <SummaryItem label="Took">
                {detail.request.ended_at ? (
                  duration(new Date(detail.request.ended_at).getTime() - new Date(detail.request.created_at).getTime())
                ) : detail.request.state === "done" || detail.request.state === "error" ? (
                  <span className="text-faint">not recorded</span>
                ) : (
                  <span className="text-blue">still running</span>
                )}
              </SummaryItem>
              <SummaryItem label="State">
                <span className={stateTone(detail.request.state)}>{detail.request.state}</span>
              </SummaryItem>
              <SummaryItem label="Judge job">
                {detail.request.job_id ? (
                  <span className="font-mono text-[11.5px]">{detail.request.job_id}</span>
                ) : (
                  <span className="text-faint">not accepted yet</span>
                )}
              </SummaryItem>
              <SummaryItem label="Package">
                {detail.target.problem_id ? (
                  <span className="font-mono text-[11.5px]">
                    {detail.target.problem_id}
                    {detail.request.problem_version ? ` @${detail.request.problem_version}` : ""}
                  </span>
                ) : (
                  <span className="text-faint">none — runs a validator, not a package</span>
                )}
              </SummaryItem>
            </Summary>
            {(detail.request.retries > 0 || detail.request.cancelled || detail.request.superseded_at) && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t pt-3">
                {detail.request.retries > 0 && <Badge variant="warning">sent again ×{detail.request.retries}</Badge>}
                {detail.request.cancelled && <Badge variant="neutral">cancelled</Badge>}
                {detail.request.superseded_at && <Badge variant="neutral">superseded by a rejudge</Badge>}
                {detail.request.attempt !== null && detail.request.attempt > 1 && (
                  <Badge variant="info">attempt {detail.request.attempt}</Badge>
                )}
              </div>
            )}
          </Section>

          {detail.kind === "submission" && <SubmissionBody d={detail} />}
          {detail.kind === "hack" && <HackBody d={detail} />}
          {detail.kind === "validator" && <ValidatorBody d={detail} />}
        </div>
      )}
    </Drawer>
  );
}

function SubmissionBody({ d }: { d: SubmissionDetail }) {
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
          <p className="mt-1.5 font-mono text-[11.5px] text-red" title="Jury detail — never sent to a participant">
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

      <Section title={`What they submitted · ${d.language}`} padded={false}>
        <pre className="pane max-h-[28rem] overflow-auto bg-navy p-4 text-[12px] leading-relaxed text-white">{d.source}</pre>
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

function HackBody({ d }: { d: HackDetail }) {
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
            {r.valid_input === false ? <span className="text-faint">never run — the input was rejected</span> : <VerdictBadge verdict={r.verdict} />}
          </SummaryItem>
        </Summary>
        <p className="mt-3 text-[12.5px] text-muted-foreground">
          A hit is worth {d.stakes.hack_points}; a miss costs {d.stakes.fail_penalty}.
        </p>
      </Section>

      <Section title="The input they sent" description="This is the whole submission — a hack is data, not code." padded={false}>
        <pre className="pane max-h-72 overflow-auto bg-muted p-3 text-[11.5px]">{d.input}</pre>
      </Section>

      <Section title={`The solution it was aimed at · ${d.language}`} padded={false}>
        <pre className="pane max-h-[24rem] overflow-auto bg-navy p-4 text-[12px] leading-relaxed text-white">{d.source}</pre>
      </Section>
    </>
  );
}

function ValidatorBody({ d }: { d: ValidatorDetail }) {
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
function DetailSkeleton() {
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

function Pane({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">{label}</div>
      <pre className="pane max-h-56 overflow-auto rounded-md border bg-muted p-2.5 text-[11.5px]">{body}</pre>
    </div>
  );
}
