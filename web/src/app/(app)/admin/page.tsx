"use client";

/**
 * The console. Three questions, answered top to bottom: is anything broken,
 * where are we and what happens next, and is the contest actually ready.
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useContest } from "@/components/contest-provider";
import { Countdown } from "@/components/countdown";
import { Icon } from "@/components/icons";
import { LocalTime, plainText } from "@/components/local-time";
import { ReasonAction } from "@/components/reason-action";
import { PHASE_LABEL, PHASE_STEPS } from "@/components/shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageBody, PageHeader, Section } from "@/components/ui/page";
import { Stat, StatRow } from "@/components/ui/stat";
import { Stepper } from "@/components/ui/stepper";
import { Summary, SummaryItem } from "@/components/ui/summary";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/client";

type Health = {
  judge: { status: string; go_judge: string; problems: number; busy: number; capacity: number } | null;
  backlog: { pending: number; inFlight: number; retrying: number; internalErrors: number };
};
type Checks = { next: string | null; blockers: string[]; warnings: string[] };
type Readiness = { items: { key: string; label: string; ok: boolean; detail: string; href: string }[]; done: number; total: number };

export default function AdminDashboard() {
  const { state, refresh, lastEvent } = useContest();
  const { toast } = useToast();
  const [health, setHealth] = useState<Health | null>(null);
  const [checks, setChecks] = useState<Checks | null>(null);
  const [ready, setReady] = useState<Readiness | null>(null);

  const load = useCallback(async () => {
    const [h, c, r] = await Promise.all([
      api.get<Health>("/api/admin/health"),
      api.get<Checks>("/api/admin/contest/phase"),
      api.get<Readiness>("/api/admin/readiness"),
    ]);
    setHealth(h);
    setChecks(c);
    setReady(r);
  }, []);
  const bump = lastEvent?.name === "phase" ? lastEvent.at : 0;
  useEffect(() => {
    void load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load, bump]);

  if (!state) return null;
  const c = state.contest;
  const judgeDown = !health?.judge || health.judge.status !== "ok";
  const idx = PHASE_STEPS.findIndex((s) => s.key === c.phase);
  const blocked = (checks?.blockers.length ?? 0) > 0;

  return (
    <PageBody width="wide">
      <PageHeader
        title="Dashboard"
        description="Health, the phase you are in, and whether the contest is ready to run."
        actions={
          <Button variant="outline" size="sm" onClick={load}>
            <Icon.Refresh size={14} /> Refresh
          </Button>
        }
      />

      <div className="space-y-5">
        {judgeDown && health && (
          <Alert variant="destructive">
            <Icon.Alert />
            <AlertTitle>The judge is unreachable</AlertTitle>
            <AlertDescription>
              Nothing can be judged until it is back. Submissions queue and retry on their own — none are lost.
            </AlertDescription>
          </Alert>
        )}

        <StatRow cols={4}>
          <Stat
            label="Judge"
            value={health?.judge ? "Healthy" : "Down"}
            tone={judgeDown ? "destructive" : "success"}
            icon={<Icon.Server size={13} />}
            hint={health?.judge ? `${health.judge.busy} of ${health.judge.capacity} slots busy` : "check the sandbox container"}
          />
          <Stat
            label="In flight"
            value={health ? health.backlog.inFlight : "—"}
            icon={<Icon.Play size={13} />}
            hint={health ? `${health.backlog.pending} waiting to be sent` : undefined}
          />
          <Stat
            label="Retrying"
            value={health?.backlog.retrying ?? "—"}
            tone={health?.backlog.retrying ? "warning" : "default"}
            icon={<Icon.Refresh size={13} />}
            hint={health?.backlog.retrying ? "the judge has not accepted these yet" : "nothing stuck"}
          />
          <Stat
            label="Internal errors"
            value={health?.backlog.internalErrors ?? "—"}
            tone={health?.backlog.internalErrors ? "destructive" : "default"}
            icon={<Icon.Alert size={13} />}
            hint={health?.backlog.internalErrors ? "investigate in Submissions" : "none"}
          />
        </StatRow>

        <Section
          title="Contest control"
          description={`Step ${idx + 1} of ${PHASE_STEPS.length}. Only you advance the contest; nothing moves on its own.`}
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
          <div className="border-b bg-muted/30 px-5 py-3">
            <Stepper steps={PHASE_STEPS} current={c.phase} />
          </div>

          <div className="space-y-3 px-5 py-4">
            {!checks?.next ? (
              <p className="text-[13px] text-muted-foreground">The contest has ended. Export the results from the audit log.</p>
            ) : (
              <>
                {blocked && (
                  <Alert variant="destructive">
                    <Icon.Alert />
                    <AlertTitle>Cannot advance yet</AlertTitle>
                    <AlertDescription>
                      <ul className="ml-4 list-disc space-y-0.5">
                        {checks.blockers.map((b) => (
                          <li key={b}>{b}</li>
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
                        {checks.warnings.map((w) => (
                          <li key={w}>{w}</li>
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
                      fields={[{ name: "minutes", label: "Minutes to add", type: "number", defaultValue: "10" }]}
                      onConfirm={async (reason, v) => {
                        await api.post("/api/admin/contest/extend", { reason, minutes: Number(v.minutes) });
                        toast({ title: `Extended by ${v.minutes} minutes`, tone: "success" });
                        await refresh();
                      }}
                    />
                  )}
                  {c.phase === "registration" && (
                    <ReasonAction
                      label={c.registration_open ? "Close registration" : "Reopen registration"}
                      title={c.registration_open ? "Close registration?" : "Reopen registration?"}
                      icon={c.registration_open ? <Icon.Lock size={14} /> : <Icon.Unlock size={14} />}
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

        <LiveAuction />

        <div className="grid gap-5 lg:grid-cols-5">
          <Section
            className="lg:col-span-3"
            title="Readiness"
            description={
              ready
                ? ready.done === ready.total
                  ? "Everything checks out."
                  : `${ready.total - ready.done} thing${ready.total - ready.done === 1 ? "" : "s"} to fix before the contest.`
                : "Checking…"
            }
            actions={ready && <Badge variant={ready.done === ready.total ? "success" : "warning"}>{ready.done}/{ready.total}</Badge>}
            padded={false}
          >
            {!ready ? (
              <EmptyState compact title="Checking…" />
            ) : (
              <ul className="divide-y">
                {ready.items.map((it) => (
                  <li key={it.key}>
                    <Link href={it.href} className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-muted/50">
                      <span
                        className={`flex size-5 shrink-0 items-center justify-center rounded-full ${
                          it.ok ? "bg-green-tint text-green-dark" : "bg-amber-tint text-amber"
                        }`}
                      >
                        {it.ok ? <Icon.Check size={12} strokeWidth={3} /> : <Icon.Alert size={11} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-[13px] ${it.ok ? "text-muted-foreground" : "font-semibold"}`}>{it.label}</span>
                        <span className="block truncate text-[11.5px] text-faint">{it.detail}</span>
                      </span>
                      <Icon.ChevronRight size={15} className="shrink-0 text-faint" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Announce className="lg:col-span-2" />
        </div>
      </div>
    </PageBody>
  );
}

function LiveAuction() {
  const { state } = useContest();
  const { toast } = useToast();
  const a = state?.auction;
  if (!a) return null;
  const lot = a.lot;
  const position = lot ? a.order.findIndex((o) => o.id === lot.id) + 1 : 0;

  return (
    <Section
      title={`Auction ${a.round} — live`}
      description={lot ? `Lot ${position} of ${a.order.length} · ${a.order.filter((o) => o.state === "closed").length} sold` : "Between lots"}
      actions={
        <>
          <ReasonAction
            label="Close bidding"
            title="Close bidding on the open lot"
            disabled={!lot}
            icon={<Icon.Gavel size={14} />}
            description="The highest bidder wins it immediately. If there are no bids it goes unsold."
            onConfirm={async (reason) => {
              await api.post("/api/admin/lots/close", { reason });
              toast({ title: "Lot closed", tone: "success" });
            }}
          />
          <ReasonAction
            label="Disable timer"
            title="Disable the countdown on this lot"
            disabled={!lot}
            icon={<Icon.Pause size={14} />}
            description="Bidding then stays open until you close it by hand."
            onConfirm={async (reason) => {
              await api.post("/api/admin/lots/disable-timer", { reason });
              toast({ title: "Timer disabled", tone: "success" });
            }}
          />
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
              <Countdown until={lot.current_bid !== null ? lot.bidding_ends_at : lot.no_bid_deadline} />
            </span>
          </SummaryItem>
        </Summary>
      ) : (
        <p className="text-[13px] text-muted-foreground">All lots are settled. Advance the phase when you are ready.</p>
      )}
    </Section>
  );
}

function Announce({ className }: { className?: string }) {
  const { state } = useContest();
  const recent = state?.announcements ?? [];
  return (
    <Section
      className={className}
      title="Announcements"
      description="Appear on every screen at once and stay readable for the rest of the contest."
      padded={false}
      actions={
        <Button size="sm" asChild>
          <Link href="/admin/announcements">
            <Icon.Send size={14} /> New
          </Link>
        </Button>
      }
    >
      {recent.length === 0 ? (
        <EmptyState
          compact
          icon={<Icon.Megaphone />}
          title="Nothing announced yet"
          body="Announce the selection basis before Phase 1 and the leaderboard mode before the first auction."
        />
      ) : (
        <ul className="divide-y">
          {recent.slice(0, 5).map((a) => (
            <li key={a.id} className="px-5 py-2.5">
              <div className="text-[11px] text-faint">
                <LocalTime iso={a.createdAt} />
              </div>
              <div className="mt-0.5 line-clamp-2 text-[12.5px] leading-relaxed">{plainText(a.bodyMd)}</div>
            </li>
          ))}
          <li className="px-5 py-2 text-right">
            <Link href="/admin/announcements" className="text-[12px] font-semibold text-green-dark hover:underline">
              All announcements
            </Link>
          </li>
        </ul>
      )}
    </Section>
  );
}
