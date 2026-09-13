"use client";

/**
 * Validating the whole problem set in one go.
 *
 * Re-validating after an import is not paperwork: a validation result is only
 * ever true of the machine it ran on, and the one thing an exported package
 * cannot carry is how fast the importing machine is. But making someone visit
 * five pages to re-establish that is how the step gets skipped, so it becomes
 * one button and a table of what it found.
 */
import { useState } from "react";

import { Icon } from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/client";

type Row = {
  id: string; version: string | null; ok: boolean; skipped: string | null;
  verdict: string | null; passed: number | null; testcases: number | null; max_time_ms: number | null; issues: string[];
};

export function ValidateAllButton({ onDone }: { onDone: () => Promise<void> }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);

  async function run() {
    setBusy(true);
    try {
      const r = await api.post<{ results: Row[] }>("/api/admin/problems/validate-all", {});
      setRows(r.results);
      const passed = r.results.filter((x) => x.ok).length;
      const failed = r.results.filter((x) => !x.ok && !x.skipped).length;
      toast({
        title: failed ? `${failed} package${failed === 1 ? "" : "s"} did not validate` : `${passed} validated`,
        tone: failed ? "error" : "success",
      });
      await onDone();
    } catch (err) {
      toast({ title: "Could not validate", description: errorMessage(err), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  const failed = rows?.filter((r) => !r.ok && !r.skipped) ?? [];

  return (
    <>
      <Button variant="outline" onClick={run} loading={busy}>
        <Icon.ShieldCheck size={14} /> Validate all
      </Button>

      {rows && (
        <Modal
          open
          onClose={() => setRows(null)}
          size="lg"
          title="Validation"
          description="Each reference solution run against its own testcases, on this judge."
          footer={<Button onClick={() => setRows(null)}>Done</Button>}
        >
          <div className="space-y-4">
            {failed.length > 0 && (
              <Alert variant="destructive">
                <Icon.Alert />
                <AlertTitle>
                  {failed.length} package{failed.length === 1 ? "" : "s"} did not pass
                </AlertTitle>
                <AlertDescription>
                  Do not publish these. A reference that fails its own tests means the package is wrong, not the competitor.
                </AlertDescription>
              </Alert>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Problem</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead className="text-right">Tests</TableHead>
                  <TableHead className="text-right">Slowest</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-[12.5px]">{r.id}</TableCell>
                    <TableCell>
                      {r.skipped ? (
                        <span className="text-[12px] text-muted-foreground">{r.skipped}</span>
                      ) : r.ok ? (
                        <Badge variant="success">{r.verdict ?? "valid"}</Badge>
                      ) : (
                        <div className="space-y-1">
                          <Badge variant="destructive">{r.verdict ?? "failed"}</Badge>
                          {r.issues.map((i) => (
                            <div key={i} className="text-[11.5px] text-destructive">{i}</div>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.skipped ? "—" : `${r.passed ?? 0}/${r.testcases ?? 0}`}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.max_time_ms !== null ? `${r.max_time_ms.toFixed(0)} ms` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Modal>
      )}
    </>
  );
}

/** What the last validation found, wherever it ran. Provenance, not permission. */
export function ValidationNote({
  record,
  validatedHere,
}: {
  record: { at: string; verdict: string | null; passed: number | null; testcases: number; max_time_ms: number | null; time_limit_ms: number | null; ok: boolean } | null;
  validatedHere: boolean;
}) {
  if (!record) return null;
  const headroom =
    record.max_time_ms !== null && record.time_limit_ms
      ? `${record.max_time_ms.toFixed(0)} ms of ${record.time_limit_ms} ms`
      : record.max_time_ms !== null
        ? `${record.max_time_ms.toFixed(0)} ms`
        : null;
  // Tight against the limit is the case where another machine's result means least.
  const tight = record.max_time_ms !== null && record.time_limit_ms ? record.max_time_ms > record.time_limit_ms * 0.5 : false;

  return (
    <div className="text-[11.5px] leading-relaxed text-muted-foreground">
      {validatedHere ? "Validated here" : "Validated on the install that exported this"} ·{" "}
      <span className={record.ok ? "text-green-dark" : "text-destructive"}>{record.verdict ?? (record.ok ? "valid" : "failed")}</span>
      {record.passed !== null && ` · ${record.passed}/${record.testcases}`}
      {headroom && ` · slowest ${headroom}`}
      {!validatedHere && (
        <>
          {" — "}
          {tight
            ? "close to the limit, so this says little about a slower machine. Validate here before publishing."
            : "re-validate here before publishing; another machine's timings are not this one's."}
        </>
      )}
    </div>
  );
}
