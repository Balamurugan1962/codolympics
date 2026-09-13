"use client";

/**
 * Moving a whole Phase 2 problem between installs.
 *
 * A problem is two things that normally live apart — the judge package on the
 * problems volume and the contest details in the database — and moving one
 * without the other gives you a problem nobody can solve or a question the
 * judge has never heard of. One zip carries both.
 *
 * Nothing imported is published. A package that goes live without someone here
 * validating it is how a contest discovers on the day that its tests were built
 * against a different checker.
 */
import { useState } from "react";

import { Icon } from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FileDrop } from "@/components/ui/file-drop";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Summary, SummaryItem } from "@/components/ui/summary";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/client";

type Result = { id: string; version: string | null; details: boolean; hints: number; warnings: string[] };

export function problemExportHref(id: string): string {
  return `/api/admin/problems/${encodeURIComponent(id)}/export`;
}

/** The menu item every problem row carries. */
export function problemExportMenuItem(id: string) {
  return {
    label: "Export as a zip",
    icon: <Icon.Download size={15} />,
    onSelect: () => {
      window.location.href = problemExportHref(id);
    },
  };
}

export function ImportProblemButton({ onImported }: { onImported: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Icon.Upload size={14} /> Upload a problem
      </Button>
      {open && <ImportDialog onClose={() => setOpen(false)} onImported={onImported} />}
    </>
  );
}

function ImportDialog({ onClose, onImported }: { onClose: () => void; onImported: () => Promise<void> }) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [id, setId] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  async function run() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("package", file);
      form.set("reason", reason.trim());
      if (id.trim()) form.set("id", id.trim());
      const r = await api.post<Result>("/api/admin/problems/import", form);
      setResult(r);
      toast({ title: `Imported ${r.id}`, description: r.version ? `Uploaded as ${r.version}.` : "Details only.", tone: "success" });
      await onImported();
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
      title={result ? `Imported ${result.id}` : "Upload a problem"}
      description={
        result
          ? undefined
          : "A zip exported from this app, or a plain judge package. Nothing is published — validate it first."
      }
      footer={
        result ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={run} loading={busy} disabled={!file || reason.trim().length < 3}>
              <Icon.Upload size={14} /> Import
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="space-y-4">
          <Summary cols={3}>
            <SummaryItem label="Problem" mono>
              {result.id}
            </SummaryItem>
            <SummaryItem label="Package">
              {result.version ? <Badge variant="info">{result.version}</Badge> : <span className="text-faint">none in the zip</span>}
            </SummaryItem>
            <SummaryItem label="Details">
              {result.details ? `imported · ${result.hints} hint${result.hints === 1 ? "" : "s"}` : <span className="text-faint">none</span>}
            </SummaryItem>
          </Summary>
          {result.warnings.length > 0 && (
            <Alert variant="warning">
              <Icon.Alert />
              <AlertTitle>Before this can be auctioned</AlertTitle>
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
          <FileDrop
            file={file}
            onFile={setFile}
            label="Drop a problem zip here, or browse"
            hint="question.json + package/, or a judge package with problem.json at its root"
          />
          <Field
            label="Problem id"
            hint="optional"
            help="Taken from the zip when it was exported from this app. Give one for a plain judge package, or to import under a different id."
          >
            <Input value={id} onChange={(e) => setId(e.target.value)} placeholder="e.g. two-sum" className="font-mono sm:w-64" />
          </Field>
          <Field label="Reason" required help="Recorded in the audit log against the upload and the details.">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. importing the set written last week" />
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
