"use client";

/**
 * Moving a whole Phase 2 problem between installs.
 *
 * A problem is two things that normally live apart — the judge package on the
 * problems volume and the contest details in the database — and moving one
 * without the other gives you a problem nobody can solve or a question the
 * judge has never heard of. One zip carries both.
 *
 * A validation travels with the package it belongs to, so one proven where it
 * was exported arrives proven — re-running it is the work an import exists to
 * save. Publishing is still yours: a set someone hands you is not a set to put
 * in front of participants unlooked-at. (The Settings import is the other case
 * — your own setup coming back — and does restore what was live.)
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

type One = { id: string; version: string | null; details: boolean; hints: number; validated: boolean; live: boolean; warnings: string[] };
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
  const [note, setNote] = useState("");
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
      form.set("reason", note.trim() || `Imported the problem zip ${file.name}.`);
      if (id.trim()) form.set("id", id.trim());
      const r = await api.post<Result>("/api/admin/problems/import", form);
      setResult(r);
      const n = r.imported.length;
      const unproven = r.imported.filter((one) => one.version && !one.validated).length;
      toast({
        title: n === 1 ? `Imported ${r.imported[0].id}` : `Imported ${n} problems`,
        description: unproven ? `${unproven} still to validate here. Nothing was published.` : "Already validated where it was exported. Nothing was published.",
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
          : "One problem, every problem, or a plain judge package. A package proven where it was exported arrives proven; nothing is published."
      }
      footer={
        result ? (
          <Button onClick={onClose}>Done</Button>
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
          <ul className="divide-y rounded-md border">
            {result.imported.map((one) => (
              <li key={one.id} className="px-3.5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Icon.Check size={14} className="shrink-0 text-green" />
                  <span className="min-w-0 flex-1 truncate font-mono text-[13px] font-medium">{one.id}</span>
                  {one.version ? <Badge variant="neutral">{one.version}</Badge> : <Badge variant="warning">no package</Badge>}
                  {one.version && (one.validated ? <Badge variant="success">validated</Badge> : <Badge variant="warning">not validated</Badge>)}
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
              {result.imported.every((one) => !one.version || one.validated)
                ? "Every package came with a validation that passed where it was exported, so there is nothing to re-run — open each problem and publish it when you are ready. Re-validate first if this machine is slower than the one they were proven on."
                : "Open each problem marked not validated, run its validation, then publish. The ones that arrived validated were proven where they were exported; re-run those only if this machine is slower."}
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
          <Field label="Note" hint="optional" help="Goes into the audit log against the upload and the details. Left blank, the log records the file name.">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. the set written last week" />
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
