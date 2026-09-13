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
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/client";

type One = { id: string; version: string | null; details: boolean; hints: number; warnings: string[] };
type Result = { imported: One[] };

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

/** Import, and export-everything, beside the New button. */
export function ProblemTransferActions({ onImported }: { onImported: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Icon.Upload size={14} /> Upload a problem
      </Button>
      <Button
        variant="outline"
        onClick={() => {
          window.location.href = "/api/admin/problems/export";
        }}
      >
        <Icon.Download size={14} /> Export all
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
      const n = r.imported.length;
      toast({
        title: n === 1 ? `Imported ${r.imported[0].id}` : `Imported ${n} problems`,
        description: "Nothing was published — validate each package first.",
        tone: "success",
      });
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
      title={result ? (result.imported.length === 1 ? `Imported ${result.imported[0].id}` : `Imported ${result.imported.length} problems`) : "Upload a problem"}
      description={
        result
          ? undefined
          : "One problem, every problem, or a plain judge package. Nothing is published — validate each one first."
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
          <ul className="divide-y rounded-md border">
            {result.imported.map((one) => (
              <li key={one.id} className="px-3.5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Icon.Check size={14} className="shrink-0 text-green" />
                  <span className="min-w-0 flex-1 truncate font-mono text-[13px] font-medium">{one.id}</span>
                  {one.version ? <Badge variant="info">{one.version}</Badge> : <Badge variant="warning">no package</Badge>}
                  {one.details ? (
                    <Badge variant="neutral">
                      details · {one.hints} hint{one.hints === 1 ? "" : "s"}
                    </Badge>
                  ) : (
                    <Badge variant="warning">no details</Badge>
                  )}
                </div>
                {one.warnings.length > 0 && (
                  <ul className="mt-1.5 ml-6 list-disc space-y-0.5 text-[11.5px] text-muted-foreground">
                    {one.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
          <Alert variant="info">
            <Icon.Info />
            <AlertTitle>Nothing is live yet</AlertTitle>
            <AlertDescription>
              Every package arrived unpublished. Open each problem, run its validation, then publish — an import cannot know whether these
              tests were built against the checker on this judge.
            </AlertDescription>
          </Alert>
        </div>
      ) : (
        <div className="space-y-4">
          <FileDrop
            file={file}
            onFile={setFile}
            label="Drop a problem zip here, or browse"
            hint="one problem, a problems/ bundle, or a judge package with problem.json at its root"
          />
          <Field
            label="Problem id"
            hint="optional"
            help="Taken from the zip when it was exported from this app, and ignored for a bundle. Give one for a plain judge package."
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
