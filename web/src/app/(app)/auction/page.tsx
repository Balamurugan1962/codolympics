"use client";

/**
 * The auction. One lot at a time, a ring that refills on every bid, one big
 * button with the exact next amount, a live feed, and the running order so
 * you can budget ahead (US-F2-01..04).
 */
import { useState } from "react";

import { useContest } from "@/components/contest-provider";
import { Icon } from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CountdownRing } from "@/components/ui/countdown-ring";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/client";

export default function AuctionPage() {
  const { state, serverNow } = useContest();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  if (!state) return null;
  const { auction, me, viewer, contest } = state;

  if (!auction) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Auction" description="Questions are auctioned one at a time in Auction 1 and Auction 2." />
        <EmptyState icon={<Icon.Gavel size={22} />} title="No auction is running" body={`The current phase is ${contest.phase.replace(/\d/, (d) => ` ${d}`)}. When an auction opens, this page comes alive on its own — no refresh needed.`} />
      </div>
    );
  }

  const lot = auction.lot;
  const eligible = viewer.role === "participant" && me?.advanced && !me.disqualified;
  const mine = lot?.current_bidder_id === viewer.id;
  const balance = me?.balance ?? 0;
  const affordable = lot ? balance >= lot.next_bid : false;
  const hasBids = lot?.current_bid !== null && lot?.current_bid !== undefined;
  const sold = auction.order.filter((o) => o.state === "closed").length;
  const position = lot ? auction.order.findIndex((o) => o.id === lot.id) + 1 : 0;

  async function bid() {
    if (!lot) return;
    setBusy(true);
    try {
      await api.post("/api/bids", { lot_id: lot.id, amount: lot.next_bid });
      toast({ title: `Bid placed: ${lot.next_bid}`, description: "You hold the highest bid. The countdown restarted.", tone: "success", duration: 3000 });
    } catch (err) {
      toast({ title: "Bid not accepted", description: errorMessage(err), tone: "error" });
    } finally { setBusy(false); }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader eyebrow={`Auction ${auction.round} · lot ${position || "—"} of ${auction.order.length}`} title="Auction" description="Bids rise by a fixed step. Every bid restarts the countdown, so bidding last does not win — bidding more does." />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="overflow-hidden">
            {!lot ? (
              <CardBody><EmptyState icon={<Icon.Clock size={22} />} title="Between lots" body="The next question opens in a moment." /></CardBody>
            ) : (
              <>
                <div className="grid gap-6 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-green-dark">Now offering</div>
                    <h2 className="mt-1 text-2xl font-semibold leading-tight">{lot.title}</h2>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge tone={lot.difficulty === "hard" ? "red" : lot.difficulty === "medium" ? "amber" : "green"}>{lot.difficulty}</Badge>
                      <Badge tone="navy">{lot.score} points</Badge>
                      <Badge tone="grey">base price {lot.base_price}</Badge>
                    </div>
                    <p className="mt-3 text-xs text-faint">The statement is what you are buying. You will read it only if you win.</p>
                  </div>
                  <div className="flex justify-center">
                    <div key={hasBids ? lot.bidding_ends_at ?? "manual" : lot.no_bid_deadline ?? "manual"} className={hasBids ? "pulse-once rounded-full" : ""}>
                      <CountdownRing until={hasBids ? lot.bidding_ends_at : lot.no_bid_deadline} totalSeconds={hasBids ? auction.countdown_seconds : auction.opening_window_seconds} label={hasBids ? (lot.bidding_ends_at ? "to close" : "manual close") : "to open bids"} />
                    </div>
                  </div>
                </div>

                <div className={`grid gap-4 border-t border-line px-5 py-4 sm:grid-cols-3 ${mine ? "bg-green-tint" : hasBids ? "bg-page" : "bg-card"}`}>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-faint">Highest bid</div>
                    <div className="text-2xl font-semibold tabular-nums">{lot.current_bid ?? "—"}</div>
                    <div className="text-sm text-muted">{lot.current_bidder_name ? <>{lot.current_bidder_name}{mine && <Badge tone="green" className="ml-2">you</Badge>}</> : "no bids yet"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-faint">Next bid</div>
                    <div className="text-2xl font-semibold tabular-nums text-green-dark">{lot.next_bid}</div>
                    <div className="text-sm text-muted">+{auction.increment} each time</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-faint">Your balance</div>
                    <div className="text-2xl font-semibold tabular-nums">{balance.toLocaleString()}</div>
                    <div className="text-sm text-muted">{affordable ? `${Math.floor((balance - lot.next_bid) / auction.increment)} more step${Math.floor((balance - lot.next_bid) / auction.increment) === 1 ? "" : "s"} after this` : "not enough for the next bid"}</div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 border-t border-line px-5 py-4 sm:flex-row sm:items-center">
                  {eligible ? (
                    <>
                      <Button size="lg" icon={<Icon.Gavel />} onClick={bid} loading={busy} disabled={mine || !affordable} className="sm:min-w-44">
                        {mine ? "You're winning" : `Bid ${lot.next_bid}`}
                      </Button>
                      <span className="text-sm text-muted" aria-live="polite">
                        {mine ? "Nobody has outbid you. If the ring empties, the question is yours." : !affordable ? `You'd need ${lot.next_bid - balance} more.` : hasBids ? "Outbid to restart the countdown." : "Be the first: the countdown starts on the first bid."}
                      </span>
                    </>
                  ) : viewer.role === "participant" ? (
                    <Alert tone="warning">You are not eligible to bid in this contest.</Alert>
                  ) : <span className="text-sm text-muted">Organisers observe here; controls are on the admin overview.</span>}
                </div>
              </>
            )}
          </Card>

          <Card>
            <CardHeader title="Bid feed" description={lot ? "Live, newest first." : undefined} />
            {auction.recent_bids.length === 0 ? (
              <CardBody className="text-sm text-muted">No bids on this question yet.</CardBody>
            ) : (
              <ul className="divide-y divide-line">
                {auction.recent_bids.map((b, i) => (
                  <li key={b.id} className={`flex items-center gap-3 px-4 py-2 text-sm ${i === 0 ? "bg-green-tint/60" : ""}`}>
                    <span className="w-16 tabular-nums font-semibold">{b.amount}</span>
                    <span className="flex-1 truncate">{b.name}{b.participant_id === viewer.id && <span className="ml-1 text-green-dark">(you)</span>}</span>
                    <span className="text-xs text-faint">{ago(b.at, serverNow())}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card className="lg:sticky lg:top-28 lg:self-start">
          <CardHeader title="Running order" description={`${sold} sold · ${auction.order.filter((o) => o.state === "unsold").length} unsold · ${auction.order.filter((o) => o.state === "pending").length} to come`} />
          <ol className="max-h-[60vh] divide-y divide-line overflow-auto pane">
            {auction.order.map((o) => (
              <li key={o.id} className={`flex items-center gap-3 px-4 py-2.5 text-sm ${o.state === "open" ? "bg-green-tint" : o.state === "pending" ? "" : "opacity-70"}`}>
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${o.state === "open" ? "bg-green text-white" : o.state === "closed" ? "bg-line-2 text-ink" : "border border-line-2 text-faint"}`}>{o.order}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{o.title}</div>
                  <div className="text-xs text-faint">{o.difficulty} · {o.score} pts · base {o.base_price}</div>
                </div>
                {o.state === "closed" ? <Badge tone="grey">sold {o.current_bid}</Badge> : o.state === "unsold" ? <Badge tone="amber">unsold</Badge> : o.state === "open" ? <Badge tone="green">now</Badge> : null}
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}

function ago(iso: string, now: number): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  return s < 5 ? "just now" : s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`;
}
