"use client";

/**
 * One participant, end to end.
 *
 * This is the page an organiser opens when someone says "that's not what I
 * got". It answers with evidence rather than a score: every puzzle with the
 * answer they gave, every hack attempt with the input they sent, every question
 * they won with every submission against it, and every coin in and out.
 *
 * Both phases sit behind tabs on one page because the question is always about
 * a person, not a phase, and jumping between two screens to compare them is how
 * a dispute takes ten minutes instead of one.
 */
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { LocalTime } from "@/components/local-time";
import { Markdown } from "@/components/markdown";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge, VerdictBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { EmptyState } from "@/components/ui/empty-state";
import { PageBody, PageHeader, Section } from "@/components/ui/page";
import { CardSkeleton } from "@/components/ui/skeleton";
import { Stat, StatRow } from "@/components/ui/stat";
import { Summary, SummaryItem } from "@/components/ui/summary";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";

type Dossier = {
  participant: {
    id: string; name: string; username: string | null; balance: number; preferred_language: string | null;
    disqualified: boolean; disqualified_reason: string | null; registered_at: string;
    p1_puzzles_finished_at: string | null; p1_hacking_finished_at: string | null;
    advanced: boolean | null; advancement_reason: string | null;
  };
  phase1: {
    standing: { rank: number; points: number; provisional: boolean; submitted_at: string | null } | null;
    of: number;
    puzzles: {
      question_id: number; title: string; category: string; kind: string; grading: string;
      points_possible: number; explain_possible: number; answered: boolean; answer: unknown;
      explanation: string | null; auto_score: number | null; manual_score: number | null; explain_score: number | null;
      score_state: string | null; score_error: string | null; graded_at: string | null; grade_comment: string | null;
      updated_at: string | null; awarded: number | null;
    }[];
    hacks: {
      question_id: number; title: string; points_possible: number; fail_penalty: number; awarded: number;
      attempts: { id: number; input: string; state: string; valid_input: boolean | null; invalid_reason: string | null;
        hacked: boolean | null; verdict: string | null; points_awarded: number; created_at: string }[];
    }[];
  };
  phase2: {
    standing: { rank: number; score: number; solved: number; total_time_ms: number } | null;
    of: number;
    owned: {
      question_id: string; title: string; difficulty: string; score: number; price_paid: number;
      awarded_at: string; voided_at: string | null; status: string; solved_at: string | null; solve_ms: number | null;
      attempts: number;
      hints_bought: { idx: number; price_paid: number; purchased_at: string; body_md: string }[];
      submissions: { id: number; language: string; created_at: string; state: string; verdict: string | null;
        passed: number | null; total: number | null; first_fail: number | null; max_time_ms: number | null;
        message: string | null; jury_detail: string | null; attempt: number }[];
    }[];
    ledger: { id: number; delta: number; balance_after: number; reason: string; ref: string | null; created_at: string }[];
  };
};

const LEDGER_LABEL: Record<string, string> = {
  starting_balance: "Starting balance",
  bid_won: "Won at auction",
  hint: "Hint bought",
  refund: "Refunded",
  admin_adjust: "Adjusted by an organiser",
};

/** mm:ss, or h:mm:ss past an hour. Solve times are read at a glance, not calculated. */
function duration(ms: number | null): string {
  if (ms === null) return "—";
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}

/** Whatever shape the answer took, as something readable. */
function answerText(a: unknown): string {
  if (a === null || a === undefined || a === "") return "";
  if (Array.isArray(a)) return a.map((x) => String(x)).join(", ");
  if (typeof a === "object") return JSON.stringify(a);
  return String(a);
}

export default function ParticipantPage() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<Dossier | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setD(await api.get<Dossier>(`/api/admin/participants/${id}`));
    } catch {
      setError("That participant could not be loaded. They may have been removed.");
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <PageBody>
        <Alert variant="destructive">
          <Icon.Alert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </PageBody>
    );
  }
  if (!d) {
    return (
      <PageBody width="wide">
        <CardSkeleton lines={3} className="mb-5" />
        <CardSkeleton lines={10} />
      </PageBody>
    );
  }

  const p = d.participant;
  const p1 = d.phase1;
  const p2 = d.phase2;
  const spent = p2.ledger.filter((l) => l.delta < 0).reduce((s, l) => s + l.delta, 0);

  return (
    <PageBody width="wide">
      <PageHeader
        breadcrumb={
          <Link href="/admin/participants" className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
            <Icon.ChevronLeft size={14} /> Participants
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-2.5">
            {p.name}
            {p.disqualified && <Badge variant="destructive">Disqualified</Badge>}
            {p.advanced === true && <Badge variant="success">Advanced to Phase 2</Badge>}
            {p.advanced === false && <Badge variant="neutral">Not selected</Badge>}
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-mono text-[12px]">{p.username}</span>
            <span className="text-faint">·</span>
            <span>
              registered <LocalTime iso={p.registered_at} withDate />
            </span>
            {p.preferred_language && (
              <>
                <span className="text-faint">·</span>
                <span>starts in {p.preferred_language}</span>
              </>
            )}
          </span>
        }
        actions={
          <Button variant="outline" size="sm" onClick={load}>
            <Icon.Refresh size={14} /> Refresh
          </Button>
        }
      />

      {p.disqualified && (
        <Alert variant="destructive" className="mb-5">
          <Icon.Ban />
          <AlertTitle>Disqualified</AlertTitle>
          <AlertDescription>{p.disqualified_reason || "No reason was recorded."}</AlertDescription>
        </Alert>
      )}

      <StatRow cols={4} className="mb-5">
        <Stat
          label="Phase 1"
          value={p1.standing ? `#${p1.standing.rank}` : "—"}
          icon={<Icon.Puzzle size={13} />}
          hint={p1.standing ? `${p1.standing.points} points of ${p1.of}${p1.standing.provisional ? " · provisional" : ""}` : "no standing"}
          tone={p1.standing?.provisional ? "warning" : "default"}
        />
        <Stat
          label="Phase 2"
          value={p2.standing ? `#${p2.standing.rank}` : "—"}
          icon={<Icon.Trophy size={13} />}
          hint={p2.standing ? `${p2.standing.score} points · ${p2.standing.solved} solved` : "did not reach Phase 2"}
        />
        <Stat label="Balance" value={p.balance.toLocaleString()} icon={<Icon.Coins size={13} />} hint={`${Math.abs(spent).toLocaleString()} spent`} tone="success" />
        <Stat
          label="Questions owned"
          value={p2.owned.filter((o) => !o.voided_at).length}
          icon={<Icon.Code size={13} />}
          hint={`${p2.owned.filter((o) => o.solved_at).length} solved`}
        />
      </StatRow>

      <Tabs defaultValue="phase1">
        <TabsList variant="line" className="mb-5 w-full justify-start border-b">
          <TabsTrigger value="phase1">Phase 1</TabsTrigger>
          <TabsTrigger value="phase2">Phase 2</TabsTrigger>
          <TabsTrigger value="money">Money</TabsTrigger>
        </TabsList>

        <TabsContent value="phase1" className="space-y-5">
          <Section title="How Phase 1 went" padded>
            <Summary cols={4}>
              <SummaryItem label="Points">
                <span className="text-[15px] font-semibold tabular-nums">{p1.standing?.points ?? 0}</span>
                {p1.standing?.provisional && <Badge variant="warning" className="ml-2">provisional</Badge>}
              </SummaryItem>
              <SummaryItem label="Rank">{p1.standing ? `#${p1.standing.rank} of ${p1.of}` : "—"}</SummaryItem>
              <SummaryItem label="Section A finished">
                {p.p1_puzzles_finished_at ? <LocalTime iso={p.p1_puzzles_finished_at} withDate /> : <span className="text-faint">never pressed finish</span>}
              </SummaryItem>
              <SummaryItem label="Section B finished">
                {p.p1_hacking_finished_at ? <LocalTime iso={p.p1_hacking_finished_at} withDate /> : <span className="text-faint">never pressed finish</span>}
              </SummaryItem>
              {p.advancement_reason && (
                <SummaryItem label="Selection decision" span>
                  {p.advancement_reason}
                </SummaryItem>
              )}
            </Summary>
          </Section>

          <Section
            title="Section A · Puzzles"
            description="Every published puzzle, and what they put. An unanswered one is shown too — a blank is a fact."
            actions={
              <span className="text-[12px] text-muted-foreground tabular-nums">
                {p1.puzzles.filter((q) => q.answered).length}/{p1.puzzles.length} answered
              </span>
            }
            padded={false}
          >
            {p1.puzzles.length === 0 ? (
              <EmptyState compact icon={<Icon.Puzzle />} title="No puzzles were published" />
            ) : (
              <ul className="divide-y">
                {p1.puzzles.map((q) => (
                  <PuzzleItem key={q.question_id} q={q} />
                ))}
              </ul>
            )}
          </Section>

          <Section
            title="Section B · Hacking"
            description="Every attempt, in the order it was sent, with the input itself."
            actions={
              <span className="text-[12px] text-muted-foreground tabular-nums">
                {p1.hacks.reduce((s, h) => s + h.attempts.length, 0)} attempt
                {p1.hacks.reduce((s, h) => s + h.attempts.length, 0) === 1 ? "" : "s"}
              </span>
            }
            padded={false}
          >
            {p1.hacks.length === 0 ? (
              <EmptyState compact icon={<Icon.Bug />} title="No hacking questions were published" />
            ) : (
              <ul className="divide-y">
                {p1.hacks.map((h) => (
                  <HackItem key={h.question_id} h={h} />
                ))}
              </ul>
            )}
          </Section>
        </TabsContent>

        <TabsContent value="phase2" className="space-y-5">
          <Section title="How Phase 2 went" padded>
            <Summary cols={4}>
              <SummaryItem label="Score">
                <span className="text-[15px] font-semibold tabular-nums">{p2.standing?.score ?? 0}</span>
              </SummaryItem>
              <SummaryItem label="Rank">{p2.standing ? `#${p2.standing.rank} of ${p2.of}` : "—"}</SummaryItem>
              <SummaryItem label="Solved">
                {p2.standing?.solved ?? 0} of {p2.owned.filter((o) => !o.voided_at).length} owned
              </SummaryItem>
              <SummaryItem label="Total solve time">{duration(p2.standing?.total_time_ms ?? null)}</SummaryItem>
            </Summary>
          </Section>

          {p2.owned.length === 0 ? (
            <Section padded={false}>
              <EmptyState
                icon={<Icon.Gavel />}
                title="They own no questions"
                body="They either lost every bid or did not reach Phase 2. Owning nothing is a legitimate outcome of the auction."
              />
            </Section>
          ) : (
            p2.owned.map((o) => <OwnedQuestion key={o.question_id} o={o} />)
          )}
        </TabsContent>

        <TabsContent value="money">
          <Section
            title="Ledger"
            description="Every coin in and out, newest first. The balance after each movement is what they saw at the time."
            padded={false}
          >
            {p2.ledger.length === 0 ? (
              <EmptyState compact icon={<Icon.Coins />} title="Nothing recorded yet" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">Time</TableHead>
                    <TableHead>What happened</TableHead>
                    <TableHead className="hidden md:table-cell">Reference</TableHead>
                    <TableHead className="text-right">Change</TableHead>
                    <TableHead className="text-right">Balance after</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {p2.ledger.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        <LocalTime iso={l.created_at} />
                      </TableCell>
                      <TableCell className="font-medium">{LEDGER_LABEL[l.reason] ?? l.reason}</TableCell>
                      <TableCell className="hidden font-mono text-[11.5px] text-faint md:table-cell">{l.ref}</TableCell>
                      <TableCell className={cn("text-right font-semibold tabular-nums", l.delta < 0 ? "text-destructive" : "text-brand-deep")}>
                        {l.delta > 0 ? "+" : ""}
                        {l.delta.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{l.balance_after.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Section>
        </TabsContent>
      </Tabs>
    </PageBody>
  );
}

// ---------------------------------------------------------------------------

function PuzzleItem({ q }: { q: Dossier["phase1"]["puzzles"][number] }) {
  const total = q.points_possible + q.explain_possible;
  const pending = q.answered && q.awarded === null;
  const answer = answerText(q.answer);

  return (
    <li className="px-5 py-3.5">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1.5">
        <span
          className={cn(
            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
            !q.answered
              ? "border border-line-2 bg-card text-faint"
              : pending
                ? "bg-blue-tint text-blue ring-1 ring-blue/30"
                : (q.awarded ?? 0) >= total
                  ? "bg-green text-white"
                  : (q.awarded ?? 0) > 0
                    ? "bg-amber-tint text-amber ring-1 ring-amber-bg/40"
                    : "bg-red-tint text-red ring-1 ring-red/30",
          )}
        >
          {!q.answered ? "–" : pending ? "?" : (q.awarded ?? 0) >= total ? <Icon.Check size={11} strokeWidth={3} /> : (q.awarded ?? 0) > 0 ? "½" : <Icon.X size={11} strokeWidth={3} />}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13.5px] font-semibold">{q.title}</span>
            <Badge variant="outline">{q.kind.replace(/_/g, " ")}</Badge>
            <Badge variant="outline">{q.grading}</Badge>
          </div>

          {q.answered ? (
            <div className="mt-2 space-y-2">
              <div>
                <div className="text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">Their answer</div>
                <div className="mt-0.5 font-mono text-[12.5px] break-words">{answer || <span className="text-faint">left blank</span>}</div>
              </div>
              {q.explanation && (
                <div>
                  <div className="text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">Their reasoning</div>
                  <div className="mt-0.5 text-[12.5px] whitespace-pre-wrap">{q.explanation}</div>
                </div>
              )}
              {q.grade_comment && (
                <div>
                  <div className="text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">Evaluator's note</div>
                  <div className="mt-0.5 text-[12.5px]">{q.grade_comment}</div>
                </div>
              )}
              {q.score_error && (
                <Alert variant="destructive">
                  <Icon.Alert />
                  <AlertDescription>The validator errored: {q.score_error}</AlertDescription>
                </Alert>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-faint">
                {q.auto_score !== null && <span>auto {q.auto_score}</span>}
                {q.manual_score !== null && <span>evaluator {q.manual_score}</span>}
                {q.explain_score !== null && <span>reasoning {q.explain_score}</span>}
                {q.updated_at && (
                  <span>
                    last changed <LocalTime iso={q.updated_at} />
                  </span>
                )}
              </div>
            </div>
          ) : (
            <p className="mt-1 text-[12.5px] text-faint">Never answered.</p>
          )}
        </div>

        <div className="shrink-0 text-right">
          {pending ? (
            <Badge variant="review">awaiting grading</Badge>
          ) : (
            <span className="text-[15px] font-semibold tabular-nums">
              {q.awarded ?? 0}
              <span className="text-[12px] font-normal text-faint">/{total}</span>
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

function HackItem({ h }: { h: Dossier["phase1"]["hacks"][number] }) {
  const broke = h.attempts.some((a) => a.hacked);
  return (
    <li className="px-5 py-3.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="text-[13.5px] font-semibold">{h.title}</span>
        {broke ? <Badge variant="success">broke it</Badge> : h.attempts.length ? <Badge variant="neutral">never broke it</Badge> : <Badge variant="outline">no attempt</Badge>}
        <span className="ml-auto text-[15px] font-semibold tabular-nums">
          {h.awarded}
          <span className="text-[12px] font-normal text-faint">/{h.points_possible}</span>
        </span>
      </div>

      {h.attempts.length === 0 ? (
        <p className="mt-1.5 text-[12.5px] text-faint">They never sent an input for this one.</p>
      ) : (
        <ol className="mt-2.5 space-y-2">
          {h.attempts.map((a, i) => (
            <li key={a.id} className="rounded-md border bg-muted/30 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2 text-[12px]">
                <span className="font-semibold text-faint tabular-nums">#{i + 1}</span>
                {a.state !== "done" ? (
                  <Badge variant="info">judging</Badge>
                ) : a.valid_input === false ? (
                  <Badge variant="warning">invalid input</Badge>
                ) : a.hacked ? (
                  <Badge variant="success">hacked</Badge>
                ) : (
                  <Badge variant="destructive">did not break it</Badge>
                )}
                {a.verdict && <span className="font-mono text-[11.5px] text-muted-foreground">{a.verdict}</span>}
                <span className={cn("font-semibold tabular-nums", a.points_awarded > 0 ? "text-brand-deep" : a.points_awarded < 0 ? "text-destructive" : "text-faint")}>
                  {a.points_awarded > 0 ? "+" : ""}
                  {a.points_awarded}
                </span>
                <span className="ml-auto text-faint">
                  <LocalTime iso={a.created_at} />
                </span>
              </div>
              {a.invalid_reason && <p className="mt-1 text-[11.5px] text-amber">{a.invalid_reason}</p>}
              <pre className="pane mt-1.5 max-h-24 overflow-auto rounded border bg-card px-2 py-1.5 text-[11.5px]">{a.input}</pre>
            </li>
          ))}
        </ol>
      )}
    </li>
  );
}

function OwnedQuestion({ o }: { o: Dossier["phase2"]["owned"][number] }) {
  const solved = Boolean(o.solved_at);
  const hintSpend = o.hints_bought.reduce((s, h) => s + h.price_paid, 0);

  return (
    <Section
      title={
        <span className="flex flex-wrap items-center gap-2">
          {o.title}
          {solved ? <Badge variant="success">Solved</Badge> : <Badge variant="warning">Unsolved</Badge>}
          {o.voided_at && <Badge variant="neutral">Voided</Badge>}
          <Badge variant={o.difficulty === "hard" ? "destructive" : o.difficulty === "medium" ? "warning" : "success"}>{o.difficulty}</Badge>
        </span>
      }
      description={<span className="font-mono text-[11.5px]">{o.question_id}</span>}
      actions={
        <span className="text-[15px] font-semibold tabular-nums">
          {solved ? o.score : 0}
          <span className="text-[12px] font-normal text-faint">/{o.score}</span>
        </span>
      }
      padded={false}
    >
      <div className="border-b px-5 py-3.5">
        <Summary cols={4}>
          <SummaryItem label="Bought for">{o.price_paid.toLocaleString()}</SummaryItem>
          <SummaryItem label="Won at">
            <LocalTime iso={o.awarded_at} withDate />
          </SummaryItem>
          <SummaryItem label="Solve time">{solved ? duration(o.solve_ms) : "—"}</SummaryItem>
          <SummaryItem label="Submissions">{o.attempts}</SummaryItem>
        </Summary>
      </div>

      {o.hints_bought.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="flex w-full items-center gap-2 border-b px-5 py-2.5 text-[12.5px] font-medium transition-colors hover:bg-muted/40 [&[data-state=open]>svg:first-child]:rotate-90">
            <Icon.ChevronRight size={14} className="shrink-0 text-faint transition-transform" />
            <Icon.Lightbulb size={14} className="text-amber" />
            {o.hints_bought.length} hint{o.hints_bought.length === 1 ? "" : "s"} bought
            <span className="text-faint">· {hintSpend.toLocaleString()} spent</span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="divide-y border-b bg-muted/20">
              {o.hints_bought.map((h) => (
                <li key={h.idx} className="flex gap-4 px-5 py-2.5">
                  <span className="w-24 shrink-0 text-[11.5px] text-faint tabular-nums">
                    Hint {h.idx + 1} · {h.price_paid}
                  </span>
                  <div className="min-w-0 flex-1 text-[12.5px]">
                    <Markdown>{h.body_md}</Markdown>
                  </div>
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      )}

      {o.submissions.length === 0 ? (
        <EmptyState compact icon={<Icon.Code />} title="Never submitted" body="They owned this question and wrote nothing against it." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14 text-right">#</TableHead>
              <TableHead className="w-28">Time</TableHead>
              <TableHead>Verdict</TableHead>
              <TableHead className="hidden sm:table-cell">Language</TableHead>
              <TableHead className="hidden text-right md:table-cell">Tests</TableHead>
              <TableHead className="hidden text-right lg:table-cell">Slowest</TableHead>
              <TableHead className="hidden xl:table-cell">Jury detail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {o.submissions.map((s, i) => (
              <TableRow key={s.id}>
                <TableCell className="text-right text-faint tabular-nums">{o.submissions.length - i}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  <LocalTime iso={s.created_at} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <VerdictBadge verdict={s.state === "done" ? s.verdict : null} />
                    {s.attempt > 1 && <Badge variant="info">rejudged</Badge>}
                  </div>
                </TableCell>
                <TableCell className="hidden font-mono text-[12px] sm:table-cell">{s.language}</TableCell>
                <TableCell className="hidden text-right tabular-nums md:table-cell">
                  {s.passed ?? "—"}
                  <span className="text-faint">/{s.total ?? "—"}</span>
                  {s.first_fail !== null && <span className="text-faint"> @{s.first_fail}</span>}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums lg:table-cell">
                  {s.max_time_ms !== null ? `${s.max_time_ms.toFixed(0)} ms` : "—"}
                </TableCell>
                <TableCell className="hidden max-w-[24ch] truncate font-mono text-[11.5px] text-muted-foreground xl:table-cell" title={s.jury_detail ?? ""}>
                  {s.jury_detail}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Section>
  );
}
