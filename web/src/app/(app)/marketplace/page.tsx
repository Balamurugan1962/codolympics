"use client";

/**
 * The marketplace: what is for sale, what you hold, and who you can use it on.
 *
 * Nothing here decides anything. Prices, limits, which phase a powerup works
 * in, who may be attacked and whether a button should be live all arrive from
 * the server already decided, including the sentence explaining why something
 * is unavailable — so the button and the API can never disagree about it. The
 * page's job is to show that and send an intent.
 *
 * Every action carries a request id generated once per attempt. A double click,
 * a retry after a dropped connection or a refresh that resubmits all arrive
 * with the same id and are collapsed onto the first attempt by the server, so
 * nobody is charged twice for a fumbled tap.
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useContest, useEngineEvent } from "@/components/contest-provider";
import { Countdown } from "@/components/countdown";
import { Icon } from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Hint } from "@/components/ui/hint";
import { Modal } from "@/components/ui/modal";
import { PageBody, PageHeader, Section } from "@/components/ui/page";
import { OfferSkeleton, StatStripSkeleton } from "@/components/ui/skeleton";
import { Stat, StatRow } from "@/components/ui/stat";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/client";
import { cn } from "@/lib/utils";

/** Shown while loading as well as after, so the header does not grow on arrival. */
const ABOUT =
  "Powerups are bought with coins, the same coins you bid with at auction. Points come from solving questions and are never spent here, so buying a powerup never costs you a place on the leaderboard.";

type Item = {
  id: number;
  kind: "blackout" | "shield";
  name: string;
  description: string;
  price: number;
  duration_seconds: number | null;
  owned: number;
  max_held: number | null;
  max_purchases: number | null;
  purchased: number;
  usable_now: boolean;
  buy_blocked: string | null;
  use_blocked: string | null;
};

/** `off_limits` with no `break_until`: for the rest of the contest. */
type Target = { id: string; name: string; disqualified: boolean; shielded: boolean; blacked_out: boolean; off_limits: boolean; break_until: string | null; cooldown_until: string | null };

type Shield = { active: boolean; ends_at: string | null; queued: number };
type Market = {
  open: boolean; in_phase2: boolean; phase: string; balance: number; items: Item[]; targets: Target[];
  shield: Shield;
  attack_break: { active: boolean; ends_at: string | null; number: number };
  /** Whether the organisers let attackers see who has a shield up. */
  reveal_shields: boolean;
  /** After this many attacks on one person, nobody can attack them for a while. 0 is no cap. */
  attack_cap: number;
};

/** One id per attempt, so a retry is the same attempt rather than a new one. */
const newRequestId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `r${Date.now()}${Math.random().toString(36).slice(2)}`;

export default function MarketplacePage() {
  const { refresh } = useContest();
  const { toast } = useToast();
  const [market, setMarket] = useState<Market | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [aiming, setAiming] = useState<Item | null>(null);

  const load = useCallback(async () => {
    try {
      setMarket(await api.get<Market>("/api/marketplace"));
    } catch {
      /* leave the last good view up rather than blanking the page */
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  // Somebody's shield went up, a balance moved, an attack landed, a break began.
  useEngineEvent(["powerup", "balance", "phase", "targets"], load);

  async function buy(item: Item) {
    setBusy(item.id);
    const requestId = newRequestId();
    try {
      const r = await api.post<{ owned: number; balance: number; replayed: boolean }>("/api/marketplace/buy", {
        powerup_id: item.id,
        request_id: requestId,
      });
      toast({
        title: r.replayed ? "Already bought" : `${item.name} bought`,
        description: `You hold ${r.owned}. Balance ${r.balance.toLocaleString()}.`,
        tone: "success",
      });
      await Promise.all([load(), refresh()]);
    } catch (err) {
      toast({ title: "Not bought", description: errorMessage(err), tone: "error" });
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function attack(item: Item, target: Target) {
    setBusy(item.id);
    const requestId = newRequestId();
    try {
      const r = await api.post<{ outcome: string; target_name: string | null; owned: number }>("/api/marketplace/use", {
        powerup_id: item.id,
        target_id: target.id,
        request_id: requestId,
      });
      setAiming(null);
      toast(
        r.outcome === "shielded"
          ? {
              title: "Blocked by a Shield",
              description: `${r.target_name ?? target.name} had a Shield. It absorbed your ${item.name} — you hold ${r.owned}.`,
              tone: "warning",
            }
          : {
              title: `${r.target_name ?? target.name} is blacked out`,
              description: `Your ${item.name} landed. You hold ${r.owned}.`,
              tone: "success",
            },
      );
      await Promise.all([load(), refresh()]);
    } catch (err) {
      toast({ title: "Not used", description: errorMessage(err), tone: "error" });
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (!market) {
    return (
      <PageBody width="narrow">
        <PageHeader title="Marketplace" info={ABOUT} />
        <div className="space-y-5">
          <StatStripSkeleton cols={2} />
          <OfferSkeleton />
          <OfferSkeleton actions={1} />
        </div>
      </PageBody>
    );
  }

  // Before Phase 2 there is no shop at all: nothing on sale, nobody to aim at,
  // and no coins yet either. Saying so is the whole page.
  if (!market.in_phase2) {
    return (
      <PageBody width="narrow" className="animate-fade-in">
        <PageHeader title="Marketplace" info={ABOUT} />
        <Section padded={false}>
          <EmptyState
            icon={<Icon.Lock size={20} />}
            title="The marketplace opens in Phase 2"
            body="Powerups are aimed at the people you are bidding and solving against, so nothing is on sale until the auction. Your coins arrive then too."
            action={
              <Button variant="outline" asChild>
                <Link href="/dashboard">Back to the contest</Link>
              </Button>
            }
          />
        </Section>
      </PageBody>
    );
  }

  const held = market.items.reduce((n, i) => n + i.owned, 0);

  return (
    <PageBody width="narrow" className="animate-fade-in">
      <PageHeader title="Marketplace" info={ABOUT} />

      {!market.open && (
        <Alert variant="warning" className="mb-5">
          <Icon.Lock />
          <AlertTitle>The marketplace is closed</AlertTitle>
          <AlertDescription>The organisers open it when it is in play. Anything you already hold still works.</AlertDescription>
        </Alert>
      )}

      <StatRow cols={2} className="mb-5">
        <Stat label="Your coins" value={market.balance.toLocaleString()} icon={<Icon.Wallet size={13} />} />
        <Stat label="Powerups held" value={held} icon={<Icon.Spark size={13} />} />
      </StatRow>

      {market.items.length === 0 ? (
        <EmptyState icon={<Icon.Spark />} title="Nothing on sale" body="The organisers have not put any powerups up yet." />
      ) : (
        <div className="divide-y border bg-card">
          {market.items.map((item) => (
            <div key={item.id}>
              <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn("flex size-7 items-center justify-center rounded-md", item.kind === "blackout" ? "bg-navy text-white" : "bg-brand-tint text-brand-deep")}>
                      {item.kind === "blackout" ? <Icon.Ban size={15} /> : <Icon.Shield size={15} />}
                    </span>
                    <h2 className="text-[15px] font-semibold">{item.name}</h2>
                    <Hint>{item.description}</Hint>
                    {item.owned > 0 && <Badge variant="success">{item.owned} {item.kind === "shield" ? "waiting" : "held"}</Badge>}
                    {!item.usable_now && <Badge variant="neutral">not usable now</Badge>}
                  </div>
                  <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-faint">
                    <span className="font-semibold tabular-nums text-foreground">{item.price.toLocaleString()} coins</span>
                    {item.duration_seconds !== null && <span>{item.duration_seconds === -1 ? "up until it absorbs a Blackout" : `lasts ${item.duration_seconds}s`}</span>}
                    {item.max_held !== null && <span>hold up to {item.max_held}</span>}
                    {item.max_purchases !== null && (
                      <span>
                        {item.purchased} of {item.max_purchases} bought
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Button variant="outline" size="sm" disabled={Boolean(item.buy_blocked) || busy === item.id} loading={busy === item.id} onClick={() => buy(item)}>
                    <Icon.Plus size={14} /> Buy
                  </Button>
                  {item.kind === "blackout" && (
                    <Button size="sm" disabled={Boolean(item.use_blocked) || busy === item.id} onClick={() => setAiming(item)}>
                      <Icon.Target size={14} /> Use
                    </Button>
                  )}
                </div>
              </div>

              {(item.buy_blocked || (item.kind === "blackout" && item.use_blocked)) && (
                <p className="border-t bg-muted/40 px-5 py-2.5 text-[12px] text-muted-foreground">
                  {item.buy_blocked ?? item.use_blocked}
                </p>
              )}
              {item.kind === "shield" && (market.shield.active || market.shield.queued > 0) && (
                <p className="flex flex-wrap items-center gap-x-1.5 border-t bg-green-tint/60 px-5 py-2.5 text-[12px] text-green-dark">
                  <Icon.Shield size={12} />
                  {market.shield.active
                    ? market.shield.ends_at
                      ? <>Protected for another <Countdown until={market.shield.ends_at} warnUnderMs={0} className="font-semibold" />.</>
                      : <>Protected until a Blackout is absorbed.</>
                    : <>Your next shield is starting.</>}
                  {market.shield.queued > 0 && <span>{market.shield.queued} more {market.shield.queued === 1 ? "waits" : "wait"} behind it and {market.shield.queued === 1 ? "starts" : "start"} on {market.shield.queued === 1 ? "its" : "their"} own.</span>}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(aiming)}
        onClose={() => setAiming(null)}
        title={aiming ? `Use ${aiming.name} on…` : ""}
        description={[
          "They lose their screen for the duration. Someone who is already blacked out cannot be attacked, so blackouts never stack. If they have a Shield up it absorbs this instead, and your powerup is still spent.",
          market.reveal_shields ? null : "Shields are hidden in this contest, so you will not know until you try.",
          market.attack_cap > 0 ? `After ${market.attack_cap} attacks on one person nobody can attack them for a while; trying then is refused and costs nothing.` : null,
        ].filter(Boolean).join(" ")}
      >
        {market.targets.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">There is nobody else in the contest to aim at.</p>
        ) : (
          <ul className="-mx-1 max-h-80 overflow-auto">
            {market.targets.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  disabled={t.disqualified || t.off_limits || t.blacked_out || busy !== null}
                  onClick={() => aiming && attack(aiming, t)}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
                >
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{t.name}</span>
                  {t.blacked_out && <Badge variant="neutral">blacked out, cannot be attacked</Badge>}
                  {t.shielded && <Badge variant="info">shielded</Badge>}
                  {t.cooldown_until && <Badge variant="info">protected for <Countdown until={t.cooldown_until} warnUnderMs={0} /></Badge>}
                  {t.off_limits && <Badge variant="warning">{t.break_until ? <>off limits for <Countdown until={t.break_until} warnUnderMs={0} /></> : "off limits now"}</Badge>}
                  {t.disqualified && <Badge variant="neutral">out of the contest</Badge>}
                  <Icon.ChevronRight size={15} className="shrink-0 text-faint" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </PageBody>
  );
}
