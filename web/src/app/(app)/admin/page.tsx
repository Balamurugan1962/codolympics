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
import { ReasonAction } from "@/components/reason-action";
import { PHASE_LABEL, PHASE_STEPS } from "@/components/shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageBody, PageHeader, Section } from "@/components/ui/page";
import { Stat, StatRow } from "@/components/ui/stat";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/client";

type Health = { judge: { status: string; go_judge: string; problems: number; busy: number; capacity: number } | null; backlog: { pending: number; inFlight: number; retrying: number; internalErrors: number } };
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
    setHealth(h); setChecks(c); setReady(r);
  }, []);
  const bump = lastEvent?.name === "phase" ? lastEvent.at : 0;
  useEffect(() => { void load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [load, bump]);

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
        actions={<Button variant="secondary" size="sm" icon={<Icon.Refresh size={14} />} onClick={load}>Refresh</Button>}
      />

      <div className="space-y-4">
        {judgeDown && health && (
          <Alert tone="error" title="The judge is unreachable">
            Nothing can be judged until it is back. Submissions queue and retry on their own — none are lost.
          </Alert>
        )}

        <StatRow cols={4}>
          <Stat label="Judge" value={health?.judge ? "Healthy" : "Down"} tone={judgeDown ? "red" : "green"} icon={<Icon.Code size={13} />}
            hint={health?.judge ? `${health.judge.busy} of ${health.judge.capacity} slots busy` : "check the sandbox container"} />
          <Stat label="In flight" value={health ? health.backlog.inFlight : "—"} icon={<Icon.Play size={13} />}
            hint={health ? `${health.backlog.pending} waiting to be sent` : undefined} />
          <Stat label="Retrying" value={health?.backlog.retrying ?? "—"} tone={health?.backlog.retrying ? "amber" : "ink"} icon={<Icon.Refresh size={13} />}
            hint={health?.backlog.retrying ? "the judge has not accepted these yet" : "nothing stuck"} />
          <Stat label="Internal errors" value={health?.backlog.internalErrors ?? "—"} tone={health?.backlog.internalErrors ? "red" : "ink"} icon={<Icon.Alert size={13} />}
            hint={health?.backlog.internalErrors ? "investigate in Submissions" : "none"} />
        </StatRow>

        <Section
          title="Contest control"
          description={`Step ${idx + 1} of ${PHASE_STEPS.length}. Only you advance the contest; nothing moves on its own.`}
          actions={c.phase_ends_at ? <span className="flex items-center gap-1.5 text-[13px] text-muted"><Icon.Clock size={14} /><Countdown until={c.phase_ends_at} className="font-semibold text-ink" /> left</span> : undefined}
          padded={false}
        >
          <div className="border-b border-line px-5 py-4">
            <ol className="flex flex-wrap items-center gap-y-2">
              {PHASE_STEPS.map((s, i) => {
                const done = i < idx, now = i === idx;
                return (
                  <li key={s.key} className="flex items-center">
                    <span className={`flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-[12px] font-semibold ${
                      now ? "bg-green-tint text-green-dark ring-1 ring-green/30" : done ? "text-muted" : "text-faint"}`}>
                      <span className={`flex h-4.5 w-4.5 items-center justify-center rounded-full text-[10px] ${
                        done ? "bg-green text-white" : now ? "bg-green-dark text-white" : "border border-line-2 bg-card"}`} style={{ height: 18, width: 18 }}>
                        {done ? <Icon.Check size={10} strokeWidth={3} /> : i + 1}
                      </span>
                      {s.label}
                    </span>
                    {i < PHASE_STEPS.length - 1 && <span className={`mx-1 h-px w-3 ${done ? "bg-green/50" : "bg-line-2"}`} />}
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="space-y-3 px-5 py-4">
            {!checks?.next ? (
              <p className="text-[13px] text-muted">The contest has ended. Export the results from the audit log.</p>
            ) : (
              <>
                {blocked && <Alert tone="error" title="Cannot advance yet"><ul className="ml-4 list-disc space-y-0.5">{checks.blockers.map((b) => <li key={b}>{b}</li>)}</ul></Alert>}
                {checks.warnings.length > 0 && <Alert tone="warning" title="Advancing will acknowledge these"><ul className="ml-4 list-disc space-y-0.5">{checks.warnings.map((w) => <li key={w}>{w}</li>)}</ul></Alert>}
                <div className="flex flex-wrap items-center gap-2">
                  <ReasonAction
                    label={`Advance to ${PHASE_LABEL[checks.next]}`} title={`Advance to ${PHASE_LABEL[checks.next]}?`} variant="primary" size="md" disabled={blocked}
                    description={checks.next === "auction1" ? "Lots are created in auction order and the first opens immediately." : ["p1_puzzles", "p1_hacking", "coding1", "final"].includes(checks.next) ? "The timer for this round starts the moment you confirm." : undefined}
                    onConfirm={async (reason) => { await api.post("/api/admin/contest/phase", { reason, acknowledge_warnings: true }); toast({ title: `Now: ${PHASE_LABEL[checks.next!]}`, tone: "success" }); await refresh(); await load(); }} />
                  {c.phase_ends_at && (
                    <ReasonAction label="Extend round" title="Extend the current round" fields={[{ name: "minutes", label: "Minutes to add", type: "number", defaultValue: "10" }]}
                      onConfirm={async (reason, v) => { await api.post("/api/admin/contest/extend", { reason, minutes: Number(v.minutes) }); toast({ title: `Extended by ${v.minutes} minutes`, tone: "success" }); await refresh(); }} />
                  )}
                  {c.phase === "registration" && (
                    <ReasonAction label={c.registration_open ? "Close registration" : "Reopen registration"} title={c.registration_open ? "Close registration?" : "Reopen registration?"}
                      description="The roster must be final before Phase 1, because everyone starts with the same money."
                      onConfirm={async (reason) => { await api.post("/api/admin/contest/registration", { reason, open: !c.registration_open }); await refresh(); await load(); }} />
                  )}
                </div>
              </>
            )}
          </div>
        </Section>

        <LiveAuction />

        <div className="grid gap-4 lg:grid-cols-5">
          <Section
            className="lg:col-span-3"
            title="Readiness"
            description={ready ? (ready.done === ready.total ? "Everything checks out." : `${ready.total - ready.done} thing${ready.total - ready.done === 1 ? "" : "s"} to fix before the contest.`) : "Checking…"}
            actions={ready && <Badge tone={ready.done === ready.total ? "green" : "amber"}>{ready.done}/{ready.total}</Badge>}
            padded={false}
          >
            {!ready ? <div className="p-5"><EmptyState compact title="Checking…" /></div> : (
              <ul className="divide-y divide-line">
                {ready.items.map((it) => (
                  <li key={it.key}>
                    <Link href={it.href} className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-page/60">
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${it.ok ? "bg-green/10 text-green-dark" : "bg-amber-tint text-[#8a6100]"}`}>
                        {it.ok ? <Icon.Check size={12} strokeWidth={3} /> : <Icon.Alert size={12} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-[13px] ${it.ok ? "text-muted" : "font-semibold text-ink"}`}>{it.label}</span>
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
        <div className="flex gap-2">
          <ReasonAction label="Close bidding" title="Close bidding on the open lot" disabled={!lot}
            description="The highest bidder wins it immediately. If there are no bids it goes unsold."
            onConfirm={async (reason) => { await api.post("/api/admin/lots/close", { reason }); toast({ title: "Lot closed", tone: "success" }); }} />
          <ReasonAction label="Disable timer" title="Disable the countdown on this lot" disabled={!lot}
            description="Bidding then stays open until you close it by hand."
            onConfirm={async (reason) => { await api.post("/api/admin/lots/disable-timer", { reason }); toast({ title: "Timer disabled", tone: "success" }); }} />
        </div>
      }
    >
      {lot ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <div><div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">Now offering</div><div className="mt-1 truncate text-[15px] font-semibold">{lot.title}</div></div>
          <div><div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">Highest bid</div><div className="mt-1 text-[15px] font-semibold tabular-nums">{lot.current_bid ?? "—"} <span className="font-normal text-muted">{lot.current_bidder_name ? `by ${lot.current_bidder_name}` : "no bids"}</span></div></div>
          <div><div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">{lot.current_bid !== null ? "Closes in" : "Opens for"}</div><div className="mt-1 text-[15px] font-semibold"><Countdown until={lot.current_bid !== null ? lot.bidding_ends_at : lot.no_bid_deadline} /></div></div>
        </div>
      ) : <p className="text-[13px] text-muted">All lots are settled. Advance the phase when you are ready.</p>}
    </Section>
  );
}

function Announce({ className = "" }: { className?: string }) {
  const { toast } = useToast();
  const { state } = useContest();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const recent = state?.announcements ?? [];

  async function send() {
    setBusy(true);
    try { await api.post("/api/admin/announcements", { body_md: text }); setText(""); toast({ title: "Announced to everyone", tone: "success" }); }
    catch (err) { toast({ title: "Not sent", description: errorMessage(err), tone: "error" }); } finally { setBusy(false); }
  }

  return (
    <Section className={className} title="Announcements" description="Appears on every screen at once and stays readable for the rest of the contest." padded={false}>
      <div className="flex gap-2 border-b border-line p-4">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Markdown is fine" onKeyDown={(e) => { if (e.key === "Enter" && text.trim()) void send(); }} />
        <Button loading={busy} disabled={!text.trim()} icon={<Icon.Send size={14} />} onClick={send}>Send</Button>
      </div>
      {recent.length === 0 ? (
        <EmptyState compact icon={<Icon.Bell size={18} />} title="Nothing announced yet" />
      ) : (
        <ul className="divide-y divide-line">
          {recent.slice(0, 5).map((a) => (
            <li key={a.id} className="px-4 py-2.5">
              <div className="text-[11px] text-faint">{new Date(a.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
              <div className="mt-0.5 line-clamp-2 text-[12.5px] leading-relaxed">{a.bodyMd}</div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
