"use client";

/** Administrator overview: judge health, backlog, the phase, and what advancing would do (US-F9-04, US-F9-05). */
import { useCallback, useEffect, useState } from "react";

import { useContest } from "@/components/contest-provider";
import { Countdown } from "@/components/countdown";
import { ReasonAction } from "@/components/reason-action";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { api } from "@/lib/client";

type Health = { judge: { status: string; go_judge: string; problems: number; busy: number; capacity: number } | null; backlog: { pending: number; inFlight: number; retrying: number; internalErrors: number } };
type Checks = { next: string | null; blockers: string[]; warnings: string[] };

export default function AdminOverview() {
  const { state, refresh, lastEvent } = useContest();
  const [health, setHealth] = useState<Health | null>(null);
  const [checks, setChecks] = useState<Checks | null>(null);
  const load = useCallback(async () => {
    const [h, c] = await Promise.all([api.get<Health>("/api/admin/health"), api.get<Checks>("/api/admin/contest/phase")]);
    setHealth(h); setChecks(c);
  }, []);
  useEffect(() => { void load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [load, lastEvent?.name === "phase" ? lastEvent.at : 0]);
  if (!state) return null;
  const c = state.contest;
  const judgeDown = !health?.judge || health.judge.status !== "ok";

  return (
    <div className="space-y-6">
      {health && judgeDown && <Alert tone="error" title="Judge unreachable or degraded">Nothing can be judged until this is fixed. Submissions are queued, not lost.</Alert>}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Stat label="Judge" value={<span className={`text-base ${judgeDown ? "text-red" : "text-green-dark"}`}>{health?.judge ? `${health.judge.status} · ${health.judge.busy}/${health.judge.capacity} busy` : "unreachable"}</span>} />
        <Stat label="Pending / in flight" value={health ? `${health.backlog.pending} / ${health.backlog.inFlight}` : "—"} />
        <Stat label="Retrying" value={health?.backlog.retrying ?? "—"} tone={health?.backlog.retrying ? "red" : "ink"} />
        <Stat label="Internal errors" value={health?.backlog.internalErrors ?? "—"} tone={health?.backlog.internalErrors ? "red" : "ink"} />
        <Stat label="Time remaining" value={<Countdown until={c.phase_ends_at} />} />
      </div>

      <Card>
        <CardHeader title={<span className="flex items-center gap-2">Phase <Badge tone="navy">{c.phase}</Badge></span>} />
        <CardBody className="space-y-3">
          {checks?.next ? (
            <>
              <p className="text-sm">Next: <strong>{checks.next}</strong></p>
              {checks.blockers.length > 0 && <Alert tone="error" title="Cannot advance yet"><ul className="list-disc pl-5">{checks.blockers.map((b) => <li key={b}>{b}</li>)}</ul></Alert>}
              {checks.warnings.length > 0 && <Alert tone="warning" title="Warnings — advancing will acknowledge these"><ul className="list-disc pl-5">{checks.warnings.map((w) => <li key={w}>{w}</li>)}</ul></Alert>}
              <div className="flex gap-2">
                <ReasonAction label={`Advance to ${checks.next}`} title={`Advance to ${checks.next}?`} variant="primary" size="md" disabled={checks.blockers.length > 0}
                  description={checks.next === "auction1" ? "Lots are created in auction order and the first opens immediately." : checks.next === "p1_puzzles" || checks.next === "p1_hacking" ? "The section timer starts now." : undefined}
                  onConfirm={async (reason) => { await api.post("/api/admin/contest/phase", { reason, acknowledge_warnings: true }); await refresh(); await load(); }} />
                {c.phase_ends_at && <ReasonAction label="Extend round" title="Extend the current round" fields={[{ name: "minutes", label: "Minutes to add", type: "number", defaultValue: "10" }]}
                  onConfirm={async (reason, v) => { await api.post("/api/admin/contest/extend", { reason, minutes: Number(v.minutes) }); await refresh(); }} />}
                {c.phase === "registration" && <ReasonAction label={c.registration_open ? "Close registration" : "Reopen registration"} title={c.registration_open ? "Close registration?" : "Reopen registration?"}
                  description="The roster must be final before Phase 1 because starting balances are equal."
                  onConfirm={async (reason) => { await api.post("/api/admin/contest/registration", { reason, open: !c.registration_open }); await refresh(); await load(); }} />}
              </div>
            </>
          ) : <p className="text-sm text-muted">The contest has ended.</p>}
        </CardBody>
      </Card>

      <AuctionControls />
      <Announce />
    </div>
  );
}

function AuctionControls() {
  const { state } = useContest();
  const a = state?.auction;
  if (!a) return null;
  return (
    <Card>
      <CardHeader title={`Auction ${a.round} — live controls`} />
      <CardBody className="flex items-center gap-4 text-sm">
        {a.lot ? <span>Open: <strong>{a.lot.title}</strong> · highest {a.lot.current_bid ?? "—"} by {a.lot.current_bidder_name ?? "nobody"} · <Countdown until={a.lot.current_bid !== null ? a.lot.bidding_ends_at : a.lot.no_bid_deadline} /></span> : <span className="text-muted">No lot open — all lots settled. Advance the phase when ready.</span>}
        <div className="ml-auto flex gap-2">
          <ReasonAction label="Close bidding now" title="Close bidding on the open lot" disabled={!a.lot} onConfirm={async (reason) => { await api.post("/api/admin/lots/close", { reason }); }} />
          <ReasonAction label="Disable timer" title="Disable the countdown on this lot" description="Only a manual close will end it." disabled={!a.lot} onConfirm={async (reason) => { await api.post("/api/admin/lots/disable-timer", { reason }); }} />
        </div>
      </CardBody>
    </Card>
  );
}

function Announce() {
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <Card>
      <CardHeader title="Announce to everyone" />
      <CardBody className="flex gap-2">
        <input className="h-9 flex-1 rounded-box border border-line-2 px-3 text-sm" value={text} onChange={(e) => setText(e.target.value)} placeholder="Markdown is fine" />
        <button className="h-9 rounded-box bg-green px-4 text-sm font-semibold text-white disabled:opacity-40" disabled={!text.trim()}
          onClick={async () => { await api.post("/api/admin/announcements", { body_md: text }); setText(""); setSent(true); setTimeout(() => setSent(false), 2000); }}>{sent ? "Sent" : "Send"}</button>
      </CardBody>
    </Card>
  );
}
