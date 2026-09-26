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

import { LEFT_HOW } from "@/components/admin/left-page-alerts";
import { ActionDialog, type Action, type ActionKind, type ParticipantRow, type UnsoldQuestion } from "@/components/admin/participant-actions";
import { useContest, useEngineEvent } from "@/components/contest-provider";
import { Icon } from "@/components/icons";
import { LocalTime } from "@/components/local-time";
import { Markdown } from "@/components/markdown";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge, VerdictBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageBody, Section } from "@/components/ui/page";
import { DetailSkeleton } from "@/components/ui/skeleton";
import { ActionList, AsideBlock, Detail, ExpandableRow, Facts, LinkRow, RecordBody, RecordHeader } from "@/components/ui/record";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/client";
import { languageName } from "@/lib/languages";
import { cn } from "@/lib/utils";

type Dossier = {
  participant: {
    id: string; name: string; username: string | null; balance: number; preferred_language: string | null;
    disqualified: boolean; disqualified_reason: string | null; registered_at: string; mobile: string | null; email: string | null;
    p1_puzzles_finished_at: string | null; p1_hacking_finished_at: string | null;
    advanced: boolean | null; advancement_reason: string | null;
    proctor_alerts: number; proctor_locked_at: string | null;
  };
  /** Every time they left the page, newest first. */
  left_page: { id: number; kind: "fullscreen" | "blur" | "hidden"; created_at: string }[];
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
    standing: { rank: number; score: number; solved: number; finish_ms: number | null } | null;
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
  powerup: "Powerup bought",
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
  const { state } = useContest();
  const { toast } = useToast();
  const [d, setD] = useState<Dossier | null>(null);
  const [unsold, setUnsold] = useState<UnsoldQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<Action | null>(null);

  const load = useCallback(async () => {
    try {
      const [dossier, q] = await Promise.all([
        api.get<Dossier>(`/api/admin/participants/${id}`),
        api.get<{ questions: { id: string; title: string; basePrice: number; status: string }[] }>("/api/admin/questions").catch(() => ({ questions: [] })),
      ]);
      setD(dossier);
      setUnsold(q.questions.filter((x) => x.status === "unsold"));
    } catch {
      setError("That participant could not be loaded. They may have been removed.");
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);
  useEngineEvent("proctor", (e) => {
    if (e.data.participant_id === id) void load().catch(() => undefined);
  });

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
        <DetailSkeleton tabs={3} stats={4} />
      </PageBody>
    );
  }

  const p = d.participant;
  const p1 = d.phase1;
  const p2 = d.phase2;
  const phase = state?.contest.phase ?? "";
  const inPhase2 = ["auction1", "coding1", "auction2", "final"].includes(phase);
  const spent = p2.ledger.filter((l) => l.delta < 0).reduce((s, l) => s + l.delta, 0);
  const owned = p2.owned.filter((o) => !o.voided_at);
  const row: ParticipantRow = { ...p, owned: owned.length, proctor_locked: p.proctor_locked_at !== null };
  const act = (kind: ActionKind) => setAction({ kind, p: row });

  return (
    <PageBody width="wide">
      <RecordHeader
        back={{ href: "/admin/participants", label: "Participants" }}
        title={p.name}
        chips={
          <>
            {p.disqualified && <Badge variant="destructive">Disqualified</Badge>}
            {p.proctor_locked_at && <Badge variant="destructive">Locked out</Badge>}
            {p.advanced === true && <Badge variant="success">In Phase 2</Badge>}
            {p.advanced === false && <Badge variant="neutral">Not selected</Badge>}
          </>
        }
        meta={p.disqualified ? `Disqualified: ${p.disqualified_reason || "no reason was recorded"}` : `Signs in as ${p.username ?? p.name}`}
        actions={
          <Button variant="outline" size="sm" onClick={load}>
            <Icon.Refresh size={14} /> Refresh
          </Button>
        }
        figures={[
          { label: "Phase 1", value: p1.standing ? `#${p1.standing.rank}` : "–", note: p1.standing ? `of ${p1.of}, ${p1.standing.points} points${p1.standing.provisional ? ", provisional" : ""}` : "no standing", tone: p1.standing?.provisional ? "warning" : "default" },
          { label: "Phase 2", value: p2.standing ? `#${p2.standing.rank}` : "–", note: p2.standing ? `of ${p2.of}, ${p2.standing.score} points` : "not in Phase 2" },
          { label: "Balance", value: p.balance.toLocaleString(), note: `${Math.abs(spent).toLocaleString()} spent`, tone: "success" },
          { label: "Questions", value: owned.length, note: `${owned.filter((o) => o.solved_at).length} solved` },
        ]}
      >
        <Journey p={p} p1={p1} />
      </RecordHeader>

      <RecordBody
        aside={
          <>
            <AsideBlock title="About">
              <Facts
                items={[
                  { label: "Registered", value: <LocalTime iso={p.registered_at} withDate /> },
                  { label: "Mobile", value: p.mobile ?? <span className="font-normal text-faint">not given</span> },
                  { label: "Email", value: p.email ?? <span className="font-normal text-faint">not given</span> },
                  { label: "Writes first in", value: p.preferred_language ? languageName(p.preferred_language) : "not chosen" },
                  { label: "Puzzles finished", value: p.p1_puzzles_finished_at ? <LocalTime iso={p.p1_puzzles_finished_at} /> : <span className="font-normal text-faint">never pressed finish</span> },
                  { label: "Hacking finished", value: p.p1_hacking_finished_at ? <LocalTime iso={p.p1_hacking_finished_at} /> : <span className="font-normal text-faint">never pressed finish</span> },
                  ...(p.advancement_reason ? [{ label: "Selection", value: p.advancement_reason }] : []),
                  {
                    label: "Left the page",
                    value: d.left_page.length === 0
                      ? <span className="font-normal text-faint">never</span>
                      : `${d.left_page.length} time${d.left_page.length === 1 ? "" : "s"}${p.proctor_alerts < d.left_page.length ? `, ${p.proctor_alerts} since the last unlock` : ""}`,
                  },
                  ...(p.proctor_locked_at ? [{ label: "Locked out", value: <LocalTime iso={p.proctor_locked_at} /> }] : []),
                ]}
              />
            </AsideBlock>
            {d.left_page.length > 0 && (
              <AsideBlock title="How they left">
                <ul className="space-y-1.5 text-[12.5px]">
                  {d.left_page.slice(0, 8).map((e) => (
                    <li key={e.id} className="flex items-baseline justify-between gap-3">
                      <span>{LEFT_HOW[e.kind]}</span>
                      <span className="shrink-0 text-faint"><LocalTime iso={e.created_at} /></span>
                    </li>
                  ))}
                  {d.left_page.length > 8 && <li className="text-faint">and {d.left_page.length - 8} more</li>}
                </ul>
              </AsideBlock>
            )}
            <AsideBlock title="Actions">
              <ActionList
                items={[
                  ...(p.proctor_locked_at ? [{ label: "Unlock", icon: <Icon.Unlock />, onSelect: () => act("unlock") }] : []),
                  { label: "Adjust balance", icon: <Icon.Coins />, onSelect: () => act("adjust") },
                  ...(inPhase2 && owned.length === 0 && unsold.length ? [{ label: "Assign an unsold question", icon: <Icon.Gavel />, onSelect: () => act("assign") }] : []),
                  { label: "Reset password", icon: <Icon.Lock />, onSelect: () => act("password") },
                  { label: "Rename", icon: <Icon.Edit />, onSelect: () => act("rename") },
                  p.disqualified
                    ? { label: "Reverse the disqualification", icon: <Icon.Undo />, onSelect: () => act("requalify") }
                    : { label: "Disqualify", icon: <Icon.UserBan />, onSelect: () => act("disqualify"), tone: "destructive" as const },
                  ...(phase === "registration" ? [{ label: "Remove the account", icon: <Icon.Trash />, onSelect: () => act("remove"), tone: "destructive" as const }] : []),
                ]}
              />
              <p className="mt-2 text-[11.5px] text-faint">Each one asks for a reason and is written to the audit log.</p>
            </AsideBlock>
          </>
        }
      >
        <Tabs defaultValue={inPhase2 || p.advanced ? "phase2" : "phase1"}>
          <TabsList className="mb-4">
            <TabsTrigger value="phase1">Phase 1</TabsTrigger>
            <TabsTrigger value="phase2">Phase 2</TabsTrigger>
            <TabsTrigger value="money">Money</TabsTrigger>
          </TabsList>

          <TabsContent value="phase1" className="space-y-5">
            <Section
              title="Puzzles"
              description="Every published puzzle and what they put. A blank is a fact too."
              actions={<span className="text-[12px] text-muted-foreground tabular-nums">{p1.puzzles.filter((q) => q.answered).length} of {p1.puzzles.length} answered</span>}
              padded={false}
            >
              {p1.puzzles.length === 0 ? (
                <EmptyState compact icon={<Icon.Puzzle />} title="No puzzles were published" />
              ) : (
                <ul className="divide-y divide-line/70">
                  {p1.puzzles.map((q) => (
                    <PuzzleRow key={q.question_id} q={q} />
                  ))}
                </ul>
              )}
            </Section>

            <Section
              title="Hacking"
              description="Every input they sent, in order."
              actions={<span className="text-[12px] text-muted-foreground tabular-nums">{p1.hacks.reduce((s, h) => s + h.attempts.length, 0)} attempts</span>}
              padded={false}
            >
              {p1.hacks.length === 0 ? (
                <EmptyState compact icon={<Icon.Bug />} title="No hacking questions were published" />
              ) : (
                <ul className="divide-y divide-line/70">
                  {p1.hacks.map((h) => (
                    <HackRow key={h.question_id} h={h} participantId={p.id} />
                  ))}
                </ul>
              )}
            </Section>
          </TabsContent>

          <TabsContent value="phase2" className="space-y-5">
            <Section
              title="Questions they own"
              description="What each one cost, and every submission against it."
              actions={p2.standing && <span className="text-[12px] text-muted-foreground tabular-nums">{p2.standing.solved} solved, solve time {duration(p2.standing.finish_ms)}</span>}
              padded={false}
            >
              {p2.owned.length === 0 ? (
                <EmptyState compact icon={<Icon.Gavel />} title="They own no questions" body="They lost every bid, or did not reach Phase 2." />
              ) : (
                <ul className="divide-y divide-line/70">
                  {p2.owned.map((o) => (
                    <OwnedRow key={o.question_id} o={o} participantId={p.id} />
                  ))}
                </ul>
              )}
            </Section>
          </TabsContent>

          <TabsContent value="money">
            <Section
              title="Ledger"
              description="Every coin in and out, newest first, with the balance they saw at the time."
              padded={false}
              actions={
                <Link href={`/admin/participants/${id}/powerups`} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-brand hover:underline">
                  Powerups bought and used <Icon.ArrowRight size={12} />
                </Link>
              }
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
      </RecordBody>

      {action && (
        <ActionDialog
          action={action}
          unsold={unsold}
          onClose={() => setAction(null)}
          onDone={async (msg) => { setAction(null); toast({ title: msg, tone: "success" }); await load(); }}
        />
      )}
    </PageBody>
  );
}

// ---------------------------------------------------------------------------

/**
 * The path through the contest, as the one line worth reading first: where
 * they got to, and when. It is a sequence, so it is drawn as one.
 */
function Journey({ p, p1 }: { p: Dossier["participant"]; p1: Dossier["phase1"] }) {
  const steps: { label: string; at: string | null; done: boolean; note?: string }[] = [
    { label: "Registered", at: p.registered_at, done: true },
    { label: "Puzzles", at: p.p1_puzzles_finished_at, done: Boolean(p.p1_puzzles_finished_at) || p1.puzzles.some((q) => q.answered), note: p.p1_puzzles_finished_at ? undefined : p1.puzzles.some((q) => q.answered) ? "answered, never finished" : undefined },
    { label: "Hacking", at: p.p1_hacking_finished_at, done: Boolean(p.p1_hacking_finished_at) || p1.hacks.some((h) => h.attempts.length > 0), note: p.p1_hacking_finished_at ? undefined : p1.hacks.some((h) => h.attempts.length > 0) ? "attempted, never finished" : undefined },
    { label: p.advanced === false ? "Not selected" : "Selected", at: null, done: p.advanced === true, note: p.advanced === null ? "not decided yet" : undefined },
    { label: "Phase 2", at: null, done: p.advanced === true },
  ];
  return (
    <ol className="mt-4 flex flex-wrap items-start gap-x-2 gap-y-3">
      {steps.map((s, i) => (
        <li key={s.label} className="flex items-start gap-2">
          <div className="flex items-start gap-2">
            <span className={cn("mt-[3px] flex size-4 shrink-0 items-center justify-center rounded-full", s.done ? "bg-brand text-white" : "border border-line-2 bg-card")}>
              {s.done && <Icon.Check size={10} strokeWidth={3} />}
            </span>
            <div className="leading-tight">
              <div className={cn("text-[13px]", s.done ? "font-medium" : "text-muted-foreground")}>{s.label}</div>
              <div className="text-[11.5px] text-faint">{s.at ? <LocalTime iso={s.at} /> : s.note ?? (s.done ? "" : "not yet")}</div>
            </div>
          </div>
          {i < steps.length - 1 && <span className={cn("mx-1 mt-[10px] h-px w-6 sm:w-10", steps[i + 1].done ? "bg-brand" : "bg-line-2")} />}
        </li>
      ))}
    </ol>
  );
}

function ScoreMark({ answered, pending, awarded, total }: { answered: boolean; pending: boolean; awarded: number; total: number }) {
  return (
    <span
      className={cn(
        "flex size-5 items-center justify-center rounded-full text-[10px] font-bold",
        !answered ? "border border-line-2 bg-card text-faint"
        : pending ? "bg-blue-tint text-blue ring-1 ring-blue/30"
        : awarded >= total ? "bg-green text-white"
        : awarded > 0 ? "bg-amber-tint text-amber ring-1 ring-amber-bg/40"
        : "bg-red-tint text-red ring-1 ring-red/30",
      )}
    >
      {!answered ? "–" : pending ? "?" : awarded >= total ? <Icon.Check size={11} strokeWidth={3} /> : awarded > 0 ? "½" : <Icon.X size={11} strokeWidth={3} />}
    </span>
  );
}

function Score({ awarded, total }: { awarded: number; total: number }) {
  return (
    <span className="text-[14px] font-semibold tabular-nums">
      {awarded}
      <span className="text-[12px] font-normal text-faint">/{total}</span>
    </span>
  );
}

function PuzzleRow({ q }: { q: Dossier["phase1"]["puzzles"][number] }) {
  const [open, setOpen] = useState(false);
  const total = q.points_possible + q.explain_possible;
  const pending = q.answered && q.awarded === null;
  const answer = answerText(q.answer);
  return (
    <ExpandableRow
      lead={<ScoreMark answered={q.answered} pending={pending} awarded={q.awarded ?? 0} total={total} />}
      title={q.title}
      chips={<Badge variant="outline">{q.kind.replace(/_/g, " ")}</Badge>}
      trail={pending ? <Badge variant="review">awaiting grading</Badge> : <Score awarded={q.awarded ?? 0} total={total} />}
      open={open}
      onToggle={() => setOpen((o) => !o)}
    >
      {q.answered ? (
        <div className="space-y-2">
          <Detail label="Their answer" mono>{answer || <span className="font-sans text-faint">left blank</span>}</Detail>
          {q.explanation && <Detail label="Their reasoning"><span className="whitespace-pre-wrap">{q.explanation}</span></Detail>}
          {q.grade_comment && <Detail label="Evaluator's note">{q.grade_comment}</Detail>}
          {q.score_error && (
            <Alert variant="destructive">
              <Icon.Alert />
              <AlertDescription>The validator errored: {q.score_error}</AlertDescription>
            </Alert>
          )}
          <Detail label="Scored">
            <span className="text-muted-foreground">
              {[
                q.auto_score !== null ? `${q.auto_score} automatically` : null,
                q.manual_score !== null ? `${q.manual_score} by an evaluator` : null,
                q.explain_score !== null ? `${q.explain_score} for the reasoning` : null,
              ].filter(Boolean).join(", ") || "not yet"}
              {q.updated_at && <>, last changed <LocalTime iso={q.updated_at} /></>}
            </span>
          </Detail>
        </div>
      ) : (
        <p className="text-[13px] text-faint">Never answered.</p>
      )}
    </ExpandableRow>
  );
}

function HackRow({ h, participantId }: { h: Dossier["phase1"]["hacks"][number]; participantId: string }) {
  const broke = h.attempts.some((a) => a.hacked);
  const judging = h.attempts.some((a) => a.state !== "done");
  return (
    <LinkRow
      href={`/admin/participants/${participantId}/hacks/${h.question_id}`}
      lead={<ScoreMark answered={h.attempts.length > 0} pending={judging} awarded={broke ? h.points_possible : 0} total={h.points_possible} />}
      title={h.title}
      chips={<span className="text-[12px] text-muted-foreground">{h.attempts.length === 0 ? "no attempt" : `${h.attempts.length} attempt${h.attempts.length === 1 ? "" : "s"}${broke ? ", broke it" : ""}`}</span>}
      trail={<Score awarded={h.awarded} total={h.points_possible} />}
    />
  );
}

function OwnedRow({ o, participantId }: { o: Dossier["phase2"]["owned"][number]; participantId: string }) {
  const solved = Boolean(o.solved_at);
  return (
    <LinkRow
      href={`/admin/participants/${participantId}/questions/${o.question_id}`}
      lead={<span className={cn("mt-1 block size-2.5 rounded-full", o.difficulty === "hard" ? "bg-red" : (o.difficulty === "medium" || o.difficulty === "easy_medium") ? "bg-amber" : "bg-green")} title={o.difficulty} />}
      title={o.title}
      chips={
        <>
          {o.voided_at ? <Badge variant="neutral">Voided</Badge> : solved ? <Badge variant="success">Solved</Badge> : <Badge variant="warning">Unsolved</Badge>}
          <span className="text-[12px] text-muted-foreground">
            bought for {o.price_paid.toLocaleString()}, {o.attempts} submission{o.attempts === 1 ? "" : "s"}
            {o.hints_bought.length ? `, ${o.hints_bought.length} hint${o.hints_bought.length === 1 ? "" : "s"}` : ""}
            {solved ? `, solved in ${duration(o.solve_ms)}` : ""}
          </span>
        </>
      }
      trail={<Score awarded={solved ? o.score : 0} total={o.score} />}
    />
  );
}
