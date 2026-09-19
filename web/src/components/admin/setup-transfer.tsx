"use client";

/**
 * Carrying a whole contest setup between days, or between machines.
 *
 * The day before a contest you settle everything — the numbers, the problem
 * set, the Phase 1 questions, the running order, the people who will grade.
 * None of that should have to be done twice, so it all travels in one zip.
 *
 * What it will not carry is the point: participants, balances, bids, answers,
 * submissions, announcements and the audit log are what *happened*, not what
 * was set up. Importing them would start day two with day one's results.
 */
import { useState } from "react";

import { Icon } from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckField, Field } from "@/components/ui/field";
import { FileDrop } from "@/components/ui/file-drop";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Summary, SummaryItem } from "@/components/ui/summary";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/client";

type Summary = {
  settings: boolean; staff: number; problems: number; puzzles: number; hacks: number;
  verified: number; published: number; unverified: string[]; warnings: string[];
};

const CARRIES = [
  "Every setting on this page",
  "All Phase 2 problems: details, hints and judge packages",
  "All Phase 1 puzzles and hacking questions",
  "The auction order and the Phase 1 question order",
  "Administrator and evaluator accounts, with their logins",
  "The proving: validated packages, self-tested puzzles, proven hacks",
  "What was live goes back live, if the contest has not started",
];
const LEAVES = [
  "Participants and their accounts",
  "Balances, bids, lots and ownership",
  "Answers, hack attempts and submissions",
  "Announcements and notifications",
  "The audit log, and the phase itself",
];

export function SetupTransfer() {
  const [importing, setImporting] = useState(false);
  const [withStaff, setWithStaff] = useState(true);

  return (
    <>
      <Card className="overflow-hidden">
        <div className="border-b px-5 py-3.5">
          <h2 className="flex items-center gap-2 text-[14px] font-semibold">
            <Icon.Package size={15} /> Setup, out and back in
          </h2>
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
            Set the contest up once, export it, and import it on the day — settings, problems, questions, the proving and what was live.
            Nothing that happened during a contest travels: only what was set up.
          </p>
        </div>

        <div className="grid gap-3 border-b p-5 sm:grid-cols-2">
          <div>
            <div className="mb-1.5 text-[11px] font-semibold tracking-[0.06em] text-green-dark uppercase">Carried</div>
            <ul className="space-y-1 text-[12px] leading-snug">
              {CARRIES.map((x) => (
                <li key={x} className="flex gap-1.5">
                  <Icon.Check size={12} className="mt-0.5 shrink-0 text-green" />
                  {x}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="mb-1.5 text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">Left behind</div>
            <ul className="space-y-1 text-[12px] leading-snug">
              {LEAVES.map((x) => (
                <li key={x} className="flex gap-1.5">
                  <Icon.X size={12} className="mt-0.5 shrink-0 text-faint" />
                  {x}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <CheckField
            label="Include staff logins"
            help="Evaluators sign in exactly as before. The zip then holds password hashes — keep it where you keep a password list."
            checked={withStaff}
            onChange={(e) => setWithStaff(e.target.checked)}
          />
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="outline" onClick={() => setImporting(true)}>
              <Icon.Upload size={14} /> Import a setup
            </Button>
            <Button
              onClick={() => {
                window.location.href = `/api/admin/setup${withStaff ? "" : "?staff=0"}`;
              }}
            >
              <Icon.Download size={14} /> Export the setup
            </Button>
          </div>
        </div>
      </Card>

      {importing && <ImportDialog onClose={() => setImporting(false)} />}
    </>
  );
}

function ImportDialog({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Summary | null>(null);

  async function run() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("package", file);
      form.set("reason", note.trim() || `Imported the setup zip ${file.name}.`);
      const r = await api.post<Summary>("/api/admin/setup", form);
      setResult(r);
      toast({
        title: "Setup imported",
        description:
          r.unverified.length === 0
            ? `Everything arrived proven${r.published ? ` and ${r.published} went back live` : ""}.`
            : `${r.unverified.length} still need proving here.`,
        tone: "success",
      });
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
      size="lg"
      title={result ? "Setup imported" : "Import a setup"}
      description={result ? undefined : "A zip exported from this page. Everything in it is added; nothing already here is deleted."}
      footer={
        result ? (
          <Button
            onClick={() => {
              onClose();
              window.location.reload();
            }}
          >
            Done
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={run} loading={busy} disabled={!file}>
              <Icon.Upload size={14} /> Import
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="space-y-4">
          <Summary cols={3}>
            <SummaryItem label="Settings">{result.settings ? <Badge variant="success">restored</Badge> : <span className="text-faint">none</span>}</SummaryItem>
            <SummaryItem label="Staff added">{result.staff}</SummaryItem>
            <SummaryItem label="Problems">{result.problems}</SummaryItem>
            <SummaryItem label="Puzzles">{result.puzzles}</SummaryItem>
            <SummaryItem label="Hacking questions">{result.hacks}</SummaryItem>
            <SummaryItem label="Arrived proven">{result.verified}</SummaryItem>
            <SummaryItem label="Back live">{result.published}</SummaryItem>
          </Summary>
          {result.unverified.length === 0 ? (
            <Alert variant="success">
              <Icon.Check />
              <AlertTitle>Nothing to re-prove</AlertTitle>
              <AlertDescription>
                Every package, puzzle and hacking question in this zip was already proven where it was exported, and the results came with
                them — so none of that has to be done again. Each one says where it was proven, and you can re-run any of them if this
                machine is slower than the one that did.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="warning">
              <Icon.Alert />
              <AlertTitle>
                {result.unverified.length} still {result.unverified.length === 1 ? "needs" : "need"} proving
              </AlertTitle>
              <AlertDescription>
                {result.unverified.join(", ")} — these were never proven on the install that exported this zip, so there was nothing to
                carry. Validate or self-test each one before publishing it.
              </AlertDescription>
            </Alert>
          )}
          {result.warnings.length > 0 && (
            <Alert variant="warning">
              <Icon.Alert />
              <AlertTitle>Warnings</AlertTitle>
              <AlertDescription>
                <ul className="ml-4 list-disc space-y-0.5">
                  {result.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <FileDrop file={file} onFile={setFile} label="Drop a setup zip here, or browse" hint="contest.json at the root" />
          <Alert variant="info">
            <Icon.Info />
            <AlertDescription>
              An import is additive. Settings are overwritten, content is added, and an account whose username already exists is left alone —
              importing a zip should never lock you out.
            </AlertDescription>
          </Alert>
          <Field label="Note" hint="optional" help="Goes into the audit log against every change this makes. Left blank, the log records the file name.">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. restoring yesterday's setup for the real contest" />
          </Field>
          {error && (
            <Alert variant="destructive">
              <Icon.Alert />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </Modal>
  );
}
