"use client";

/**
 * Auction control: everything an administrator can do to a running auction.
 *
 * The dashboard keeps the two actions used in a normal round — close bidding,
 * disable the timer — because a normal round needs nothing else and this page
 * would be a detour. This page is for the round that goes wrong: the projector
 * dies mid-lot, a package turns out broken after it sold, somebody bids on the
 * wrong question, the order has to change because a team is stuck in traffic.
 *
 * It is laid out as the auction is: what is on the block now, what is coming,
 * and what is already settled. Each of the three answers a different question,
 * so each gets its own actions rather than one menu of everything.
 *
 * Every action asks for a reason, because every action here writes to the audit
 * log in the same transaction as the change.
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Countdown } from "@/components/countdown";
import { Icon } from "@/components/icons";
import { ReasonAction } from "@/components/reason-action";
import { useContest } from "@/components/contest-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/select";
import { PageBody, PageHeader, Section } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/skeleton";
import { Stat, StatRow } from "@/components/ui/stat";
import { Summary, SummaryItem } from "@/components/ui/summary";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";

type Lot = {
  id: number;
  question_id: string;
  title: string;
  difficulty: string;
  score: number;
  base_price: number;
  status: string;
  state: "pending" | "open" | "closed" | "unsold" | "withdrawn";
  order: number;
  current_bid: number | null;
  opened_at: string | null;
  closed_at: string | null;
  owner_id: string | null;
  owner_name: string | null;
  price_paid: number | null;
};

type Balance = { id: string; name: string; balance: number; owned: number; disqualified: boolean };

type Control = {
  round: number;
  mode: "online" | "offline";
  paused_at: string | null;
  countdown_seconds: number;
  opening_window_seconds: number;
  lots: Lot[];
  balances: Balance[];
};

const STATE: Record<Lot["state"], { label: string; tone: "success" | "destructive" | "warning" | "info" | "neutral" }> = {
  pending: { label: "To come", tone: "neutral" },
  open: { label: "On the block", tone: "info" },
  closed: { label: "Sold", tone: "success" },
  unsold: { label: "Unsold", tone: "warning" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
};

export default function AuctionControlPage() {
  const { state } = useContest();
  const { toast } = useToast();
  const [control, setControl] = useState<Control | null>(null);
  const [order, setOrder] = useState<number[] | null>(null);
  const [winner, setWinner] = useState("");
  const [price, setPrice] = useState("");

  const load = useCallback(async () => {
    setControl(await api.get<Control>("/api/admin/auction"));
    setOrder(null); // a fresh read wins over a reorder that was never saved
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  // The auction event fires on every bid, open and close, so the table follows
  // the room without a poll of its own.
  const auctionTick = state?.auction?.server_now;
  useEffect(() => {
    if (auctionTick) void load();
  }, [auctionTick, load]);

  const live = state?.auction;
  const phase = state?.contest.phase;
  const inAuction = phase === "auction1" || phase === "auction2";

  if (!control) return <PageSkeleton stats={4} rows={8} cols={5} />;

  const paused = Boolean(control.paused_at);
  const offline = control.mode === "offline";
  const open = control.lots.find((l) => l.state === "open") ?? null;
  const pending = control.lots.filter((l) => l.state === "pending");
  const settled = control.lots.filter((l) => l.state !== "pending" && l.state !== "open");
  const sold = control.lots.filter((l) => l.state === "closed").length;
  const queue = order ?? pending.map((l) => l.id);
  const dirty = order !== null && order.join() !== pending.map((l) => l.id).join();

  async function act(action: string, payload: Record<string, unknown>, done: string) {
    await api.post(`/api/admin/auction/${action}`, payload);
    toast({ title: done, tone: "success" });
    await load();
  }

  function move(id: number, by: -1 | 1) {
    const next = [...queue];
    const i = next.indexOf(id);
    const j = i + by;
    if (i < 0 || j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  }

  const byId = new Map(control.lots.map((l) => [l.id, l]));

  return (
    <PageBody width="wide">
      <PageHeader
        title="Auction control"
        description={
          inAuction
            ? `Round ${control.round} · ${offline ? "run in the room, recorded here" : "bidding from their seats"}. Everything here is audited.`
            : "No auction is running. Lots appear once you advance to an auction phase."
        }
        actions={
          inAuction ? (
            paused ? (
              <ReasonAction
                label="Resume"
                variant="default"
                title="Resume the auction"
                icon={<Icon.Play size={14} />}
                defaultReason="Resuming the auction."
                description="Every lot deadline moves forward by exactly how long the auction was held, so whatever time was left on the clock is still there."
                onConfirm={async (reason) => act("resume", { reason }, "Auction resumed")}
              />
            ) : (
              <ReasonAction
                label="Pause"
                title="Pause the auction"
                icon={<Icon.Pause size={14} />}
                defaultReason="Pausing the auction."
                description="The clock stops where it is, bids are refused, and nothing settles until you resume. Participants are told the organisers have paused it."
                onConfirm={async (reason) => act("pause", { reason }, "Auction paused")}
              />
            )
          ) : null
        }
      />

      {paused && (
        <Alert variant="warning">
          <Icon.Pause />
          <AlertTitle>The auction is held</AlertTitle>
          <AlertDescription>
            Held since {new Date(control.paused_at!).toLocaleTimeString()}. No lot will settle and every bid is refused. Resuming
            gives back exactly the time the hold took.
          </AlertDescription>
        </Alert>
      )}

      {!inAuction ? (
        <EmptyState
          icon={<Icon.Gavel />}
          title="Nothing is being auctioned"
          body="These controls come alive when the contest reaches an auction phase."
        />
      ) : (
        <>
          <StatRow cols={4}>
            <Stat
              label="State"
              value={paused ? "Held" : open ? "Bidding" : "Between lots"}
              tone={paused ? "warning" : open ? "info" : "default"}
              icon={<Icon.Gavel size={13} />}
              hint={paused ? "resume to continue" : open ? `on ${open.title}` : "the next lot opens on its own"}
            />
            <Stat label="Sold" value={sold} icon={<Icon.CheckAll size={13} />} hint={`of ${control.lots.length} lots this round`} />
            <Stat label="Still to come" value={pending.length} icon={<Icon.List size={13} />} hint={pending.length ? "in the order below" : "the round is finished"} />
            <Stat
              label="Highest bid"
              value={live?.lot?.current_bid ?? "—"}
              icon={<Icon.Coins size={13} />}
              hint={live?.lot?.current_bidder_name ? `by ${live.lot.current_bidder_name}` : "no bids on the open lot"}
            />
          </StatRow>

          <Section
            title="On the block"
            description={open ? "What the room is bidding on right now." : "Nothing is open — the next lot opens by itself."}
          >
            {!open ? (
              <p className="text-[13px] text-muted-foreground">
                {paused ? "Held between lots. Resume to offer the next question." : "Between lots."}
              </p>
            ) : offline ? (
              /* Offline the app is the record, not the mechanism: the room has
                 already decided, and this writes down what it decided. */
              <OfflineLot
                lot={open}
                balances={control.balances}
                winner={winner}
                price={price}
                onWinner={setWinner}
                onPrice={setPrice}
                onRecorded={() => { setWinner(""); setPrice(""); }}
                act={act}
                paused={paused}
              />
            ) : !live?.lot ? (
              <p className="text-[13px] text-muted-foreground">Between lots.</p>
            ) : (
              <>
                <Summary cols={4}>
                  <SummaryItem label="Question">
                    <span className="block truncate text-[15px] font-semibold">{live.lot.title}</span>
                    <span className="font-mono text-[11px] text-faint">{live.lot.question_id}</span>
                  </SummaryItem>
                  <SummaryItem label="Highest bid">
                    <span className="text-[15px] font-semibold tabular-nums">{live.lot.current_bid ?? "—"}</span>{" "}
                    <span className="text-muted-foreground">{live.lot.current_bidder_name ? `by ${live.lot.current_bidder_name}` : "no bids"}</span>
                  </SummaryItem>
                  <SummaryItem label={live.lot.current_bid !== null ? "Closes in" : "Opens for"}>
                    <span className="text-[15px] font-semibold">
                      {paused ? (
                        <span className="text-amber">held</span>
                      ) : live.lot.bidding_ends_at || live.lot.no_bid_deadline ? (
                        <Countdown until={live.lot.current_bid !== null ? live.lot.bidding_ends_at : live.lot.no_bid_deadline} />
                      ) : (
                        <span className="text-muted-foreground">no timer</span>
                      )}
                    </span>
                  </SummaryItem>
                  <SummaryItem label="Next legal bid">
                    <span className="tabular-nums">{live.lot.next_bid}</span>
                  </SummaryItem>
                </Summary>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
                  <ReasonAction
                    label="Close bidding"
                    variant="default"
                    icon={<Icon.Gavel size={14} />}
                    title="Close bidding on this question"
                    defaultReason={`Closing bidding on ${live.lot.title} by hand.`}
                    description="The highest bidder wins it immediately. With no bids it goes unsold."
                    onConfirm={async (reason) => act("close", { reason }, "Lot closed")}
                  />
                  <ReasonAction
                    label="Retract top bid"
                    icon={<Icon.Undo size={14} />}
                    disabled={live.lot.current_bid === null}
                    title="Retract the highest bid"
                    defaultReason="Retracting a bid placed by mistake."
                    description="The bid is removed and the question goes back to whoever held it before, with the countdown restarted. No balance moves — bidding never debits, only winning does."
                    onConfirm={async (reason) => act("retract-bid", { reason }, "Bid retracted")}
                  />
                  <ReasonAction
                    label="Add 30s"
                    icon={<Icon.Timer size={14} />}
                    title="Add thirty seconds"
                    defaultReason="Giving the room more time to decide."
                    description="Pushes the current deadline out by thirty seconds. Nothing else changes."
                    onConfirm={async (reason) => act("timer", { reason, mode: "adjust", seconds: 30 }, "Thirty seconds added")}
                  />
                  <ReasonAction
                    label="Restart timer"
                    icon={<Icon.Refresh size={14} />}
                    title="Restart the countdown"
                    defaultReason="Restarting the countdown on this question."
                    description={`Puts a full ${live.lot.current_bid !== null ? control.countdown_seconds : control.opening_window_seconds} seconds back on the clock. This is also how a disabled timer is turned back on.`}
                    onConfirm={async (reason) => act("timer", { reason, mode: "restart" }, "Timer restarted")}
                  />
                  <ReasonAction
                    label="Stop the timer"
                    icon={<Icon.Pause size={14} />}
                    title="Run this lot to a manual close"
                    defaultReason={`Running ${live.lot.title} to a manual close.`}
                    description="Bidding stays open until you close it by hand. Restart the timer to undo this."
                    onConfirm={async (reason) => act("timer", { reason, mode: "off" }, "Timer stopped")}
                  />
                  <ReasonAction
                    label="Withdraw"
                    variant="destructive"
                    icon={<Icon.Ban size={14} />}
                    title="Take this question off the block"
                    defaultReason={`Withdrawing ${live.lot.title} mid-auction.`}
                    description="Nothing is sold and no money moves. The bids so far are kept for the record, and the next question opens. You can put it back later."
                    onConfirm={async (reason) => act("withdraw", { reason, lot_id: open.id }, "Question withdrawn")}
                  />
                </div>
              </>
            )}
          </Section>

          {offline && (
            <Section
              title="Who can afford what"
              description="Balances as they stand. A participant sees their own and nobody else's — this table is yours."
              padded={false}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Participant</TableHead>
                    <TableHead className="w-28 text-right">Balance</TableHead>
                    <TableHead className="w-24 text-right">Owns</TableHead>
                    <TableHead className="w-40">Can take this lot</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {control.balances.map((b) => {
                    const afford = open ? b.balance >= open.base_price : false;
                    return (
                      <TableRow key={b.id} className={cn(b.disqualified && "opacity-50")}>
                        <TableCell className="font-medium">
                          {b.name}
                          {b.disqualified && <Badge variant="neutral" className="ml-2">disqualified</Badge>}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{b.balance.toLocaleString()}</TableCell>
                        <TableCell className="text-right tabular-nums">{b.owned}</TableCell>
                        <TableCell className="text-[12.5px] text-muted-foreground">
                          {!open ? (
                            <span className="text-faint">—</span>
                          ) : b.disqualified ? (
                            "no — disqualified"
                          ) : afford ? (
                            <span className="text-green-dark">yes, up to {b.balance.toLocaleString()}</span>
                          ) : (
                            <span className="text-amber">short by {(open.base_price - b.balance).toLocaleString()}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Section>
          )}

          <Section
            title="Still to come"
            description="The order they will be offered in. Reordering only moves questions that have not been offered yet."
            padded={false}
            actions={
              dirty ? (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setOrder(null)}>
                    Discard
                  </Button>
                  <ReasonAction
                    label="Save order"
                    variant="default"
                    icon={<Icon.Save size={14} />}
                    title="Save the new running order"
                    defaultReason="Reordering the questions still to be offered."
                    description="Only questions that have not been offered move. Everything already settled keeps its place in the record."
                    onConfirm={async (reason) => act("reorder", { reason, round: control!.round, lot_ids: queue }, "Order saved")}
                  />
                </div>
              ) : null
            }
          >
            {pending.length === 0 ? (
              <EmptyState icon={<Icon.CheckAll />} title="Everything has been offered" body="No questions are left in this round's queue." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14 text-right">#</TableHead>
                    <TableHead>Question</TableHead>
                    <TableHead className="hidden w-24 sm:table-cell">Difficulty</TableHead>
                    <TableHead className="w-20 text-right">Score</TableHead>
                    <TableHead className="w-24 text-right">Base</TableHead>
                    <TableHead className="w-32">Move</TableHead>
                    <TableHead className="w-28">
                      <span className="sr-only">Withdraw</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queue.map((id, i) => {
                    const l = byId.get(id);
                    if (!l) return null;
                    return (
                      <TableRow key={id} className={dirty ? "bg-brand-tint" : ""}>
                        <TableCell className="text-right text-faint tabular-nums">{i + 1}</TableCell>
                        <TableCell>
                          <span className="block truncate font-medium">{l.title}</span>
                          <span className="font-mono text-[11px] text-faint">{l.question_id}</span>
                        </TableCell>
                        <TableCell className="hidden capitalize text-muted-foreground sm:table-cell">{l.difficulty}</TableCell>
                        <TableCell className="text-right tabular-nums">{l.score}</TableCell>
                        <TableCell className="text-right tabular-nums">{l.base_price}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="outline" size="icon-sm" aria-label={`Move ${l.title} earlier`} disabled={i === 0} onClick={() => move(id, -1)}>
                              <Icon.ArrowUp size={13} />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon-sm"
                              aria-label={`Move ${l.title} later`}
                              disabled={i === queue.length - 1}
                              onClick={() => move(id, 1)}
                            >
                              <Icon.ArrowDown size={13} />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <ReasonAction
                            label="Withdraw"
                            size="xs"
                            icon={<Icon.Ban size={12} />}
                            title={`Take ${l.title} off the block`}
                            defaultReason={`Withdrawing ${l.title} before it is offered.`}
                            description="It will not be offered this round. Nothing is sold and no money moves; you can put it back below."
                            onConfirm={async (reason) => act("withdraw", { reason, lot_id: l.id }, "Question withdrawn")}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Section>

          <Section
            title="Settled"
            description="Sold, unsold and withdrawn. Taking a question back voids the sale and returns it to unsold."
            padded={false}
          >
            {settled.length === 0 ? (
              <EmptyState icon={<Icon.Gavel />} title="Nothing has settled yet" body="Lots appear here as the round works through them." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14 text-right">#</TableHead>
                    <TableHead>Question</TableHead>
                    <TableHead className="w-32">Outcome</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead className="w-24 text-right">Paid</TableHead>
                    <TableHead className="w-32">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {settled.map((l) => (
                    <TableRow key={l.id} className={cn(l.state === "withdrawn" && "opacity-60")}>
                      <TableCell className="text-right text-faint tabular-nums">{l.order}</TableCell>
                      <TableCell>
                        <span className="block truncate font-medium">{l.title}</span>
                        <span className="font-mono text-[11px] text-faint">{l.question_id}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATE[l.state].tone}>{STATE[l.state].label}</Badge>
                      </TableCell>
                      <TableCell className="truncate">
                        {l.owner_id ? (
                          <Link href={`/admin/participants/${l.owner_id}`} className="font-medium hover:underline">
                            {l.owner_name ?? l.owner_id}
                          </Link>
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{l.price_paid ?? <span className="text-faint">—</span>}</TableCell>
                      <TableCell>
                        {l.state === "withdrawn" ? (
                          <ReasonAction
                            label="Put back"
                            size="xs"
                            icon={<Icon.Undo size={12} />}
                            title={`Put ${l.title} back on the block`}
                            defaultReason={`Putting ${l.title} back into the round.`}
                            description="It goes to the end of the queue and will be offered again."
                            onConfirm={async (reason) => act("restore", { reason, lot_id: l.id }, "Question put back")}
                          />
                        ) : l.owner_id ? (
                          <ReasonAction
                            label="Take back"
                            size="xs"
                            variant="destructive"
                            icon={<Icon.Undo size={12} />}
                            title={`Take ${l.title} back from ${l.owner_name ?? l.owner_id}`}
                            confirmLabel="Take it back"
                            defaultReason={`Undoing the sale of ${l.title}.`}
                            description="The sale is voided and the question becomes unsold. Their submissions are kept, but stop counting the moment ownership goes."
                            fields={[
                              { name: "refund_price", type: "checkbox", label: `Refund the ${l.price_paid} they paid`, defaultValue: "1" },
                              {
                                name: "refund_hints",
                                type: "checkbox",
                                label: "Refund hints bought for it",
                                help: "The purchases are removed too, so winning it back costs again.",
                                defaultValue: "1",
                              },
                              {
                                name: "relist",
                                type: "checkbox",
                                label: "Put it back on the block",
                                help: "Off: it stays unsold and you assign it by hand.",
                                defaultValue: "1",
                              },
                            ]}
                            onConfirm={async (reason, v) =>
                              act(
                                "take-back",
                                {
                                  reason,
                                  question_id: l.question_id,
                                  refund_price: v.refund_price === "1",
                                  refund_hints: v.refund_hints === "1",
                                  relist: v.relist === "1",
                                },
                                "Question taken back",
                              )
                            }
                          />
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Section>
        </>
      )}
    </PageBody>
  );
}

/**
 * The open lot, offline: who won it and for how much.
 *
 * The checks the online auction enforces on every bid still hold here — a sale
 * over somebody's balance, past the ownership cap, or below the published base
 * price is refused rather than recorded. The room decides who wins; it does not
 * get to decide that money exists. The form says so before you submit, so the
 * refusal is not a surprise after the hammer has already come down.
 */
function OfflineLot({
  lot,
  balances,
  winner,
  price,
  onWinner,
  onPrice,
  onRecorded,
  act,
  paused,
}: {
  lot: Lot;
  balances: Balance[];
  winner: string;
  price: string;
  onWinner: (v: string) => void;
  onPrice: (v: string) => void;
  onRecorded: () => void;
  act: (action: string, payload: Record<string, unknown>, done: string) => Promise<void>;
  paused: boolean;
}) {
  const eligible = balances.filter((b) => !b.disqualified);
  const chosen = eligible.find((b) => b.id === winner) ?? null;
  const asked = Number(price);
  const typed = price.trim() !== "";
  const valid = chosen !== null && typed && Number.isInteger(asked) && asked >= lot.base_price && asked <= chosen.balance;
  const problem =
    !chosen || !typed ? null
    : !Number.isInteger(asked) ? "Enter a whole number."
    : asked < lot.base_price ? `That is below the published base price of ${lot.base_price}.`
    : asked > chosen.balance ? `${chosen.name} has only ${chosen.balance.toLocaleString()}.`
    : null;

  return (
    <div className="space-y-4">
      <Summary cols={3}>
        <SummaryItem label="On the block">
          <span className="block truncate text-[15px] font-semibold">{lot.title}</span>
          <span className="font-mono text-[11px] text-faint">{lot.question_id}</span>
        </SummaryItem>
        <SummaryItem label="Base price">
          <span className="text-[15px] font-semibold tabular-nums">{lot.base_price}</span>
        </SummaryItem>
        <SummaryItem label="Worth">
          <span className="tabular-nums">{lot.score} points</span>
        </SummaryItem>
      </Summary>

      <div className="grid gap-3 border-t pt-4 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end">
        <Field label="Who won it">
          <SimpleSelect
            className="w-full"
            size="default"
            value={winner}
            onValueChange={onWinner}
            placeholder="Pick the winning bidder"
            options={eligible.map((b) => ({ value: b.id, label: `${b.name} — ${b.balance.toLocaleString()} left` }))}
          />
        </Field>
        <Field label="Hammer price" hint={`min ${lot.base_price}`}>
          <Input
            type="number"
            inputMode="numeric"
            min={lot.base_price}
            value={price}
            placeholder={String(lot.base_price)}
            onChange={(e) => onPrice(e.target.value)}
          />
        </Field>
        <ReasonAction
          label="Record the sale"
          variant="default"
          icon={<Icon.Gavel size={14} />}
          disabled={paused || !valid}
          title={chosen ? `Record ${lot.title} to ${chosen.name}` : "Record the sale"}
          confirmLabel="Record it"
          defaultReason={chosen ? `${chosen.name} won ${lot.title} at ${asked} in the room.` : "Recording the sale called in the room."}
          description="This takes the money and hands the question over, exactly as a won bid would. The next question opens straight after."
          onConfirm={async (reason) => {
            await act("record-sale", { reason, lot_id: lot.id, participant_id: winner, price: asked }, "Sale recorded");
            onRecorded();
          }}
        />
      </div>

      {problem && (
        <Alert variant="warning">
          <Icon.Alert />
          <AlertDescription>{problem}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t pt-4">
        <ReasonAction
          label="Nobody bid"
          icon={<Icon.X size={14} />}
          disabled={paused}
          title={`Close ${lot.title} unsold`}
          defaultReason={`No bids on ${lot.title} in the room.`}
          description="Nothing is sold and no money moves. It can be assigned by hand later, or offered again in the second round."
          onConfirm={async (reason) => act("record-unsold", { reason, lot_id: lot.id }, "Closed unsold")}
        />
        <ReasonAction
          label="Withdraw"
          variant="destructive"
          icon={<Icon.Ban size={14} />}
          title={`Take ${lot.title} off the block`}
          defaultReason={`Withdrawing ${lot.title} mid-auction.`}
          description="Nothing is sold and no money moves. The next question opens, and you can put this one back later."
          onConfirm={async (reason) => act("withdraw", { reason, lot_id: lot.id }, "Question withdrawn")}
        />
      </div>
    </div>
  );
}
