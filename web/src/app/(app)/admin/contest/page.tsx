"use client";

/** Every contest parameter, grouped by what it affects, with one save bar and one reason. */
import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { CardSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/client";

type C = { startingBalance: number; bidIncrement: number; countdownSeconds: number; openingWindowSeconds: number; ownershipCap: number | null; coding1Minutes: number; finalMinutes: number; p1PuzzlesMinutes: number; p1HackingMinutes: number; p1SelectionBasis: string; p1LeaderboardMode: string; leaderboardMode: string };

export default function ContestSettingsPage() {
  const { toast } = useToast();
  const [c, setC] = useState<C | null>(null);
  const [orig, setOrig] = useState<C | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { void api.get<C>("/api/admin/contest").then((x) => { setC(x); setOrig(x); }); }, []);
  if (!c) return <CardSkeleton lines={10} />;
  const dirty = JSON.stringify(c) !== JSON.stringify(orig);
  const num = (k: keyof C, label: string, hint?: string) => (
    <Field label={label} hint={hint}><Input type="number" value={String(c[k] ?? "")} onChange={(e) => setC({ ...c, [k]: Number(e.target.value) })} /></Field>
  );

  async function save() {
    if (!c) return;
    setBusy(true);
    try {
      const saved = await api.patch<C>("/api/admin/contest", {
        reason, starting_balance: c.startingBalance, bid_increment: c.bidIncrement, countdown_seconds: c.countdownSeconds, opening_window_seconds: c.openingWindowSeconds,
        ownership_cap: c.ownershipCap, coding1_minutes: c.coding1Minutes, final_minutes: c.finalMinutes, p1_puzzles_minutes: c.p1PuzzlesMinutes, p1_hacking_minutes: c.p1HackingMinutes,
        p1_selection_basis: c.p1SelectionBasis, p1_leaderboard_mode: c.p1LeaderboardMode, leaderboard_mode: c.leaderboardMode,
      });
      setC(saved); setOrig(saved); setReason(""); toast({ title: "Settings saved", description: "Recorded in the audit log.", tone: "success" });
    } catch (err) { toast({ title: "Not saved", description: errorMessage(err), tone: "error" }); } finally { setBusy(false); }
  }

  return (
    <div className="animate-fade-in pb-24">
      <PageHeader title="Contest settings" description="Structure is fixed; these are the values. Every save needs a reason and is audit-logged." />
      <Alert tone="info" title="Order matters">Prices depend on how many people advance from Phase 1: 25 questions among 20 is a different auction from 25 among 8. Set balances and prices after selection.</Alert>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card><CardHeader title="Phase 1" description="The qualifying round" /><CardBody>
          {num("p1PuzzlesMinutes", "Section A duration (min)")}{num("p1HackingMinutes", "Section B duration (min)")}
          <Field label="Selection basis" hint="Announced to participants before Phase 1 begins."><Textarea rows={3} value={c.p1SelectionBasis} onChange={(e) => setC({ ...c, p1SelectionBasis: e.target.value })} placeholder="e.g. Roughly the top half, at the organisers' discretion." /></Field>
          <Field label="Phase 1 leaderboard"><Select value={c.p1LeaderboardMode} onChange={(e) => setC({ ...c, p1LeaderboardMode: e.target.value })}><option value="live">live</option><option value="frozen">frozen</option><option value="hidden">hidden</option></Select></Field>
        </CardBody></Card>
        <Card><CardHeader title="Money" description="Identical for everyone" /><CardBody>
          {num("startingBalance", "Starting balance")}{num("bidIncrement", "Bid increment X", "Every bid is exactly this much above the last.")}
          <Field label="Ownership cap" hint="Blank = uncapped. The lever against a participant owning nothing."><Input type="number" value={c.ownershipCap ?? ""} onChange={(e) => setC({ ...c, ownershipCap: e.target.value === "" ? null : Number(e.target.value) })} placeholder="uncapped" /></Field>
          <Field label="Phase 2 leaderboard" hint="Announce before Auction 1 — it changes bidding."><Select value={c.leaderboardMode} onChange={(e) => setC({ ...c, leaderboardMode: e.target.value })}><option value="live">live</option><option value="frozen">frozen</option><option value="hidden">hidden</option></Select></Field>
        </CardBody></Card>
        <Card><CardHeader title="Timing" description="Auction and rounds" /><CardBody>
          {num("openingWindowSeconds", "Opening window (s)", "No bid within this and the question goes unsold.")}{num("countdownSeconds", "Bid countdown (s)", "Restarts on every bid. 0 disables it: manual close only.")}
          {num("coding1Minutes", "Coding Round 1 (min)")}{num("finalMinutes", "Final round (min)")}
        </CardBody></Card>
      </div>
      <div className={`fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 backdrop-blur transition-transform ${dirty ? "translate-y-0" : "translate-y-full"}`}>
        <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-2.5">
          <Icon.Alert className="text-amber" /><span className="text-sm font-semibold">Unsaved changes</span>
          <Input className="max-w-md" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for the change (required)" />
          <div className="ml-auto flex gap-2"><Button variant="secondary" onClick={() => setC(orig)}>Discard</Button><Button onClick={save} loading={busy} disabled={reason.trim().length < 3}>Save</Button></div>
        </div>
      </div>
    </div>
  );
}
