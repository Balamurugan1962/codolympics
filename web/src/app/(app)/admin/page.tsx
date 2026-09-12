"use client";

/**
 * The organiser's overview: is the judge alive, is the contest ready, what
 * phase are we in and what would advancing do. One screen to run the day from.
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
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/client";

type Health = { judge: { status: string; go_judge: string; problems: number; busy: number; capacity: number } | null; backlog: { pending: number; inFlight: number; retrying: number; internalErrors: number } };
type Checks = { next: string | null; blockers: string[]; warnings: string[] };
type Readiness = { items: { key: string; label: string; ok: boolean; detail: string; href: string }[]; done: number; total: number };

export default function AdminOverview() {
  const { state, refresh, lastEvent } = useContest();
  const { toast } = useToast();
  const [health, setHealth] = useState<Health | null>(null);
  const [checks, setChecks] = useState<Checks | null>(null);
  const [ready, setReady] = useState<Readiness | null>(null);
  const load = useCallback(async () => {
    const [h, c, r] = await Promise.all([api.get<Health>("/api/admin/health"), api.get<Checks>("/api/admin/contest/phase"), api.get<Readiness>("/api/admin/readiness")]);
    setHealth(h); setChecks(c); setReady(r);
  }, []);
  const bump = lastEvent?.name === "phase" ? lastEvent.at : 0;
  useEffect(() => { void load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [load, bump]);
  if (!state) return null;
  const c = state.contest;
  const judgeDown = !health?.judge || health.judge.status !== "ok";
  const idx = PHASE_STEPS.findIndex((s) => s.key === c.phase);

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Overview" description="Everything you need to run the day. Green means go." />
      {health && judgeDown && <Alert tone="error" title="The judge is unreachable or degraded">Nothing can be judged until this is fixed. Submissions queue and retry on their own; none are lost.</Alert>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Judge" value={<span className="text-base">{health?.judge ? health.judge.status : "unreachable"}</span>} tone={judgeDown ? "red" : "green"} icon={<Icon.Code />} hint={health?.judge ? `${health.judge.busy}/${health.judge.capacity} slots busy` : "check the judge container"} />
        <Stat label="Queued / judging" value={health ? `${health.backlog.pending} / ${health.backlog.inFlight}` : "—"} icon={<Icon.List />} />
        <Stat label="Retrying" value={health?.backlog.retrying ?? "—"} tone={health?.backlog.retrying ? "amber" : "ink"} icon={<Icon.Refresh />} hint="submissions the judge has not accepted yet" />
        <Stat label="Internal errors" value={health?.backlog.internalErrors ?? "—"} tone={health?.backlog.internalErrors ? "red" : "ink"} icon={<Icon.Alert />} hint={health?.backlog.internalErrors ? "investigate in Submissions" : "none"} />
        <Stat label="Time left" value={<Countdown until={c.phase_ends_at} />} icon={<Icon.Clock />} hint={c.phase_ends_at ? PHASE_LABEL[c.phase] : "no deadline running"} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Phase control" description={`Now: ${PHASE_LABEL[c.phase]} · step ${idx + 1} of ${PHASE_STEPS.length}`} />
          <CardBody className="space-y-3">
            {checks?.next ? (
              <>
                <div className="flex items-center gap-3 text-sm"><Badge tone="navy">{PHASE_LABEL[c.phase]}</Badge><Icon.ArrowRight className="text-faint" /><Badge tone="green">{PHASE_LABEL[checks.next]}</Badge></div>
                {checks.blockers.length > 0 && <Alert tone="error" title="Cannot advance yet"><ul className="list-disc pl-5">{checks.blockers.map((b) => <li key={b}>{b}</li>)}</ul></Alert>}
                {checks.warnings.length > 0 && <Alert tone="warning" title="Advancing will acknowledge these"><ul className="list-disc pl-5">{checks.warnings.map((w) => <li key={w}>{w}</li>)}</ul></Alert>}
                <div className="flex flex-wrap gap-2">
                  <ReasonAction label={`Advance to ${PHASE_LABEL[checks.next]}`} title={`Advance to ${PHASE_LABEL[checks.next]}?`} variant="primary" size="md" disabled={checks.blockers.length > 0}
                    description={checks.next === "auction1" ? "Lots are created in auction order and the first opens immediately." : ["p1_puzzles", "p1_hacking", "coding1", "final"].includes(checks.next) ? "The timer for this round starts the moment you confirm." : undefined}
                    onConfirm={async (reason) => { await api.post("/api/admin/contest/phase", { reason, acknowledge_warnings: true }); toast({ title: `Advanced to ${PHASE_LABEL[checks.next!]}`, tone: "success" }); await refresh(); await load(); }} />
                  {c.phase_ends_at && <ReasonAction label="Extend round" title="Extend the current round" fields={[{ name: "minutes", label: "Minutes to add", type: "number", defaultValue: "10" }]} onConfirm={async (reason, v) => { await api.post("/api/admin/contest/extend", { reason, minutes: Number(v.minutes) }); toast({ title: `Extended by ${v.minutes} min`, tone: "success" }); await refresh(); }} />}
                  {c.phase === "registration" && <ReasonAction label={c.registration_open ? "Close registration" : "Reopen registration"} title={c.registration_open ? "Close registration?" : "Reopen registration?"} description="The roster must be final before Phase 1 because starting balances are equal."
                    onConfirm={async (reason) => { await api.post("/api/admin/contest/registration", { reason, open: !c.registration_open }); await refresh(); await load(); }} />}
                </div>
              </>
            ) : <p className="text-sm text-muted">The contest has ended. Export the results from the Audit page.</p>}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Readiness" description={ready ? `${ready.done} of ${ready.total} checks pass` : "checking…"} />
          {ready && (
            <>
              <div className="h-1.5 w-full bg-line"><div className={`h-1.5 transition-[width] ${ready.done === ready.total ? "bg-green" : "bg-amber"}`} style={{ width: `${(100 * ready.done) / ready.total}%` }} /></div>
              <ul className="divide-y divide-line">{ready.items.map((it) => (
                <li key={it.key}><Link href={it.href} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-page">
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${it.ok ? "bg-green text-white" : "bg-amber-tint text-[#9a6b00]"}`}>{it.ok ? <Icon.Check size={12} strokeWidth={3} /> : <Icon.Alert size={12} />}</span>
                  <span className="min-w-0 flex-1"><span className={it.ok ? "" : "font-semibold"}>{it.label}</span><span className="block truncate text-xs text-faint">{it.detail}</span></span>
                  <Icon.ChevronRight className="text-faint" />
                </Link></li>
              ))}</ul>
            </>
          )}
        </Card>
      </div>

      <AuctionControls />
      <Announce />
    </div>
  );
}

function AuctionControls() {
  const { state } = useContest();
  const { toast } = useToast();
  const a = state?.auction;
  if (!a) return null;
  return (
    <Card className="border-green/40">
      <CardHeader title={`Auction ${a.round} — live`} description={a.lot ? `Lot ${a.order.findIndex((o) => o.id === a.lot!.id) + 1} of ${a.order.length}` : "between lots"} />
      <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="text-sm">{a.lot ? <><strong>{a.lot.title}</strong> · highest <strong>{a.lot.current_bid ?? "—"}</strong> by {a.lot.current_bidder_name ?? "nobody"} · <Countdown until={a.lot.current_bid !== null ? a.lot.bidding_ends_at : a.lot.no_bid_deadline} className="font-semibold" /></> : <span className="text-muted">All lots settled. Advance the phase when ready.</span>}</div>
        <div className="flex gap-2 sm:ml-auto">
          <ReasonAction label="Close bidding now" title="Close bidding on the open lot" disabled={!a.lot} onConfirm={async (reason) => { await api.post("/api/admin/lots/close", { reason }); toast({ title: "Lot closed", tone: "success" }); }} />
          <ReasonAction label="Disable timer" title="Disable the countdown on this lot" description="Only a manual close will end it." disabled={!a.lot} onConfirm={async (reason) => { await api.post("/api/admin/lots/disable-timer", { reason }); toast({ title: "Timer disabled", tone: "success" }); }} />
        </div>
      </CardBody>
    </Card>
  );
}

function Announce() {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Card>
      <CardHeader title="Announce to everyone" description="Appears on every participant's screen immediately and stays in their announcements." />
      <CardBody className="flex gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Markdown is fine" onKeyDown={(e) => { if (e.key === "Enter" && text.trim()) e.currentTarget.form?.requestSubmit(); }} />
        <Button loading={busy} disabled={!text.trim()} icon={<Icon.Bell />} onClick={async () => { setBusy(true); try { await api.post("/api/admin/announcements", { body_md: text }); setText(""); toast({ title: "Announced", tone: "success" }); } catch (err) { toast({ title: "Failed", description: errorMessage(err), tone: "error" }); } finally { setBusy(false); } }}>Send</Button>
      </CardBody>
    </Card>
  );
}
