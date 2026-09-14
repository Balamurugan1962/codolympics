"use client";

/**
 * The order questions are offered at auction.
 *
 * This one matters more than the Phase 1 order: it is published in advance and
 * bidders plan their money around it — spend early on an easy one, or hold for
 * the hard one they know is coming. Once lots exist the order is fixed for the
 * contest, and the server refuses to change it.
 */
import { useCallback, useEffect, useState } from "react";

import { DifficultyBadge } from "@/components/admin/question-details-form";
import { useContest } from "@/components/contest-provider";
import { Icon } from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageBody, PageHeader, Section } from "@/components/ui/page";
import { ReorderList } from "@/components/ui/reorder-list";
import { ListSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/client";

type Q = { id: string; title: string; difficulty: string; score: number; basePrice: number; auctionOrder: number; status: string };

export default function AuctionOrderPage() {
  const { toast } = useToast();
  const { state } = useContest();
  const [rows, setRows] = useState<Q[] | null>(null);
  const [order, setOrder] = useState<Q[]>([]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await api.get<{ questions: Q[] }>("/api/admin/questions");
    const sorted = [...r.questions].sort((a, b) => a.auctionOrder - b.auctionOrder || a.id.localeCompare(b.id));
    setRows(sorted);
    setOrder(sorted);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const started = !["registration", "p1_puzzles", "p1_hacking", "review"].includes(state?.contest.phase ?? "");
  const dirty = rows ? order.map((r) => r.id).join() !== rows.map((r) => r.id).join() : false;

  async function save() {
    setBusy(true);
    try {
      await api.post("/api/admin/questions/order", { ids: order.map((r) => r.id), reason: reason.trim() });
      toast({ title: "Auction order saved", tone: "success" });
      setReason("");
      await load();
    } catch (err) {
      toast({ title: "Not saved", description: errorMessage(err), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageBody>
      <PageHeader
        title="Auction order"
        description="Drag to reorder, or use the arrow keys."
      />

      {started && (
        <Alert variant="warning" className="mb-5">
          <Icon.Lock />
          <AlertTitle>The order is fixed for this contest</AlertTitle>
          <AlertDescription>
            Lots have been created, and bidders have planned their money around this order. The server will refuse a change — reset the
            contest if you genuinely need a different one.
          </AlertDescription>
        </Alert>
      )}

      {!rows ? (
        <ListSkeleton rows={6} />
      ) : rows.length === 0 ? (
        <Section padded={false}>
          <EmptyState icon={<Icon.Gavel />} title="No auction questions yet" body="Add problems and give them contest details first." />
        </Section>
      ) : (
        <Section
          title={`${rows.length} lot${rows.length === 1 ? "" : "s"}`}
          description="Offered top to bottom. A voided question is skipped but keeps its place."
          padded={false}
          footer={
            dirty ? (
              <>
                <span className="mr-auto flex items-center gap-1.5 text-[12.5px] font-semibold">
                  <Icon.Alert size={14} className="text-amber" /> Unsaved order
                </span>
                <Input
                  className="max-w-xs"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason — recorded in the audit log"
                />
                <Button variant="outline" onClick={() => setOrder(rows)} disabled={busy}>
                  Discard
                </Button>
                <Button onClick={save} loading={busy} disabled={reason.trim().length < 3 || started}>
                  Save order
                </Button>
              </>
            ) : (
              <span className="text-[12.5px] text-muted-foreground">
                {started ? "Locked for this contest." : "Saved. Drag a row to change it."}
              </span>
            )
          }
        >
          <ReorderList items={order} onChange={setOrder} keyOf={(r) => r.id} disabled={busy || started}>
            {(r) => (
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-[13px] font-medium ${r.status === "void" ? "text-faint line-through" : ""}`}>{r.title}</span>
                <DifficultyBadge d={r.difficulty} />
                <span className="text-[11.5px] text-faint num">
                  {r.score} pts · base {r.basePrice}
                </span>
                {r.status === "void" && <Badge variant="neutral">void</Badge>}
                {r.status === "sold" && <Badge variant="neutral">sold</Badge>}
              </div>
            )}
          </ReorderList>
        </Section>
      )}
    </PageBody>
  );
}
