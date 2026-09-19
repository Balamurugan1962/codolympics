"use client";

/**
 * The console, and it follows the contest.
 *
 * The dashboard answers one question — what is happening right now, and what
 * do I do next — so what sits below the controls changes with the phase: who
 * has registered while you are waiting for people, the Section A board while
 * Section A runs, grading progress during review, the auction and the Phase 2
 * board once bidding starts. Everything else (the judge, the checklist, the
 * full boards) has its own page and is one line away.
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { StandingsCard, useStandings, type P1Row } from "@/components/admin/standings";
import { useContest, useEngineEvent } from "@/components/contest-provider";
import { Countdown } from "@/components/countdown";
import { Icon } from "@/components/icons";
import { ActionButton } from "@/components/action-button";
import { ReasonAction } from "@/components/reason-action";
import { PHASE_LABEL, PHASE_STEPS } from "@/components/shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageBody, PageHeader, Section } from "@/components/ui/page";
import { SectionSkeleton, Skeleton, StepperSkeleton } from "@/components/ui/skeleton";
import { Stat, StatRow } from "@/components/ui/stat";
import { Stepper } from "@/components/ui/stepper";
import { Summary, SummaryItem } from "@/components/ui/summary";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/client";

type Health = { judge: { status: string } | null; backlog: { pending: number; inFlight: number; retrying: number; internalErrors: number } };
type Checks = { next: string | null; blockers: string[]; warnings: string[] };
type Readiness = { done: number; total: number };
type Participant = { id: string; name: string; username: string | null; balance: number; owned: number; disqualified: boolean };
type Queue = { ungraded: number; total: number };

export default function AdminDashboard() {
  const { state, refresh } = useContest();
  const { toast } = useToast();
  const { data: boards } = useStandings();
  const [health, setHealth] = useState<Health | null>(null);
  const [checks, setChecks] = useState<Checks | null>(null);
  const [ready, setReady] = useState<Readiness | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [h, c, r] = await Promise.all([
      api.get<Health>("/api/admin/health"),
      api.get<Checks>("/api/admin/contest/phase"),
      api.get<Readiness>("/api/admin/readiness"),
    ]);
    setHealth(h);
    setChecks(c);
    setReady(r);
    setLoaded(true);
  }, []);
  useEffect(() => {
    void load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);
  useEngineEvent("phase", load);

  // The header is real from the first paint and the body waits in the shape it
  // will take. Returning null here left the screen blank until /api/state came
  // back, which on a cold load reads as a broken page rather than a loading one.
  if (!state || !loaded) {
    return (
      <PageBody width="wide">
        <PageHeader title="Dashboard" />
        <DashboardSkeleton />
      </PageBody>
    );
  }
  const c = state.contest;
  const canControl = state.viewer.role === "admin";
  const phase = c.phase;
  const idx = PHASE_STEPS.findIndex((s) => s.key === phase);
  const blocked = (checks?.blockers.length ?? 0) > 0;
  const judgeDown = Boolean(health) && (!health!.judge || health!.judge.status !== "ok");
  const errors = health?.backlog.internalErrors ?? 0;

  return (
    <PageBody width="wide">
      <PageHeader
        title="Dashboard"
        actions={
          <Button variant="outline" size="sm" onClick={load}>
            <Icon.Refresh size={14} /> Refresh
          </Button>
        }
      />

      <div className="space-y-5">
          {(judgeDown || errors > 0) && (
            <Alert variant={judgeDown ? "destructive" : "warning"}>
              <Icon.Alert />
              <AlertTitle>
                {judgeDown ? "The judge is unreachable" : `${errors} submission${errors === 1 ? "" : "s"} ended in an internal error`}
              </AlertTitle>
              <AlertDescription>
                {judgeDown
                  ? "Nothing can be judged until it is back. Submissions queue and retry on their own — none are lost."
                  : "An internal error is the judge's fault, not the competitor's."}{" "}
                <Link href="/admin/judge" className="font-semibold text-brand-deep hover:underline">
                  Open the judge
                </Link>
              </AlertDescription>
            </Alert>
          )}

          <Section
            title="Contest control"
            description="Only you advance the contest; nothing moves on its own."
            actions={
              c.phase_ends_at ? (
                <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                  <Icon.Clock size={14} />
                  <Countdown until={c.phase_ends_at} className="font-semibold text-foreground" /> left
                </span>
              ) : undefined
            }
            padded={false}
          >
            <div className="border-b bg-muted/30 px-5 py-4">
              <Stepper steps={PHASE_STEPS} current={phase} />
            </div>

            <div className="space-y-3 px-5 py-4">
              {!canControl ? (
                <p className="text-[13px] text-muted-foreground">
                  {checks?.next
                    ? `Next is ${PHASE_LABEL[checks.next] ?? checks.next}. Only an administrator moves the contest on.`
                    : "The contest has ended."}
                </p>
              ) : !checks?.next ? (
                <p className="text-[13px] text-muted-foreground">The contest has ended. Export the results from the audit log.</p>
              ) : (
                <>
                  {blocked && (
                    <Alert variant="destructive">
                      <Icon.Alert />
                      <AlertTitle>Cannot advance yet</AlertTitle>
                      <AlertDescription>
                        <ul className="ml-4 list-disc space-y-0.5">
                          {checks.blockers.map((x) => (
                            <li key={x}>{x}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
                  {checks.warnings.length > 0 && (
                    <Alert variant="warning">
                      <Icon.Alert />
                      <AlertTitle>Advancing will acknowledge these</AlertTitle>
                      <AlertDescription>
                        <ul className="ml-4 list-disc space-y-0.5">
                          {checks.warnings.map((x) => (
                            <li key={x}>{x}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <ReasonAction
                      label={`Advance to ${PHASE_LABEL[checks.next]}`}
                      title={`Advance to ${PHASE_LABEL[checks.next]}?`}
                      variant="default"
                      size="default"
                      icon={<Icon.ArrowRight size={15} />}
                      disabled={blocked}
                      defaultReason={`${PHASE_LABEL[phase]} is finished; moving the contest on to ${PHASE_LABEL[checks.next]}.`}
                      description={
                        checks.next === "auction1"
                          ? "Lots are created in auction order and the first opens immediately."
                          : ["p1_puzzles", "p1_hacking", "coding1", "final"].includes(checks.next)
                            ? "The timer for this round starts the moment you confirm."
                            : undefined
                      }
                      onConfirm={async (reason) => {
                        await api.post("/api/admin/contest/phase", { reason, acknowledge_warnings: true });
                        toast({ title: `Now: ${PHASE_LABEL[checks.next!]}`, tone: "success" });
                        await refresh();
                        await load();
                      }}
                    />
                    {c.phase_ends_at && (
                      <ReasonAction
                        label="Extend round"
                        title="Extend the current round"
                        icon={<Icon.Timer size={14} />}
                        defaultReason={`Giving everyone more time in ${PHASE_LABEL[phase]}.`}
                        fields={[{ name: "minutes", label: "Minutes to add", type: "number", defaultValue: "10" }]}
                        onConfirm={async (reason, v) => {
                          await api.post("/api/admin/contest/extend", { reason, minutes: Number(v.minutes) });
                          toast({ title: `Extended by ${v.minutes} minutes`, tone: "success" });
                          await refresh();
                        }}
                      />
                    )}
                    {phase === "registration" && (
                      <ReasonAction
                        label={c.registration_open ? "Close registration" : "Reopen registration"}
                        title={c.registration_open ? "Close registration?" : "Reopen registration?"}
                        icon={c.registration_open ? <Icon.Lock size={14} /> : <Icon.Unlock size={14} />}
                        defaultReason={
                          c.registration_open
                            ? "The roster is final; closing registration before Phase 1."
                            : "Someone still needs to register; reopening."
                        }
                        description="The roster must be final before Phase 1, because everyone starts with the same money."
                        onConfirm={async (reason) => {
                          await api.post("/api/admin/contest/registration", { reason, open: !c.registration_open });
                          await refresh();
                          await load();
                        }}
                      />
                    )}
                  </div>
                </>
              )}
            </div>
          </Section>

          {phase === "registration" && <RegistrationPanel ready={ready} />}
          {(phase === "p1_puzzles" || phase === "p1_hacking") && <Phase1Panel phase={phase} rows={boards?.phase1 ?? null} />}
          {phase === "review" && <ReviewPanel rows={boards?.phase1 ?? null} />}
          {["auction1", "auction2"].includes(phase) && <LiveAuction />}
          {["auction1", "coding1", "auction2", "final", "ended"].includes(phase) && (
            <StandingsCard phase="phase2" rows1={boards?.phase1 ?? null} rows2={boards?.phase2 ?? null} />
          )}
      </div>
    </PageBody>
  );
}

// ---------------------------------------------------------------------------

/** Waiting for people: who has signed up, and whether the contest is ready for them. */
function RegistrationPanel({ ready }: { ready: Readiness | null }) {
  const [rows, setRows] = useState<Participant[] | null>(null);
  useEffect(() => {
    const load = async () => setRows((await api.get<{ participants: Participant[] }>("/api/admin/participants")).participants);
    void load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const left = ready ? ready.total - ready.done : 0;

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <Section
        className="lg:col-span-3"
        title="Registering"
        description="Updates as people sign up at their machines."
        actions={
          <Link href="/admin/participants" className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand-deep hover:underline">
            Everyone <Icon.ChevronRight size={13} />
          </Link>
        }
        padded={false}
      >
        {!rows ? (
          <div className="space-y-2.5 p-5">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/5" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState compact icon={<Icon.Users />} title="Nobody yet" body="Send people to the registration page and they will appear here." />
        ) : (
          <ul className="divide-y">
            {rows
              .slice(-8)
              .reverse()
              .map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-muted-foreground">
                    {p.name.slice(0, 1).toUpperCase()}
                  </span>
                  <Link
                    href={`/admin/participants/${p.id}`}
                    className="min-w-0 flex-1 truncate text-[13px] font-medium hover:text-brand-deep hover:underline"
                  >
                    {p.name}
                  </Link>
                  <span className="font-mono text-[11.5px] text-faint">{p.username}</span>
                </li>
              ))}
          </ul>
        )}
      </Section>

      <Section className="lg:col-span-2" title="Before you start">
        <StatRow cols={2} className="mb-4">
          <Stat label="Registered" value={rows?.length ?? "—"} icon={<Icon.Users size={13} />} />
          <Stat
            label="Checks passing"
            value={ready ? `${ready.done}/${ready.total}` : "—"}
            tone={left ? "warning" : "success"}
            icon={<Icon.ListChecks size={13} />}
          />
        </StatRow>
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">
          {left ? (
            <>
              {left} thing{left === 1 ? "" : "s"} still to fix before this is fair to run.{" "}
              <Link href="/admin/readiness" className="font-semibold text-brand-deep hover:underline">
                Open the checklist
              </Link>
            </>
          ) : (
            <>Every check passes. Close registration when the roster is final, then start Section A.</>
          )}
        </p>
      </Section>
    </div>
  );
}

/** A section is running: the board it feeds, and how far through people are. */
function Phase1Panel({ phase, rows }: { phase: string; rows: P1Row[] | null }) {
  const section = phase === "p1_puzzles" ? "Section A is open" : "Section B is open";
  const finished = rows?.filter((r) => r.submitted_at).length ?? 0;
  const scoring = rows?.filter((r) => r.points > 0).length ?? 0;

  return (
    <div className="space-y-5">
      <StatRow cols={3}>
        <Stat label="Taking part" value={rows?.length ?? "—"} icon={<Icon.Users size={13} />} hint={section} />
        <Stat label="Pressed finish" value={finished} icon={<Icon.Flag size={13} />} hint="their time is recorded" />
        <Stat
          label="On the board"
          value={scoring}
          icon={<Icon.Trophy size={13} />}
          hint={rows ? `${rows.length - scoring} still on zero` : undefined}
        />
      </StatRow>
      <StandingsCard phase="phase1" rows1={rows} rows2={null} />
    </div>
  );
}

/** Between the sections and the auction: what is left to grade, and the selection. */
function ReviewPanel({ rows }: { rows: P1Row[] | null }) {
  const [queue, setQueue] = useState<Queue | null>(null);
  useEffect(() => {
    const load = async () => setQueue(await api.get<Queue>("/api/grade/queue"));
    void load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, []);

  const provisional = rows?.filter((r) => r.provisional).length ?? 0;
  const chosen = rows?.filter((r) => r.advanced === true).length ?? 0;
  const graded = queue ? queue.total - queue.ungraded : 0;

  return (
    <div className="space-y-5">
      <Section title="Where review stands" description="Grading finishes first, then the selection. Both can be revised until Phase 2 opens.">
        <Summary cols={4}>
          <SummaryItem label="Items graded">
            <span className="text-[15px] font-semibold tabular-nums">
              {graded}
              <span className="text-[12px] font-normal text-faint">/{queue?.total ?? "—"}</span>
            </span>
          </SummaryItem>
          <SummaryItem label="Still with an evaluator">
            {queue?.ungraded ? <Badge variant="review">{queue.ungraded}</Badge> : <span className="text-green-dark">none</span>}
          </SummaryItem>
          <SummaryItem label="Provisional totals">
            {provisional ? <Badge variant="warning">{provisional}</Badge> : <span className="text-green-dark">none</span>}
          </SummaryItem>
          <SummaryItem label="Selected so far">
            <span className="text-[15px] font-semibold tabular-nums">{chosen}</span>
          </SummaryItem>
        </Summary>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link href="/grade">
              <Icon.Scale size={14} /> Grading queue
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/admin/phase1/review">
              <Icon.Flag size={14} /> Choose who advances
            </Link>
          </Button>
        </div>
      </Section>
      <StandingsCard phase="phase1" rows1={rows} rows2={null} />
    </div>
  );
}

function LiveAuction() {
  const { state } = useContest();
  const { toast } = useToast();
  const a = state?.auction;
  if (!a) return null;
  const lot = a.lot;
  const position = lot ? a.order.findIndex((o) => o.id === lot.id) + 1 : 0;
  // Whether a clock is actually running on the open lot: before the first bid
  // it is the opening window, after it the countdown, and either may have been
  // switched off by hand.
  const timerOn = Boolean(lot && (lot.current_bid !== null ? lot.bidding_ends_at : lot.no_bid_deadline));
  const offline = a.mode === "offline";

  return (
    <Section
      title={`Auction ${a.round} — live`}
      description={lot ? `Lot ${position} of ${a.order.length} · ${a.order.filter((o) => o.state === "closed").length} sold` : "Between lots"}
      actions={
        <>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/auction">
              <Icon.Settings size={14} /> All controls
            </Link>
          </Button>
          <ActionButton
            label="Close bidding"
            disabled={!lot}
            icon={<Icon.Gavel size={14} />}
            confirm={{
              title: lot ? `Close bidding on ${lot.title}?` : "Close bidding on the open lot?",
              body: "The highest bidder wins it immediately. If there are no bids it goes unsold.",
              label: "Close bidding",
            }}
            onAct={async () => {
              await api.post("/api/admin/lots/close", { reason: lot ? `Closed bidding on ${lot.title} by hand.` : "Closed bidding by hand." });
              toast({ title: "Lot closed", tone: "success" });
            }}
          />
          {/* Everything that can be stopped here can be started again here.
              Sending someone to another page to undo what this card just did is
              how a timer stays off for the rest of a round. */}
          {!offline &&
            (timerOn ? (
              <ActionButton
                label="Stop the timer"
                disabled={!lot}
                icon={<Icon.Pause size={14} />}
                title="Bidding then stays open until you close it by hand; you can start it again from here"
                onAct={async () => {
                  await api.post("/api/admin/auction/timer", { reason: lot ? `Running ${lot.title} to a manual close.` : "Running this lot to a manual close.", mode: "off" });
                  toast({ title: "Timer stopped", description: "This lot now closes only by hand.", tone: "success" });
                }}
              />
            ) : (
              <ActionButton
                label="Restart timer"
                disabled={!lot}
                icon={<Icon.Play size={14} />}
                title="A full countdown starts now, and the lot settles on its own again"
                onAct={async () => {
                  await api.post("/api/admin/auction/timer", { reason: lot ? `Put the clock back on ${lot.title}.` : "Put the clock back on.", mode: "restart" });
                  toast({ title: "Timer restarted", tone: "success" });
                }}
              />
            ))}

          {a.paused ? (
            <ActionButton
              label="Resume"
              variant="default"
              icon={<Icon.Play size={14} />}
              title="Every deadline moves forward by exactly how long it was held, so whatever time was left is still there"
              onAct={async () => {
                await api.post("/api/admin/auction/resume", { reason: "Auction resumed." });
                toast({ title: "Auction resumed", tone: "success" });
              }}
            />
          ) : (
            <ActionButton
              label="Pause"
              icon={<Icon.Pause size={14} />}
              title="The clock stops where it is, bids are refused, and nothing settles until you resume"
              onAct={async () => {
                await api.post("/api/admin/auction/pause", { reason: "Auction paused." });
                toast({ title: "Auction paused", tone: "success" });
              }}
            />
          )}
        </>
      }
    >
      {lot ? (
        <Summary cols={3}>
          <SummaryItem label="Now offering">
            <span className="block truncate text-[15px] font-semibold">{lot.title}</span>
          </SummaryItem>
          <SummaryItem label="Highest bid">
            <span className="text-[15px] font-semibold tabular-nums">{lot.current_bid ?? "—"}</span>{" "}
            <span className="text-muted-foreground">{lot.current_bidder_name ? `by ${lot.current_bidder_name}` : "no bids"}</span>
          </SummaryItem>
          <SummaryItem label={lot.current_bid !== null ? "Closes in" : "Opens for"}>
            <span className="text-[15px] font-semibold">
              {a.paused ? (
                <span className="text-amber">held</span>
              ) : offline ? (
                <span className="text-muted-foreground">in the room</span>
              ) : timerOn ? (
                <Countdown until={lot.current_bid !== null ? lot.bidding_ends_at : lot.no_bid_deadline} />
              ) : (
                <span className="text-muted-foreground">no timer — closes by hand</span>
              )}
            </span>
          </SummaryItem>
        </Summary>
      ) : (
        <p className="text-[13px] text-muted-foreground">All lots are settled. Advance the phase when you are ready.</p>
      )}
    </Section>
  );
}

/**
 * The dashboard's own shape, greyed out. Nothing claims a value it does not
 * have yet — this screen showing "0 registered" and "judge down" for a second
 * before the real numbers land is worse than showing nothing.
 *
 * It mirrors Contest control exactly: the card, the tinted band holding the
 * phase track, then the row of actions. The track was still drawn as nine
 * chips here long after Stepper became a line with ticks, so the page settled
 * into one layout and then jumped into another.
 */
function DashboardSkeleton() {
  return (
    <div className="space-y-5" role="status" aria-label="Loading" aria-busy>
      <div className="overflow-hidden rounded-lg border bg-card shadow-xs" aria-hidden>
        <div className="border-b px-5 py-4">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="mt-2 h-2.5 w-72" />
        </div>
        <div className="border-b bg-muted/30 px-5 py-4">
          <StepperSkeleton />
        </div>
        <div className="space-y-3 px-5 py-4">
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-9 w-44" />
            <Skeleton className="h-9 w-32" />
          </div>
          <Skeleton className="h-2.5 w-80 max-w-full" />
        </div>
      </div>
      <SectionSkeleton lines={3} />
    </div>
  );
}
