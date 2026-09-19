"use client";

/**
 * The auction. One lot at a time, a ring that refills on every bid, one big
 * button with the exact next amount, a live feed, and the running order so
 * you can budget ahead (US-F2-01..04).
 */
import { useState } from "react";

import { useContest } from "@/components/contest-provider";
import { Icon } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CountdownRing } from "@/components/ui/countdown-ring";
import { EmptyState } from "@/components/ui/empty-state";
import { PageBody, PageHeader, Section } from "@/components/ui/page";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/client";

export function AuctionFloor() {
  const { state, serverNow } = useContest();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  if (!state) return null;
  const { auction, me, viewer, contest } = state;

  if (!auction) {
    return (
      <PageBody className="animate-fade-in">
        <PageHeader title="Auction"  />
        <EmptyState icon={<Icon.Gavel size={20} />} title="No auction is running" body={`The current phase is ${contest.phase.replace(/\d/, (d) => ` ${d}`)}. When an auction opens, this page comes alive on its own, no refresh needed.`} />
      </PageBody>
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
  const stepsLeft = lot && affordable ? Math.floor((balance - lot.next_bid) / auction.increment) : 0;
  /* An administrator is holding the auction. The ring is frozen and the server
   * refuses bids, so say so rather than leaving a stopped clock and a button
   * that fails — a silent freeze reads as a broken page and everyone reloads. */
  const paused = auction.paused;
  /* Offline the bidding happens out loud in the room and an organiser records
   * each sale. There is nothing to press here, so the screen stops pretending
   * there is: no ring, no bid button, no feed. What it keeps is the board —
   * what is up now, what went for how much, and to whom. */
  const offline = auction.mode === "offline";

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
    <PageBody width="wide" className="animate-fade-in">
      <PageHeader
        breadcrumb={`Auction ${auction.round} · lot ${position || "—"} of ${auction.order.length}`}
        title="Auction"
        description={
          offline
            ? "The auctioneer runs this in the room. Bid out loud; an organiser records each sale and this board follows."
            : "Bids rise by a fixed step. Every bid restarts the countdown, so bidding last does not win. Bidding more does."
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="overflow-hidden rounded-box border border-line bg-card">
            {!lot ? (
              <EmptyState icon={<Icon.Clock size={20} />} title="Between lots" body="The next question opens in a moment." />
            ) : (
              <>
                <div className="grid gap-6 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-deep">Now offering</div>
                    <h2 className="mt-1 text-[24px] font-semibold leading-tight tracking-[-0.01em]">{lot.title}</h2>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <Badge variant={lot.difficulty === "hard" ? "destructive" : lot.difficulty === "medium" ? "warning" : "success"}>{lot.difficulty}</Badge>
                      <Badge variant="navy">{lot.score} points</Badge>
                      <Badge variant="neutral">base {lot.base_price} coins</Badge>
                    </div>
                    <p className="mt-3 text-[11.5px] text-faint">The statement is what you are buying. You will read it only if you win.</p>
                  </div>
                  <div className="flex justify-center">
                    {offline ? (
                      <div className="flex size-[120px] flex-col items-center justify-center rounded-full border-2 border-line text-center">
                        <Icon.Gavel size={22} className="text-brand" />
                        <span className="mt-1.5 text-[10.5px] font-semibold tracking-[0.08em] text-faint uppercase">in the room</span>
                      </div>
                    ) : (
                    <div key={hasBids ? lot.bidding_ends_at ?? "manual" : lot.no_bid_deadline ?? "manual"} className={hasBids && !paused ? "pulse-once rounded-full" : ""}>
                      <CountdownRing
                        until={paused ? null : hasBids ? lot.bidding_ends_at : lot.no_bid_deadline}
                        totalSeconds={hasBids ? auction.countdown_seconds : auction.opening_window_seconds}
                        label={paused ? "paused" : hasBids ? (lot.bidding_ends_at ? "to close" : "manual close") : "to open bids"}
                      />
                    </div>
                    )}
                  </div>
                </div>

                <div className={`grid gap-4 border-t border-line px-5 py-4 sm:grid-cols-3 ${mine ? "bg-brand-tint" : hasBids ? "bg-muted" : "bg-card"}`}>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">{offline ? "Base price" : "Highest bid"}</div>
                    <div className="mt-0.5 text-[24px] font-semibold tabular-nums leading-none">{offline ? lot.base_price : lot.current_bid ?? "—"}</div>
                    <div className="mt-1.5 text-[12.5px] text-muted-foreground">{offline ? "bidding starts here" : lot.current_bidder_name ? <>{lot.current_bidder_name}{mine && <Badge variant="success" className="ml-2">you</Badge>}</> : "no bids yet"}</div>
                  </div>
                  {!offline && (
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">Next bid</div>
                      <div className="mt-0.5 text-[24px] font-semibold tabular-nums leading-none text-brand-deep">{lot.next_bid}</div>
                      <div className="mt-1.5 text-[12.5px] text-muted-foreground">+{auction.increment} each time</div>
                    </div>
                  )}
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">Your coins</div>
                    <div className="mt-0.5 text-[24px] font-semibold tabular-nums leading-none">{balance.toLocaleString()}</div>
                    <div className="mt-1.5 text-[12.5px] text-muted-foreground">{offline ? "raise your hand to bid" : affordable ? `${stepsLeft} more step${stepsLeft === 1 ? "" : "s"} after this` : "not enough for the next bid"}</div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 border-t border-line px-5 py-4 sm:flex-row sm:items-center">
                  {offline ? (
                    <span className="text-[13px] text-muted-foreground">
                      <span className="font-semibold text-ink">Bidding happens in the room.</span> Call your bid out loud. An organiser records
                      the sale here, and your balance and the board update the moment they do.
                    </span>
                  ) : eligible ? (
                    <>
                      <Button size="lg" onClick={bid} loading={busy} disabled={paused || mine || !affordable} className="sm:min-w-44"><Icon.Gavel size={16} /> 
                        {paused ? "Paused" : mine ? "You're winning" : `Bid ${lot.next_bid}`}
                      </Button>
                      <span className="text-[13px] text-muted-foreground" aria-live="polite">
                        {paused ? "The organisers have paused the auction. The clock is stopped and nothing is lost. Bidding resumes with the time that was left." : mine ? "Nobody has outbid you. If the ring empties, the question is yours." : !affordable ? `You'd need ${lot.next_bid - balance} more.` : hasBids ? "Outbid to restart the countdown." : "Be the first: the countdown starts on the first bid."}
                      </span>
                    </>
                  ) : viewer.role === "participant" ? (
                    <Alert variant="warning"><AlertDescription>You are not eligible to bid in this contest.</AlertDescription></Alert>
                  ) : <span className="text-[13px] text-muted-foreground">Organisers observe here; controls are on the admin dashboard.</span>}
                </div>
              </>
            )}
          </section>

          {!offline && (
          <Section title="Bid feed" description={lot ? "Live, newest first." : undefined} padded={false}>
            {auction.recent_bids.length === 0 ? (
              <p className="px-5 py-4 text-[13px] text-muted-foreground">No bids on this question yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {auction.recent_bids.map((b, i) => (
                  <li key={b.id} className={`flex items-center gap-3 px-5 py-2 text-[13px] ${i === 0 ? "bg-brand-tint/60" : ""}`}>
                    <span className="w-16 font-semibold tabular-nums">{b.amount}</span>
                    <span className="flex-1 truncate">{b.name}{b.participant_id === viewer.id && <span className="ml-1.5 text-[11.5px] font-semibold text-brand-deep">you</span>}</span>
                    <span className="text-[11.5px] text-faint">{ago(b.at, serverNow())}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          )}
        </div>

        <Section title="Running order" description={`${sold} sold · ${auction.order.filter((o) => o.state === "unsold").length} unsold · ${auction.order.filter((o) => o.state === "pending").length} to come`} padded={false} className="lg:sticky lg:top-28 lg:self-start">
          <ol className="pane max-h-[60vh] divide-y divide-line overflow-auto">
            {auction.order.map((o) => (
              <li key={o.id} className={`flex items-center gap-3 px-4 py-2.5 text-[13px] ${o.state === "open" ? "bg-brand-tint" : o.state === "pending" ? "" : "opacity-70"}`}>
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${o.state === "open" ? "bg-brand text-white" : o.state === "closed" ? "bg-line-2 text-ink" : "border border-line-2 text-faint"}`}>{o.order}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{o.title}</div>
                  <div className="text-[11.5px] text-faint">{o.difficulty} · {o.score} pts · base {o.base_price}</div>
                </div>
                {o.state === "closed" ? (
                  <span className="flex shrink-0 flex-col items-end gap-0.5">
                    <Badge variant="neutral">sold {o.price_paid ?? o.current_bid}</Badge>
                    {o.winner_name && (
                      <span className="max-w-[10rem] truncate text-[11px] text-faint">
                        {o.winner_id === viewer.id ? "you" : o.winner_name}
                      </span>
                    )}
                  </span>
                ) : o.state === "unsold" ? <Badge variant="warning">unsold</Badge> : o.state === "open" ? <Badge variant="success">now</Badge> : o.state === "withdrawn" ? <Badge variant="neutral">withdrawn</Badge> : null}
              </li>
            ))}
          </ol>
        </Section>
      </div>
    </PageBody>
  );
}

function ago(iso: string, now: number): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  return s < 5 ? "just now" : s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`;
}
