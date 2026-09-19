"use client";

/**
 * The order participants meet one section's questions in.
 *
 * Ordering is its own page rather than a column in the list, because it is a
 * decision about the shape of the round — easy first, or a hard one early to
 * spread the field — and it is made by looking at the whole set at once.
 * Nothing saves until you say so, so an order can be tried and abandoned.
 *
 * One section per page: Section A and Section B are ordered at different
 * moments, by different people, and a tab that quietly holds unsaved changes
 * for the section you are not looking at is a way to lose them.
 */
import { useCallback, useEffect, useState } from "react";

import { KIND_LABEL, type Hack, type Puzzle } from "@/components/admin/phase1-types";
import { Icon } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/ui/page";
import { ReorderList } from "@/components/ui/reorder-list";
import { ListSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/client";

type Row = { id: number; title: string; published: boolean; voided: boolean; points: number; kind?: string };

export function OrderPanel({ section }: { section: "puzzles" | "hacking" }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [order, setOrder] = useState<Row[]>([]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await api.get<{ questions: (Puzzle | Hack)[] }>(`/api/admin/phase1/${section}`);
    const mapped: Row[] = r.questions.map((q) => ({
      id: q.id,
      title: q.title,
      published: q.published,
      voided: q.voided,
      points: "points" in q ? q.points : q.hackPoints,
      kind: "kind" in q ? q.kind : undefined,
    }));
    setRows(mapped);
    setOrder(mapped);
  }, [section]);
  useEffect(() => {
    void load();
  }, [load]);

  const dirty = rows ? order.map((r) => r.id).join() !== rows.map((r) => r.id).join() : false;

  async function save() {
    setBusy(true);
    try {
      await api.post(`/api/admin/phase1/${section}/order`, { ids: order.map((r) => r.id), reason: reason.trim() });
      toast({ title: "Order saved", tone: "success" });
      setReason("");
      await load();
    } catch (err) {
      toast({ title: "Not saved", description: errorMessage(err), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  if (!rows) return <ListSkeleton rows={6} />;
  if (rows.length === 0) {
    return (
      <Section padded={false}>
        <EmptyState icon={<Icon.List />} title="Nothing to order yet" body="Write some questions first; the order is the last thing to settle." />
      </Section>
    );
  }

  return (
    <Section
      title={`${rows.length} question${rows.length === 1 ? "" : "s"}`}
      description="Voided questions are shown so the order stays stable if one is brought back."
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
            <Button onClick={save} loading={busy} disabled={reason.trim().length < 3}>
              Save order
            </Button>
          </>
        ) : (
          <span className="text-[12.5px] text-muted-foreground">Saved. Drag a row to change it.</span>
        )
      }
    >
      <ReorderList items={order} onChange={setOrder} keyOf={(r) => r.id} disabled={busy}>
        {(r) => (
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[13px] font-medium ${r.voided ? "text-faint line-through" : ""}`}>{r.title}</span>
            {r.kind && <Badge variant="outline">{KIND_LABEL[r.kind as keyof typeof KIND_LABEL] ?? r.kind}</Badge>}
            <span className="text-[11.5px] text-faint tabular-nums">{r.points} pts</span>
            {r.voided ? <Badge variant="neutral">void</Badge> : r.published ? <Badge variant="success">live</Badge> : <Badge variant="warning">draft</Badge>}
          </div>
        )}
      </ReorderList>
    </Section>
  );
}
