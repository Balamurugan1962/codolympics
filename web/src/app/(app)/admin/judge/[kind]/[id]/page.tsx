"use client";

/**
 * One judge request on its own page: a submission, a hack attempt, or a
 * validator run. The one address for it, whether you came from the Judge
 * monitor, a participant's timeline, or a link someone pasted.
 */
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { LocalTime } from "@/components/local-time";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge, VerdictBadge } from "@/components/ui/badge";
import { PageBody } from "@/components/ui/page";
import { AsideBlock, Facts, RecordBody, RecordHeader } from "@/components/ui/record";
import { api } from "@/lib/client";
import { languageName } from "@/lib/languages";

import { KIND, duration, type WorkKind } from "../../work";
import { DetailSkeleton, HackBody, SubmissionBody, ValidatorBody, type Detail } from "../../work-detail";

export default function JudgeWorkPage() {
  const { kind, id } = useParams<{ kind: string; id: string }>();
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { setD(await api.get<Detail>(`/api/admin/judge/activity/${kind}/${id}`)); }
    catch { setError("No judge request with that id. It may have been removed with its question."); }
  }, [kind, id]);
  useEffect(() => { void load(); }, [load]);
  // A request still in flight changes under you; look again until it settles.
  useEffect(() => {
    if (!d || d.request.state === "done" || d.request.state === "error") return;
    const t = setTimeout(() => void load(), 1500);
    return () => clearTimeout(t);
  }, [d, load]);

  if (error) return <PageBody><Alert variant="destructive"><Icon.Alert /><AlertDescription>{error}</AlertDescription></Alert></PageBody>;
  if (!d) return <PageBody width="wide"><DetailSkeleton /></PageBody>;

  const k = KIND[d.kind as WorkKind];
  const live = !["done", "error"].includes(d.request.state);
  const took = d.request.ended_at ? duration(new Date(d.request.ended_at).getTime() - new Date(d.request.created_at).getTime()) : null;
  const timeline =
    d.kind === "submission" && d.target.question_id ? `/admin/participants/${d.who.id}/questions/${d.target.question_id}`
    : d.kind === "hack" && d.target.question_id ? `/admin/participants/${d.who.id}/hacks/${d.target.question_id}`
    : null;
  const outcome =
    d.kind === "submission" ? <VerdictBadge verdict={d.request.state === "done" ? d.result.verdict : null} />
    : d.kind === "hack" ? (
      d.request.state !== "done" ? <Badge variant="info">judging</Badge>
      : d.result.valid_input === false ? <Badge variant="warning">invalid input</Badge>
      : d.result.hacked ? <Badge variant="success">hacked</Badge>
      : <Badge variant="destructive">did not break it</Badge>
    )
    : d.result.error ? <Badge variant="destructive">error</Badge> : d.result.score !== null ? <Badge variant="success">scored {d.result.score}</Badge> : <Badge variant="info">running</Badge>;

  return (
    <PageBody width="wide">
      <RecordHeader
        back={{ href: "/admin/judge", label: "Judge" }}
        title={<span className="flex items-center gap-2"><span className="text-faint">{k.icon}</span>{k.noun} from {d.who.name}</span>}
        chips={
          <>
            {outcome}
            {d.request.cancelled && <Badge variant="neutral">cancelled</Badge>}
            {d.request.superseded_at && <Badge variant="neutral">superseded by a rejudge</Badge>}
            {d.request.attempt !== null && d.request.attempt > 1 && <Badge variant="info">attempt {d.request.attempt}</Badge>}
            {d.request.retries > 0 && <Badge variant="warning">sent again ×{d.request.retries}</Badge>}
          </>
        }
        meta={<>{d.target.title}, sent <LocalTime iso={d.request.created_at} withDate />{d.language ? `, in ${languageName(d.language)}` : ""}</>}
        figures={[
          { label: "State", value: <span className="capitalize">{d.request.state}</span>, note: live ? "still with the judge" : undefined, tone: d.request.state === "error" ? "destructive" : "default" },
          { label: "Took", value: took ?? "–", note: took ? "from sending to the verdict" : live ? "still running" : "not recorded" },
          ...(d.kind === "submission" && d.result.total ? [{ label: "Tests", value: `${d.result.passed ?? 0}/${d.result.total}`, note: d.result.first_fail !== null ? `first failure on test ${d.result.first_fail + 1}` : "all passed" }] : []),
          ...(d.kind === "hack" ? [{ label: "Points", value: d.result.points_awarded, note: `of ${d.stakes.hack_points}`, tone: d.result.points_awarded > 0 ? ("success" as const) : d.result.points_awarded < 0 ? ("destructive" as const) : ("default" as const) }] : []),
        ]}
      />

      <RecordBody
        aside={
          <>
            <AsideBlock title="Where it belongs">
              <Facts
                items={[
                  { label: "Participant", value: <Link href={`/admin/participants/${d.who.id}`} className="text-brand hover:underline">{d.who.name}</Link> },
                  { label: "Question", value: d.kind === "submission" && d.target.question_id ? <Link href={`/admin/problems/${d.target.question_id}`} className="text-brand hover:underline">{d.target.title}</Link> : d.target.title },
                  ...(d.target.problem_id ? [{ label: "Package", value: <span className="font-mono text-[12px]">{d.target.problem_id}{d.request.problem_version ? ` @${d.request.problem_version}` : ""}</span> }] : []),
                  { label: "Judge job", value: d.request.job_id ? <span className="font-mono text-[11.5px]">{d.request.job_id}</span> : <span className="font-normal text-faint">not accepted yet</span> },
                ]}
              />
              {timeline && (
                <Link href={timeline} className="mt-3 inline-flex items-center gap-1 text-[13px] text-brand hover:underline">
                  Everything they did on this question <Icon.ArrowRight size={13} />
                </Link>
              )}
            </AsideBlock>
          </>
        }
      >
        {d.kind === "submission" && <SubmissionBody d={d} />}
        {d.kind === "hack" && <HackBody d={d} />}
        {d.kind === "validator" && <ValidatorBody d={d} />}
      </RecordBody>
    </PageBody>
  );
}
