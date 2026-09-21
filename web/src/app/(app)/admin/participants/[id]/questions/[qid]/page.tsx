"use client";

/**
 * One participant on one Phase 2 question, as a story: won at auction, each
 * hint bought, each submission with the code as sent and what the judge said.
 * The page a dispute about one question is settled on, so nothing is
 * summarised away and every time is shown.
 */
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Code, Event, Plain, Timeline, spansDays } from "@/components/admin/timeline";
import { Icon } from "@/components/icons";
import { LocalTime } from "@/components/local-time";
import { Markdown } from "@/components/markdown";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge, VERDICTS, VerdictBadge } from "@/components/ui/badge";
import { PageBody, Section } from "@/components/ui/page";
import { AsideBlock, Facts, RecordBody, RecordHeader } from "@/components/ui/record";
import { DetailSkeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/client";
import { languageName } from "@/lib/languages";

type Submission = {
  id: number; language: string; source: string; created_at: string; ended_at: string | null; state: string; verdict: string | null;
  passed: number | null; total: number | null; first_fail: number | null; max_time_ms: number | null; max_memory_kb: number | null;
  compile_output: string | null; message: string | null; jury_detail: string | null; attempt: number; cancelled: boolean;
};
type Data = {
  participant: { id: string; name: string; username: string | null };
  question: {
    question_id: string; title: string; difficulty: string; topic: string; score: number; price_paid: number; awarded_at: string;
    voided_at: string | null; status: string; solved_at: string | null; solve_ms: number | null; attempts: number;
    hints_bought: { idx: number; price_paid: number; purchased_at: string; body_md: string }[];
    submissions: Submission[];
  };
};

function duration(ms: number | null): string {
  if (ms === null) return "–";
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}

export default function ParticipantQuestionPage() {
  const { id, qid } = useParams<{ id: string; qid: string }>();
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { setD(await api.get<Data>(`/api/admin/participants/${id}/questions/${qid}`)); }
    catch { setError("This question is not one they own, or the participant was removed."); }
  }, [id, qid]);
  useEffect(() => { void load(); }, [load]);

  if (error) return <PageBody><Alert variant="destructive"><Icon.Alert /><AlertDescription>{error}</AlertDescription></Alert></PageBody>;
  if (!d) return <PageBody width="wide"><DetailSkeleton tabs={0} stats={4} /></PageBody>;

  const q = d.question;
  const solved = Boolean(q.solved_at);
  const hintSpend = q.hints_bought.reduce((s, h) => s + h.price_paid, 0);
  const accepted = q.submissions.filter((s) => s.verdict === "AC").length;
  // Oldest first: the story reads forward.
  const events = [
    ...q.hints_bought.map((h) => ({ at: h.purchased_at, kind: "hint" as const, h })),
    ...q.submissions.map((s) => ({ at: s.created_at, kind: "submission" as const, s })),
  ].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const dated = spansDays([q.awarded_at, ...events.map((e) => e.at), ...(q.solved_at ? [q.solved_at] : [])]);
  const numbered = new Map(q.submissions.slice().sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)).map((s, i) => [s.id, i + 1]));

  return (
    <PageBody width="wide">
      <RecordHeader
        back={{ href: `/admin/participants/${id}`, label: d.participant.name }}
        title={q.title}
        chips={
          <>
            {q.voided_at ? <Badge variant="neutral">Voided</Badge> : solved ? <Badge variant="success">Solved</Badge> : <Badge variant="warning">Unsolved</Badge>}
            <Badge variant={q.difficulty === "hard" ? "destructive" : q.difficulty === "medium" ? "warning" : "success"}>{q.difficulty}</Badge>
          </>
        }
        meta={`${d.participant.name}'s work on this question, in the order it happened.`}
        figures={[
          { label: "Score", value: solved ? q.score : 0, note: `of ${q.score}`, tone: solved ? "success" : "default" },
          { label: "Submissions", value: q.submissions.length, note: accepted ? `${accepted} accepted` : q.submissions.length ? "none accepted" : "none yet" },
          { label: "Hints", value: q.hints_bought.length, note: hintSpend ? `${hintSpend} spent` : "none bought" },
          { label: "Solve time", value: duration(q.solve_ms), note: solved ? "from winning it" : "not solved" },
        ]}
      />

      <RecordBody
        aside={
          <>
            <AsideBlock title="The question">
              <Facts
                items={[
                  { label: "Bought for", value: q.price_paid.toLocaleString() },
                  { label: "Won at", value: <LocalTime iso={q.awarded_at} withDate /> },
                  { label: "Worth", value: `${q.score} points` },
                  { label: "Topic", value: q.topic || "–" },
                  { label: "Problem", value: <span className="font-mono text-[12px]">{q.question_id}</span> },
                  ...(q.voided_at ? [{ label: "Voided", value: <LocalTime iso={q.voided_at} withDate /> }] : []),
                ]}
              />
              <a href={`/admin/problems/${q.question_id}`} className="mt-3 inline-flex items-center gap-1 text-[13px] text-brand hover:underline">
                Open the problem <Icon.ArrowRight size={13} />
              </a>
            </AsideBlock>
            <AsideBlock title="Reading it">
              <p className="text-[12.5px] text-muted-foreground">Every submission is judged against the version that was live when it was sent. The jury detail names the expected answer; it is never shown to participants.</p>
            </AsideBlock>
          </>
        }
      >
        <Section title="What happened" description={`${events.length + 1} events, oldest first.`} padded={false}>
          <Timeline>
            <Event at={q.awarded_at} withDate={dated} tone="info" title="Won at auction" summary={`Paid ${q.price_paid.toLocaleString()} coins.`} />
            {events.map((e) =>
              e.kind === "hint" ? (
                <Event key={`h${e.h.idx}`} at={e.at} withDate={dated} tone="warning" title={`Bought hint ${e.h.idx + 1}`} chips={<span className="text-[12px] text-muted-foreground">{e.h.price_paid} coins</span>}>
                  <div className="text-[13px]"><Markdown>{e.h.body_md}</Markdown></div>
                </Event>
              ) : (
                <SubmissionEvent key={`s${e.s.id}`} s={e.s} n={numbered.get(e.s.id) ?? 0} withDate={dated} />
              ),
            )}
            {q.solved_at && <Event at={q.solved_at} withDate={dated} tone="success" title="Solved" summary={`${q.score} points, ${duration(q.solve_ms)} after winning it.`} />}
          </Timeline>
        </Section>
      </RecordBody>
    </PageBody>
  );
}

function SubmissionEvent({ s, n, withDate }: { s: Submission; n: number; withDate: boolean }) {
  const done = s.state === "done";
  const v = done ? s.verdict : null;
  const tone = !done ? "info" : s.cancelled ? "neutral" : v === "AC" ? "success" : VERDICTS[v ?? ""]?.variant === "warning" ? "warning" : "destructive";
  const tests = s.total ? `${s.passed ?? 0} of ${s.total} tests${s.first_fail !== null ? `, failed test ${s.first_fail + 1}` : ""}` : null;
  const took = s.ended_at ? `${Math.max(0, Math.round((Date.parse(s.ended_at) - Date.parse(s.created_at)) / 1000))} s to judge` : null;
  return (
    <Event
      at={s.created_at}
      withDate={withDate}
      tone={tone}
      title={`Submission ${n}`}
      href={`/admin/judge/submission/${s.id}`}
      chips={
        <>
          <VerdictBadge verdict={s.cancelled ? null : v} />
          {s.cancelled && <Badge variant="neutral">cancelled</Badge>}
          {s.attempt > 1 && <Badge variant="info">rejudged</Badge>}
          <span className="text-[12px] text-muted-foreground">{languageName(s.language)}</span>
        </>
      }
      summary={[tests, s.max_time_ms !== null ? `slowest ${s.max_time_ms.toFixed(0)} ms` : null, took].filter(Boolean).join(", ") || (done ? s.message : "still being judged")}
    >
      <div className="space-y-3">
        {s.jury_detail && (
          <div className="text-[12.5px]"><span className="text-muted-foreground">Jury detail: </span><span className="font-mono">{s.jury_detail}</span></div>
        )}
        {s.compile_output && <Plain tone="text-amber">{s.compile_output}</Plain>}
        <Code source={s.source} language={s.language} />
      </div>
    </Event>
  );
}
