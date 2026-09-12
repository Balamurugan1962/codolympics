"use client";

import { useState } from "react";

import { useContest } from "@/components/contest-provider";
import { Countdown } from "@/components/countdown";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { api, errorMessage } from "@/lib/client";

export default function AuctionPage() {
  const { state } = useContest();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!state) return null;
  const { auction, me, viewer, contest } = state;

  if (!auction) {
    return <Alert tone="info" title="No auction running">Bidding happens in Auction 1 and Auction 2. Current phase: {contest.phase}.</Alert>;
  }
  const lot = auction.lot;
  const canBid = viewer.role === "participant" && me?.advanced && !me.disqualified;
  const mine = lot?.current_bidder_id === viewer.id;
  const affordable = lot ? (me?.balance ?? 0) >= lot.next_bid : false;

  async function bid() {
    if (!lot) return;
    setBusy(true); setError(null);
    try { await api.post("/api/bids", { lot_id: lot.id, amount: lot.next_bid }); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader title={`Auction ${auction.round} — now offering`} />
          <CardBody>
            {!lot ? (
              <p className="text-sm text-muted">Waiting for the next question…</p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h1 className="text-xl font-semibold">{lot.title}</h1>
                    <div className="mt-1 flex gap-2">
                      <Badge tone={lot.difficulty === "hard" ? "red" : lot.difficulty === "medium" ? "amber" : "green"}>{lot.difficulty}</Badge>
                      <Badge tone="grey">{lot.score} points</Badge>
                      <Badge tone="grey">base {lot.base_price}</Badge>
                    </div>
                    <p className="mt-2 text-xs text-faint">The statement is what you are buying — it is not shown here.</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-semibold uppercase text-faint">{lot.current_bid !== null ? "Countdown" : "Opening window"}</div>
                    <div className="text-3xl font-semibold"><Countdown until={lot.current_bid !== null ? lot.bidding_ends_at : lot.no_bid_deadline} warnUnderMs={5000} /></div>
                    {lot.current_bid !== null && lot.bidding_ends_at === null && <div className="text-xs text-faint">timer off — organiser closes</div>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 rounded-box bg-page p-4">
                  <div>
                    <div className="text-xs font-semibold uppercase text-faint">Highest bid</div>
                    <div className="text-2xl font-semibold tabular-nums">{lot.current_bid ?? "—"}</div>
                    <div className="text-sm text-muted">{lot.current_bidder_name ? `by ${lot.current_bidder_name}${mine ? " (you)" : ""}` : "no bids yet"}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase text-faint">Next legal bid</div>
                    <div className="text-2xl font-semibold tabular-nums text-green-dark">{lot.next_bid}</div>
                    <div className="text-sm text-muted">increment {auction.increment}</div>
                  </div>
                </div>

                {error && <Alert tone="error">{error}</Alert>}
                {canBid ? (
                  <div className="flex items-center gap-3">
                    <Button size="lg" onClick={bid} disabled={busy || mine || !affordable}>Bid {lot.next_bid}</Button>
                    <span className="text-sm text-muted">
                      {mine ? "You hold the highest bid." : !affordable ? `You have ${me?.balance} — not enough for ${lot.next_bid}.` : "Every bid restarts the countdown; bidding last does not win."}
                    </span>
                  </div>
                ) : viewer.role === "participant" ? (
                  <Alert tone="warning">You are not eligible to bid.</Alert>
                ) : null}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Running order" />
        <Table>
          <thead><tr><Th>#</Th><Th>Question</Th><Th>Base</Th><Th>Status</Th></tr></thead>
          <tbody>
            {auction.order.map((o) => (
              <tr key={o.id} className={o.state === "open" ? "bg-green-tint" : ""}>
                <Td>{o.order}</Td>
                <Td><div className="font-semibold">{o.title}</div><div className="text-xs text-faint">{o.difficulty} · {o.score} pts</div></Td>
                <Td>{o.base_price}</Td>
                <Td>{o.state === "closed" ? <Badge tone="grey">sold {o.current_bid}</Badge> : o.state === "unsold" ? <Badge tone="amber">unsold</Badge> : o.state === "open" ? <Badge tone="green">bidding</Badge> : <span className="text-faint">—</span>}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
