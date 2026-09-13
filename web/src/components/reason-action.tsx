"use client";

/**
 * An administrator action that requires a reason before it is applied
 * (US-F9-00). The reason goes into the audit log in the same transaction as
 * the change, so the log can never disagree with what happened.
 *
 * `defaultReason` prefills the box with the reason that is true nine times out
 * of ten, selected so the first keystroke replaces it. Typing "advancing the
 * phase" forty times is how a required field turns into "asdf", which is worse
 * for the log than a sensible default the author can overwrite.
 */
import { useState } from "react";

import { errorMessage } from "@/lib/client";

import { Alert, AlertDescription } from "./ui/alert";
import { Button } from "./ui/button";
import { Field } from "./ui/field";
import { Input } from "./ui/input";
import { Modal } from "./ui/modal";
import { Textarea } from "./ui/textarea";

type Variant = React.ComponentProps<typeof Button>["variant"];

export function ReasonAction({
  label,
  title,
  description,
  confirmLabel,
  defaultReason = "",
  variant = "outline",
  size = "sm",
  icon,
  fields = [],
  disabled,
  onConfirm,
}: {
  label: string;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  defaultReason?: string;
  variant?: Variant;
  size?: "xs" | "sm" | "default";
  icon?: React.ReactNode;
  fields?: { name: string; label: string; type?: "text" | "number" | "password" | "textarea"; hint?: string; help?: string; defaultValue?: string }[];
  disabled?: boolean;
  onConfirm: (reason: string, values: Record<string, string>) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(defaultReason);
  const [values, setValues] = useState<Record<string, string>>(Object.fromEntries(fields.map((f) => [f.name, f.defaultValue ?? ""])));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm(reason.trim(), values);
      setOpen(false);
      setReason(defaultReason);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        disabled={disabled}
        onClick={() => {
          setReason(defaultReason);
          setError(null);
          setOpen(true);
        }}
      >
        {icon}
        {label}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        description={description}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={variant === "destructive" ? "destructive" : "default"}
              onClick={confirm}
              loading={busy}
              disabled={reason.trim().length < 3}
            >
              {confirmLabel ?? label}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {fields.map((f) => (
            <Field key={f.name} label={f.label} hint={f.hint} help={f.help}>
              {f.type === "textarea" ? (
                <Textarea rows={3} value={values[f.name]} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} />
              ) : (
                <Input type={f.type ?? "text"} value={values[f.name]} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} />
              )}
            </Field>
          ))}
          <Field
            label="Reason"
            hint="recorded in the audit log"
            help={defaultReason ? "Edit it if something else happened. It is selected, so typing replaces it." : "At least three characters. Write what a colleague would need to understand this later."}
          >
            <Textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              autoFocus
              onFocus={(e) => defaultReason && e.currentTarget.select()}
            />
          </Field>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      </Modal>
    </>
  );
}
