"use client";

/**
 * Settings. Grouped by what each value affects, each with the sentence that
 * explains why it matters. A save bar appears only when something changed and
 * asks for the reason that goes into the audit log.
 */
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useContest } from "@/components/contest-provider";
import { Icon } from "@/components/icons";
import { SetupTransfer } from "@/components/admin/setup-transfer";
import { PHASE_LABEL } from "@/components/shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, SettingRow } from "@/components/ui/field";
import { Hint } from "@/components/ui/hint";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PageBody, PageHeader, Section } from "@/components/ui/page";
import { SimpleSelect } from "@/components/ui/select";
import { CardSkeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/client";

type C = {
  startingBalance: number;
  bidIncrement: number;
  countdownSeconds: number;
  openingWindowSeconds: number;
  ownershipCap: number | null;
  coding1Minutes: number;
  finalMinutes: number;
  p1PuzzlesMinutes: number;
  p1HackingMinutes: number;
  p1SelectionBasis: string;
  p1LeaderboardMode: string;
  leaderboardMode: string;
};

const VISIBILITY = [
  { value: "live", label: "Live", hint: "· everyone watches" },
  { value: "frozen", label: "Frozen", hint: "· stops updating" },
  { value: "hidden", label: "Hidden", hint: "· nobody sees it" },
];

export default function SettingsPage() {
  const { toast } = useToast();
  const [c, setC] = useState<C | null>(null);
  const [orig, setOrig] = useState<C | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api.get<C>("/api/admin/contest").then((x) => {
      setC(x);
      setOrig(x);
    });
  }, []);

  if (!c) {
    return (
      <PageBody>
        <PageHeader title="Settings" />
        <CardSkeleton lines={10} />
      </PageBody>
    );
  }

  const dirty = JSON.stringify(c) !== JSON.stringify(orig);
  const set = <K extends keyof C>(k: K, v: C[K]) => setC({ ...c, [k]: v });
  const numberField = (k: keyof C, suffix?: string) => (
    <div className="flex items-center gap-2">
      <Input type="number" className="w-32" value={String(c[k] ?? "")} onChange={(e) => set(k, Number(e.target.value) as C[typeof k])} />
      {suffix && <span className="text-[12px] text-muted-foreground">{suffix}</span>}
    </div>
  );

  async function save() {
    if (!c) return;
    setBusy(true);
    try {
      const saved = await api.patch<C>("/api/admin/contest", {
        reason,
        starting_balance: c.startingBalance,
        bid_increment: c.bidIncrement,
        countdown_seconds: c.countdownSeconds,
        opening_window_seconds: c.openingWindowSeconds,
        ownership_cap: c.ownershipCap,
        coding1_minutes: c.coding1Minutes,
        final_minutes: c.finalMinutes,
        p1_puzzles_minutes: c.p1PuzzlesMinutes,
        p1_hacking_minutes: c.p1HackingMinutes,
        p1_selection_basis: c.p1SelectionBasis,
        p1_leaderboard_mode: c.p1LeaderboardMode,
        leaderboard_mode: c.leaderboardMode,
      });
      setC(saved);
      setOrig(saved);
      setReason("");
      toast({ title: "Settings saved", description: "Recorded in the audit log.", tone: "success" });
    } catch (err) {
      toast({ title: "Not saved", description: errorMessage(err), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageBody className={dirty ? "pb-24" : ""}>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            Settings
            <Hint>
              Set the prices last. Every price depends on how many people advance from Phase 1 — twenty-five questions among twenty is a
              different auction from twenty-five among eight.
            </Hint>
          </span>
        }
        description="The structure of the contest is fixed; these are its numbers. Every change is audit-logged."
      />

      <div className="space-y-5">
        <Section title="Phase 1" description="The qualifying round." padded={false}>
          <SettingRow label="Section A duration" description="Logical puzzles. Participants may revise answers until it closes.">
            {numberField("p1PuzzlesMinutes", "minutes")}
          </SettingRow>
          <SettingRow label="Section B duration" description="Hacking. You open this section by hand when Section A is done.">
            {numberField("p1HackingMinutes", "minutes")}
          </SettingRow>
          <SettingRow label="Selection basis" description="Shown to participants before Phase 1 begins. Discretion is fine; silence is not.">
            <Textarea
              rows={3}
              value={c.p1SelectionBasis}
              onChange={(e) => set("p1SelectionBasis", e.target.value)}
              placeholder="e.g. Roughly the top half, at the organisers' discretion."
            />
          </SettingRow>
          <SettingRow label="Phase 1 standings" description="Whether participants can watch the Phase 1 leaderboard.">
            <SimpleSelect className="w-full" size="default" value={c.p1LeaderboardMode} onValueChange={(v) => set("p1LeaderboardMode", v)} options={VISIBILITY} />
          </SettingRow>
        </Section>

        <Section title="Money" description="Identical for everyone who advances." padded={false}>
          <SettingRow label="Starting balance" description="What each finalist has to bid with. Money never becomes score.">
            {numberField("startingBalance", "coins")}
          </SettingRow>
          <SettingRow label="Bid increment" description="Every bid is exactly this much above the last. There is no free bidding.">
            {numberField("bidIncrement", "coins")}
          </SettingRow>
          <SettingRow
            label="Ownership cap"
            description="Leave blank for no limit. This is your lever against one person taking everything and another owning nothing."
          >
            <Input
              type="number"
              className="w-32"
              value={c.ownershipCap ?? ""}
              placeholder="no limit"
              onChange={(e) => set("ownershipCap", e.target.value === "" ? null : Number(e.target.value))}
            />
          </SettingRow>
          <SettingRow label="Phase 2 leaderboard" description="Announce this before the first auction — it changes how people bid.">
            <SimpleSelect className="w-full" size="default" value={c.leaderboardMode} onValueChange={(v) => set("leaderboardMode", v)} options={VISIBILITY} />
          </SettingRow>
        </Section>

        <Section title="Auction and rounds" description="Timing for Phase 2." padded={false}>
          <SettingRow label="Opening window" description="A question with no bid in this time goes unsold and the auction moves on.">
            {numberField("openingWindowSeconds", "seconds")}
          </SettingRow>
          <SettingRow label="Bid countdown" description="Restarts on every bid, so bidding last never wins. Set 0 to close lots only by hand.">
            {numberField("countdownSeconds", "seconds")}
          </SettingRow>
          <SettingRow label="Coding Round 1" description="The main solving round after the first auction.">
            {numberField("coding1Minutes", "minutes")}
          </SettingRow>
          <SettingRow label="Final round" description="The last solving round. The contest ends when it closes.">
            {numberField("finalMinutes", "minutes")}
          </SettingRow>
        </Section>

        <SetupTransfer />

        <DangerZone
          onReset={async () => {
            const fresh = await api.get<C>("/api/admin/contest");
            setC(fresh);
            setOrig(fresh);
          }}
        />
      </div>

      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur lg:left-60">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <span className="flex items-center gap-2 text-[13px] font-semibold">
              <Icon.Alert size={15} className="text-amber" /> Unsaved changes
            </span>
            <Input className="max-w-sm flex-1" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for this change (required)" />
            <div className="ml-auto flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setC(orig);
                  setReason("");
                }}
              >
                Discard
              </Button>
              <Button onClick={save} loading={busy} disabled={reason.trim().length < 3}>
                Save changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageBody>
  );
}

// ---------------------------------------------------------------------------

type Scope = "run" | "everything";

const SCOPES: Record<Scope, { title: string; button: string; phrase: string; body: string; keeps: string[]; removes: string[] }> = {
  run: {
    title: "Reset the contest",
    button: "Reset the contest",
    phrase: "reset the contest",
    body: "Returns to registration with nobody signed up, as if the day had not started. Use it after a rehearsal, or to run the contest a second time with the same problems.",
    keeps: [
      "Problems, packages and hints",
      "Phase 1 puzzles and hacking questions",
      "Every setting on this page",
      "Administrator and evaluator accounts",
      "The audit log",
    ],
    removes: [
      "Every participant account and session",
      "Every answer, hack attempt and submission",
      "Every bid, lot and ownership",
      "Every balance, purchase and ledger entry",
      "Announcements and notifications",
    ],
  },
  everything: {
    title: "Wipe everything",
    button: "Wipe everything",
    phrase: "wipe everything",
    body: "Everything above, and the content too: every problem package is deleted from the judge, every question and Phase 1 question is removed, and the settings return to their defaults. What is left is an empty installation.",
    keeps: ["Administrator and evaluator accounts", "The audit log"],
    removes: [
      "Everything a reset removes",
      "Every problem package on the judge",
      "Every auction question and hint",
      "Every Phase 1 puzzle and hacking question",
      "Your settings — back to the defaults",
    ],
  },
};

/**
 * The bottom of the page, where the irreversible things live. Each one says
 * what it keeps and what it removes, and asks for the phrase to be typed — the
 * same phrase the server checks, so the guard cannot be skipped by calling the
 * API directly.
 */
function DangerZone({ onReset }: { onReset: () => Promise<void> }) {
  const { state } = useContest();
  const [open, setOpen] = useState<Scope | null>(null);
  const phase = state?.contest.phase ?? "registration";
  const running = phase !== "registration" && phase !== "ended";

  return (
    <>
      <Card className="overflow-hidden border-red/40">
        <div className="border-b border-red/30 bg-red-tint px-5 py-3.5">
          <h2 className="flex items-center gap-2 text-[14px] font-semibold text-red">
            <Icon.Alert size={15} /> Danger zone
          </h2>
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
            Irreversible, and there is no backup taken for you. Export the results from the audit log first if this contest counted for
            anything.
          </p>
        </div>
        <div>
          {(Object.keys(SCOPES) as Scope[]).map((scope) => {
            const s = SCOPES[scope];
            return (
              <div key={scope} className="flex flex-col gap-3 border-b px-5 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold">{s.title}</div>
                  <p className="mt-0.5 max-w-xl text-[12px] leading-relaxed text-muted-foreground">{s.body}</p>
                </div>
                <Button variant="destructive" className="shrink-0 sm:ml-4" onClick={() => setOpen(scope)}>
                  {s.button}
                </Button>
              </div>
            );
          })}
        </div>
      </Card>

      {running && (
        <p className="flex items-start gap-2 px-1 text-[12px] leading-relaxed text-muted-foreground">
          <Icon.Alert size={14} className="mt-0.5 shrink-0 text-amber" />
          The contest is in <strong className="font-semibold text-foreground">{PHASE_LABEL[phase] ?? phase}</strong> right now. Both of these
          end it for everyone who is signed in.
        </p>
      )}

      {open && <ResetDialog scope={open} running={running} onClose={() => setOpen(null)} onDone={onReset} />}
    </>
  );
}

function ResetDialog({ scope, running, onClose, onDone }: { scope: Scope; running: boolean; onClose: () => void; onDone: () => Promise<void> }) {
  const { toast } = useToast();
  const { refresh } = useContest();
  const router = useRouter();
  const s = SCOPES[scope];
  const [confirm, setConfirm] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = confirm.trim().toLowerCase() === s.phrase && reason.trim().length >= 3;

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<{ participants: number; packages: number }>("/api/admin/contest/reset", {
        scope,
        reason: reason.trim(),
        confirm: confirm.trim(),
      });
      toast({
        title: scope === "everything" ? "Everything wiped" : "Contest reset",
        description: `${r.participants} participant account${r.participants === 1 ? "" : "s"} removed${
          r.packages ? `, ${r.packages} package${r.packages === 1 ? "" : "s"} deleted` : ""
        }. Back to registration.`,
        tone: "success",
        duration: 8000,
      });
      onClose();
      await onDone();
      await refresh();
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`${s.title}?`}
      description={s.body}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={run} loading={busy} disabled={!ready}>
            {s.button}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-red/30 bg-red-tint/50 p-3">
          <div className="mb-1.5 text-[11px] font-semibold tracking-[0.06em] text-red uppercase">Removed for good</div>
          <ul className="space-y-1 text-[12px] leading-snug">
            {s.removes.map((x) => (
              <li key={x} className="flex gap-1.5">
                <Icon.X size={12} className="mt-0.5 shrink-0 text-red" />
                {x}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-md border bg-muted p-3">
          <div className="mb-1.5 text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">Kept</div>
          <ul className="space-y-1 text-[12px] leading-snug">
            {s.keeps.map((x) => (
              <li key={x} className="flex gap-1.5">
                <Icon.Check size={12} className="mt-0.5 shrink-0 text-green" />
                {x}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {running && (
        <Alert variant="warning" className="mt-4">
          <Icon.Alert />
          <AlertDescription>The contest is running. Everyone signed in is thrown out and the phase goes back to registration.</AlertDescription>
        </Alert>
      )}

      <div className="mt-4 space-y-3">
        <Field
          label={
            <>
              Type <span className="font-mono font-semibold">{s.phrase}</span> to confirm
            </>
          }
        >
          <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={s.phrase} autoFocus autoComplete="off" spellCheck={false} />
        </Field>
        <Field label="Reason" help="Recorded in the audit log, which survives the reset.">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. rehearsal finished, starting the real contest" />
        </Field>
      </div>

      {error && (
        <Alert variant="destructive" className="mt-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </Modal>
  );
}
