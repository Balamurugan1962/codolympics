"use client";

/**
 * Settings. Grouped by what each value affects, each with the sentence that
 * explains why it matters. A save bar appears only when something changed and
 * asks for the reason that goes into the audit log.
 */
import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SettingRow } from "@/components/ui/form";
import { Input, Select, Textarea } from "@/components/ui/input";
import { PageBody, PageHeader, Section } from "@/components/ui/page";
import { CardSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/client";

type C = {
  startingBalance: number; bidIncrement: number; countdownSeconds: number; openingWindowSeconds: number; ownershipCap: number | null;
  coding1Minutes: number; finalMinutes: number; p1PuzzlesMinutes: number; p1HackingMinutes: number;
  p1SelectionBasis: string; p1LeaderboardMode: string; leaderboardMode: string;
};

export default function SettingsPage() {
  const { toast } = useToast();
  const [c, setC] = useState<C | null>(null);
  const [orig, setOrig] = useState<C | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { void api.get<C>("/api/admin/contest").then((x) => { setC(x); setOrig(x); }); }, []);

  if (!c) return <PageBody><PageHeader title="Settings" /><CardSkeleton lines={10} /></PageBody>;
  const dirty = JSON.stringify(c) !== JSON.stringify(orig);
  const set = <K extends keyof C>(k: K, v: C[K]) => setC({ ...c, [k]: v });
  const numberField = (k: keyof C, suffix?: string) => (
    <div className="flex items-center gap-2">
      <Input type="number" className="w-32" value={String(c[k] ?? "")} onChange={(e) => set(k, Number(e.target.value) as C[typeof k])} />
      {suffix && <span className="text-[12px] text-muted">{suffix}</span>}
    </div>
  );

  async function save() {
    if (!c) return;
    setBusy(true);
    try {
      const saved = await api.patch<C>("/api/admin/contest", {
        reason, starting_balance: c.startingBalance, bid_increment: c.bidIncrement, countdown_seconds: c.countdownSeconds,
        opening_window_seconds: c.openingWindowSeconds, ownership_cap: c.ownershipCap, coding1_minutes: c.coding1Minutes,
        final_minutes: c.finalMinutes, p1_puzzles_minutes: c.p1PuzzlesMinutes, p1_hacking_minutes: c.p1HackingMinutes,
        p1_selection_basis: c.p1SelectionBasis, p1_leaderboard_mode: c.p1LeaderboardMode, leaderboard_mode: c.leaderboardMode,
      });
      setC(saved); setOrig(saved); setReason(""); toast({ title: "Settings saved", description: "Recorded in the audit log.", tone: "success" });
    } catch (err) { toast({ title: "Not saved", description: errorMessage(err), tone: "error" }); } finally { setBusy(false); }
  }

  return (
    <PageBody className={dirty ? "pb-24" : ""}>
      <PageHeader title="Settings" description="The structure of the contest is fixed; these are its numbers. Every change is audit-logged." />

      <Alert tone="info" title="Set the prices last">
        Every price depends on how many people advance from Phase 1 — twenty-five questions among twenty is a different auction from twenty-five among eight.
      </Alert>

      <div className="mt-4 space-y-4">
        <Section title="Phase 1" description="The qualifying round." padded={false}>
          <SettingRow label="Section A duration" description="Logical puzzles. Participants may revise answers until it closes.">{numberField("p1PuzzlesMinutes", "minutes")}</SettingRow>
          <SettingRow label="Section B duration" description="Hacking. You open this section by hand when Section A is done.">{numberField("p1HackingMinutes", "minutes")}</SettingRow>
          <SettingRow label="Selection basis" description="Shown to participants before Phase 1 begins. Discretion is fine; silence is not.">
            <Textarea rows={3} value={c.p1SelectionBasis} onChange={(e) => set("p1SelectionBasis", e.target.value)} placeholder="e.g. Roughly the top half, at the organisers' discretion." />
          </SettingRow>
          <SettingRow label="Phase 1 standings" description="Whether participants can watch the Phase 1 leaderboard.">
            <Select value={c.p1LeaderboardMode} onChange={(e) => set("p1LeaderboardMode", e.target.value)}><option value="live">Live</option><option value="frozen">Frozen</option><option value="hidden">Hidden</option></Select>
          </SettingRow>
        </Section>

        <Section title="Money" description="Identical for everyone who advances." padded={false}>
          <SettingRow label="Starting balance" description="What each finalist has to bid with. Money never becomes score.">{numberField("startingBalance", "coins")}</SettingRow>
          <SettingRow label="Bid increment" description="Every bid is exactly this much above the last. There is no free bidding.">{numberField("bidIncrement", "coins")}</SettingRow>
          <SettingRow label="Ownership cap" description="Leave blank for no limit. This is your lever against one person taking everything and another owning nothing.">
            <Input type="number" className="w-32" value={c.ownershipCap ?? ""} placeholder="no limit" onChange={(e) => set("ownershipCap", e.target.value === "" ? null : Number(e.target.value))} />
          </SettingRow>
          <SettingRow label="Phase 2 leaderboard" description="Announce this before the first auction — it changes how people bid.">
            <Select value={c.leaderboardMode} onChange={(e) => set("leaderboardMode", e.target.value)}><option value="live">Live</option><option value="frozen">Frozen</option><option value="hidden">Hidden</option></Select>
          </SettingRow>
        </Section>

        <Section title="Auction and rounds" description="Timing for Phase 2." padded={false}>
          <SettingRow label="Opening window" description="A question with no bid in this time goes unsold and the auction moves on.">{numberField("openingWindowSeconds", "seconds")}</SettingRow>
          <SettingRow label="Bid countdown" description="Restarts on every bid, so bidding last never wins. Set 0 to close lots only by hand.">{numberField("countdownSeconds", "seconds")}</SettingRow>
          <SettingRow label="Coding Round 1" description="The main solving round after the first auction.">{numberField("coding1Minutes", "minutes")}</SettingRow>
          <SettingRow label="Final round" description="The last solving round. The contest ends when it closes.">{numberField("finalMinutes", "minutes")}</SettingRow>
        </Section>
      </div>

      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 backdrop-blur lg:left-60">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <span className="flex items-center gap-2 text-[13px] font-semibold"><Icon.Alert size={15} className="text-amber" /> Unsaved changes</span>
            <Input className="max-w-sm flex-1" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for this change (required)" />
            <div className="ml-auto flex gap-2">
              <Button variant="secondary" onClick={() => { setC(orig); setReason(""); }}>Discard</Button>
              <Button onClick={save} loading={busy} disabled={reason.trim().length < 3}>Save changes</Button>
            </div>
          </div>
        </div>
      )}
    </PageBody>
  );
}
