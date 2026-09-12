"use client";

/**
 * An administrator action that requires a reason before it is applied
 * (US-F9-00). The reason goes into the audit log with the change.
 */
import { useState } from "react";

import { errorMessage } from "@/lib/client";

import { Alert } from "./ui/alert";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { Field, Input, Textarea } from "./ui/input";

export function ReasonAction({
  label, title, description, confirmLabel, variant = "secondary", size = "sm", fields = [], disabled, onConfirm,
}: {
  label: string;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
  fields?: { name: string; label: string; type?: "text" | "number" | "password" | "textarea"; hint?: string; defaultValue?: string }[];
  disabled?: boolean;
  onConfirm: (reason: string, values: Record<string, string>) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [values, setValues] = useState<Record<string, string>>(Object.fromEntries(fields.map((f) => [f.name, f.defaultValue ?? ""])));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true); setError(null);
    try { await onConfirm(reason.trim(), values); setOpen(false); setReason(""); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }

  return (
    <>
      <Button variant={variant} size={size} disabled={disabled} onClick={() => setOpen(true)}>{label}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={title}>
        {description && <div className="mb-4 text-sm text-muted">{description}</div>}
        {fields.map((f) => (
          <Field key={f.name} label={f.label} hint={f.hint}>
            {f.type === "textarea"
              ? <Textarea rows={3} value={values[f.name]} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} />
              : <Input type={f.type ?? "text"} value={values[f.name]} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} />}
          </Field>
        ))}
        <Field label="Reason (recorded in the audit log)"><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus /></Field>
        {error && <div className="mb-3"><Alert tone="error">{error}</Alert></div>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant={variant === "danger" ? "danger" : "primary"} onClick={confirm} disabled={busy || reason.trim().length < 3}>{confirmLabel ?? label}</Button>
        </div>
      </Dialog>
    </>
  );
}
