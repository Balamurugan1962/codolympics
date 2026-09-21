"use client";

/**
 * One participant on one hacking question: every input they sent, in order,
 * with what the judge made of it, beside the code they were reading.
 */
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Code, Event, Plain, Timeline, spansDays } from "@/components/admin/timeline";
import { Icon } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { SimpleCombobox } from "@/components/ui/combobox";
import { PageBody, Section } from "@/components/ui/page";
import { AsideBlock, Facts, RecordBody, RecordHeader } from "@/components/ui/record";
import { DetailSkeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/client";
import { languageName } from "@/lib/languages";
import { cn } from "@/lib/utils";

type Attempt = {
  id: number; input: string; state: string; valid_input: boolean | null; invalid_reason: string | null; hacked: boolean | null;
  verdict: string | null; points_awarded: number; created_at: string; ended_at: string | null; solution_id: number | null;
};
type Data = {
  participant: { id: string; name: string; username: string | null };
  question: {
    question_id: number; title: string; problem_id: string; points_possible: number; fail_penalty: number; awarded: number;
    statement_md: string; constraints_md: string;
    solutions: { id: number; language: string; source: string }[];
    attempts: Attempt[];
  };
};

export default function ParticipantHackPage() {
  const { id, qid } = useParams<{ id: string; qid: string }>();
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copy, setCopy] = useState<string>("");
  const load = useCallback(async () => {
    try { setD(await api.get<Data>(`/api/admin/participants/${id}/hacks/${qid}`)); }
    catch { setError("That hacking question could not be loaded."); }
  }, [id, qid]);
  useEffect(() => { void load(); }, [load]);

  if (error) return <PageBody><Alert variant="destructive"><Icon.Alert /><AlertDescription>{error}</AlertDescription></Alert></PageBody>;
  if (!d) return <PageBody width="wide"><DetailSkeleton tabs={0} stats={4} /></PageBody>;

  const q = d.question;
  const broke = q.attempts.find((a) => a.hacked);
  const valid = q.attempts.filter((a) => a.valid_input).length;
  const dated = spansDays(q.attempts.map((a) => a.created_at));
  const shown = q.solutions.find((s) => String(s.id) === copy) ?? q.solutions.find((s) => s.id === q.attempts[q.attempts.length - 1]?.solution_id) ?? q.solutions[0];

  return (
    <PageBody width="wide">
      <RecordHeader
        back={{ href: `/admin/participants/${id}`, label: d.participant.name }}
        title={q.title}
        chips={broke ? <Badge variant="success">Broke it</Badge> : q.attempts.length ? <Badge variant="neutral">Never broke it</Badge> : <Badge variant="outline">No attempt</Badge>}
        meta={`${d.participant.name}'s attempts on this question, in the order they were sent.`}
        figures={[
          { label: "Points", value: q.awarded, note: `of ${q.points_possible}`, tone: q.awarded > 0 ? "success" : q.awarded < 0 ? "destructive" : "default" },
          { label: "Attempts", value: q.attempts.length, note: `${valid} valid` },
          { label: "Penalty", value: q.fail_penalty, note: "per failed attempt" },
        ]}
      />

      <RecordBody
        aside={
          <>
            <AsideBlock title="The question">
              <Facts
                items={[
                  { label: "Judge problem", value: <span className="font-mono text-[12px]">{q.problem_id}</span> },
                  { label: "Worth", value: `${q.points_possible} points` },
                  { label: "Copies", value: q.solutions.map((s) => languageName(s.language)).join(", ") },
                ]}
              />
              <a href="/admin/phase1/hacking" className="mt-3 inline-flex items-center gap-1 text-[13px] text-brand hover:underline">
                Open in Section B <Icon.ArrowRight size={13} />
              </a>
            </AsideBlock>
          </>
        }
      >
        <Section title="Inputs they sent" description={q.attempts.length ? "Oldest first. Open one for the input itself." : undefined} padded={false}>
          {q.attempts.length === 0 ? (
            <p className="px-5 py-6 text-center text-[13px] text-faint">They never sent an input for this one.</p>
          ) : (
            <Timeline>
              {q.attempts.map((a, i) => {
                const done = a.state === "done";
                const tone = !done ? "info" : a.valid_input === false ? "warning" : a.hacked ? "success" : "destructive";
                const took = a.ended_at ? `${Math.max(0, Math.round((Date.parse(a.ended_at) - Date.parse(a.created_at)) / 1000))} s to judge` : null;
                const language = q.solutions.find((s) => s.id === a.solution_id)?.language;
                return (
                  <Event
                    key={a.id}
                    at={a.created_at}
                    withDate={dated}
                    tone={tone}
                    title={`Attempt ${i + 1}`}
                    href={`/admin/judge/hack/${a.id}`}
                    chips={
                      <>
                        {!done ? <Badge variant="info">judging</Badge> : a.valid_input === false ? <Badge variant="warning">invalid input</Badge> : a.hacked ? <Badge variant="success">hacked</Badge> : <Badge variant="destructive">did not break it</Badge>}
                        {language && <span className="text-[12px] text-muted-foreground">against the {languageName(language)} copy</span>}
                        <span className={cn("text-[12.5px] font-semibold tabular-nums", a.points_awarded > 0 ? "text-brand-deep" : a.points_awarded < 0 ? "text-destructive" : "text-faint")}>
                          {a.points_awarded > 0 ? "+" : ""}{a.points_awarded}
                        </span>
                      </>
                    }
                    summary={[a.invalid_reason, a.verdict ? `judge said ${a.verdict}` : null, took].filter(Boolean).join(", ") || undefined}
                  >
                    <Plain>{a.input}</Plain>
                  </Event>
                );
              })}
            </Timeline>
          )}
        </Section>

        {shown && (
          <Section
            title="The code they were reading"
            description="Deliberately wrong somewhere. Every copy solves the same problem."
            actions={
              q.solutions.length > 1 && (
                <SimpleCombobox
                  size="sm"
                  className="w-44"
                  aria-label="Language of the copy"
                  value={String(shown.id)}
                  onValueChange={setCopy}
                  options={q.solutions.map((s) => ({ value: String(s.id), label: languageName(s.language) }))}
                />
              )
            }
            padded={false}
          >
            <Code source={shown.source} language={shown.language} maxLines={40} />
          </Section>
        )}
      </RecordBody>
    </PageBody>
  );
}
