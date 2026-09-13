"use client";

/**
 * Moving Phase 1 questions between installs.
 *
 * Phase 2 problems arrive as a package built elsewhere; Phase 1 questions are
 * written here, so the zip is an output first and an input second. An author
 * builds a set on their own machine, keeps it in a repository, and imports it
 * into the contest install on the day.
 *
 * Everything imported lands as a draft. A question that has not been read by
 * someone on this install has no business appearing in front of participants,
 * however carefully it was written somewhere else.
 */
import { useState } from "react";

import { Icon } from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FileDrop } from "@/components/ui/file-drop";
import { Input } from "@/components/ui/input";
import { Menu } from "@/components/ui/menu";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/client";

type Section = "puzzles" | "hacking";

type ImportResult = {
  created: { section: Section; id: number; title: string }[];
  missingPackages: { title: string; problem_id: string }[];
  skipped: { path: string; why: string }[];
};

/** Browsers will not download from fetch, so exports go through a plain link. */
export function exportHref(section: Section | "all", id?: number): string {
  return id === undefined ? `/api/admin/phase1/${section}/export` : `/api/admin/phase1/${section}/${id}/export`;
}

/** The menu item every question row carries. */
export function exportMenuItem(section: Section, id: number) {
  return {
    label: "Export as a zip",
    icon: <Icon.Download size={15} />,
    onSelect: () => {
      window.location.href = exportHref(section, id);
    },
  };
}

/** Import, and export-everything, beside the New button. */
export function TransferActions({ section, onImported }: { section: Section; onImported: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Icon.Upload size={14} /> Upload a question
      </Button>
      <Menu
        label="Export"
        items={[
          {
            label: section === "puzzles" ? "Export every puzzle" : "Export every hacking question",
            icon: <Icon.Download size={15} />,
            onSelect: () => {
              window.location.href = exportHref(section);
            },
          },
          {
            label: "Export all of Phase 1",
            icon: <Icon.Package size={15} />,
            onSelect: () => {
              window.location.href = exportHref("all");
            },
          },
        ]}
      />
      {open && <ImportDialog section={section} onClose={() => setOpen(false)} onImported={onImported} />}
    </>
  );
}

function ImportDialog({ section, onClose, onImported }: { section: Section; onClose: () => void; onImported: () => Promise<void> }) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function run() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("package", file);
      form.set("reason", reason.trim());
      const r = await api.post<ImportResult>(`/api/admin/phase1/${section}/import`, form);
      setResult(r);
      toast({
        title: `Imported ${r.created.length} question${r.created.length === 1 ? "" : "s"}`,
        description: "They are drafts until you publish them.",
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
      title={result ? "Imported" : "Upload a question"}
      description={
        result
          ? undefined
          : "A zip exported from this app — one question, a whole section, or all of Phase 1. Everything arrives as a draft."
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
            {result.created.map((q) => (
              <li key={`${q.section}-${q.id}`} className="flex items-center gap-2.5 px-3.5 py-2.5">
                <Icon.Check size={14} className="shrink-0 text-green" />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{q.title}</span>
                <Badge variant="outline">{q.section === "puzzles" ? "Section A" : "Section B"}</Badge>
                <Badge variant="warning">draft</Badge>
              </li>
            ))}
          </ul>

          {result.missingPackages.length > 0 && (
            <Alert variant="warning">
              <Icon.Alert />
              <AlertTitle>
                {result.missingPackages.length} question{result.missingPackages.length === 1 ? "" : "s"} need a judge package
              </AlertTitle>
              <AlertDescription>
                A hacking question's tests and reference solution live on the judge, not in this zip. Upload these under Problems before
                publishing:
                <ul className="mt-1 ml-4 list-disc">
                  {result.missingPackages.map((m) => (
                    <li key={m.problem_id}>
                      <span className="font-mono">{m.problem_id}</span> — for {m.title}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {result.skipped.length > 0 && (
            <Alert variant="destructive">
              <Icon.Alert />
              <AlertTitle>
                {result.skipped.length} skipped
              </AlertTitle>
              <AlertDescription>
                <ul className="ml-4 list-disc">
                  {result.skipped.map((sk) => (
                    <li key={sk.path}>
                      <span className="font-mono">{sk.path || "question.json"}</span> — {sk.why}
                    </li>
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
            label="Drop a question zip here, or browse"
            hint="question.json at the root, or a puzzles/ and hacking/ set"
          />
          <Field label="Reason" required help="Recorded in the audit log against every question this creates.">
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
