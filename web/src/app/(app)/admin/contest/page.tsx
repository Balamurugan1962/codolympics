"use client";

/** Every contest parameter, editable with a reason (US-F9-00, US-B9-04). */
import { useEffect, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { api, errorMessage } from "@/lib/client";

type C = Record<string, unknown> & { startingBalance: number; bidIncrement: number; countdownSeconds: number; openingWindowSeconds: number; ownershipCap: number | null; coding1Minutes: number; finalMinutes: number; p1PuzzlesMinutes: number; p1HackingMinutes: number; p1SelectionBasis: string; p1LeaderboardMode: string; leaderboardMode: string };

const NUMBERS: [keyof C, string, string][] = [
  ["startingBalance", "Starting balance", "Identical for everyone. Set after the advancement count is known."],
  ["bidIncrement", "Bid increment X", "Every bid is exactly this much above the last."],
  ["countdownSeconds", "Bid countdown (s)", "Restarts on every bid. 0 disables it: manual close only."],
  ["openingWindowSeconds", "Opening window (s)", "No bid within this and the question goes unsold."],
  ["coding1Minutes", "Coding Round 1 (min)", ""],
  ["finalMinutes", "Final round (min)", ""],
  ["p1PuzzlesMinutes", "Phase 1 Section A (min)", ""],
  ["p1HackingMinutes", "Phase 1 Section B (min)", ""],
];

export default function ContestSettingsPage() {
  const [c, setC] = useState<C | null>(null);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  useEffect(() => { void api.get<C>("/api/admin/contest").then(setC); }, []);
  if (!c) return null;

  async function save() {
    if (!c) return;
    try {
      const saved = await api.patch<C>("/api/admin/contest", {
        reason, starting_balance: c.startingBalance, bid_increment: c.bidIncrement, countdown_seconds: c.countdownSeconds,
        opening_window_seconds: c.openingWindowSeconds, ownership_cap: c.ownershipCap, coding1_minutes: c.coding1Minutes,
        final_minutes: c.finalMinutes, p1_puzzles_minutes: c.p1PuzzlesMinutes, p1_hacking_minutes: c.p1HackingMinutes,
        p1_selection_basis: c.p1SelectionBasis, p1_leaderboard_mode: c.p1LeaderboardMode, leaderboard_mode: c.leaderboardMode,
      });
      setC(saved); setMsg({ tone: "success", text: "Saved and audit-logged." }); setReason("");
    } catch (err) { setMsg({ tone: "error", text: errorMessage(err) }); }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title="Phase 2 economics and timing" />
        <CardBody>
          {NUMBERS.map(([k, label, hint]) => (
            <Field key={String(k)} label={label} hint={hint}><Input type="number" value={String(c[k] ?? "")} onChange={(e) => setC({ ...c, [k]: Number(e.target.value) })} /></Field>
          ))}
          <Field label="Ownership cap" hint="Blank = uncapped. This is the lever against a participant owning nothing (US-B4-03)."><Input type="number" value={c.ownershipCap ?? ""} onChange={(e) => setC({ ...c, ownershipCap: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
          <Field label="Phase 2 leaderboard" hint="Announce this before Auction 1 — it changes bidding strategy.">
            <Select value={c.leaderboardMode} onChange={(e) => setC({ ...c, leaderboardMode: e.target.value })}><option value="live">live</option><option value="frozen">frozen</option><option value="hidden">hidden</option></Select>
          </Field>
        </CardBody>
      </Card>
      <div className="space-y-6">
        <Card>
          <CardHeader title="Phase 1" />
          <CardBody>
            <Field label="Selection basis" hint="Announced to participants before Phase 1 begins (US-P6-01)."><Textarea rows={3} value={c.p1SelectionBasis} onChange={(e) => setC({ ...c, p1SelectionBasis: e.target.value })} /></Field>
            <Field label="Phase 1 leaderboard"><Select value={c.p1LeaderboardMode} onChange={(e) => setC({ ...c, p1LeaderboardMode: e.target.value })}><option value="live">live</option><option value="frozen">frozen</option><option value="hidden">hidden</option></Select></Field>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Save" />
          <CardBody>
            <Field label="Reason (audit log)"><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. prices set after ranking the problem set" /></Field>
            {msg && <div className="mb-3"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
            <Button onClick={save} disabled={reason.trim().length < 3}>Save changes</Button>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
