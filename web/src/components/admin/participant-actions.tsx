"use client";

/**
 * The things an organiser can do to one participant, each behind a dialog
 * that asks for a reason: every one of them is audited.
 */
import { useState } from "react";

import { Icon } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SimpleCombobox } from "@/components/ui/combobox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PasswordInput } from "@/components/ui/password-input";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage } from "@/lib/client";

export type ParticipantRow = {
  id: string;
  name: string;
  username: string | null;
  balance: number;
  preferred_language: string | null;
  owned: number;
  disqualified: boolean;
  disqualified_reason: string | null;
};
export type ActionKind = "adjust" | "password" | "rename" | "disqualify" | "requalify" | "remove" | "assign";
export type Action = { kind: ActionKind; p: ParticipantRow };
export type UnsoldQuestion = { id: string; title: string; basePrice: number };

export function ActionDialog({
  action,
  unsold,
  onClose,
  onDone,
}: {
  action: Action;
  unsold: UnsoldQuestion[];
  onClose: () => void;
  onDone: (msg: string) => Promise<void>;
}) {
  const { p, kind } = action;
  const [v, setV] = useState<Record<string, string>>({
    delta: "",
    password: "",
    name: p.name,
    qid: unsold[0]?.id ?? "",
    price: String(unsold[0]?.basePrice ?? 0),
  });
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const titles: Record<Action["kind"], string> = {
    adjust: `Adjust ${p.name}'s balance`,
    password: `Reset ${p.name}'s password`,
    rename: `Rename ${p.name}`,
    disqualify: `Disqualify ${p.name}?`,
    requalify: `Reverse ${p.name}'s disqualification`,
    remove: `Remove ${p.name}'s account?`,
    assign: `Assign a question to ${p.name}`,
  };
  const destructive = kind === "disqualify" || kind === "remove";

  async function go() {
    setBusy(true);
    setError(null);
    try {
      const b = `/api/admin/participants/${p.id}`;
      if (kind === "adjust") await api.post(`${b}/adjust`, { reason, delta: Number(v.delta) });
      if (kind === "password") await api.post(`${b}/password`, { reason, password: v.password });
      if (kind === "rename") await api.post(`${b}/rename`, { reason, name: v.name });
      if (kind === "disqualify" || kind === "requalify") await api.post(`${b}/${kind}`, { reason });
      if (kind === "remove") await api.del(b, { reason });
      if (kind === "assign") await api.post(`/api/admin/questions/${v.qid}/assign`, { reason, participant_id: p.id, price: Number(v.price) });
      await onDone(titles[kind].replace("?", "") + ", done");
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
      title={titles[kind]}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={destructive ? "destructive" : "default"} onClick={go} loading={busy} disabled={reason.trim().length < 3}>
            Confirm
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {kind === "adjust" && (
          <Field label="Change" help="Negative to deduct. The participant is notified.">
            <Input type="number" value={v.delta} onChange={(e) => setV({ ...v, delta: e.target.value })} autoFocus placeholder="e.g. -50" />
          </Field>
        )}
        {kind === "password" && (
          <Field label="New password" help="Tell them in person; nothing is emailed.">
            <PasswordInput value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} autoFocus />
          </Field>
        )}
        {kind === "rename" && (
          <Field label="New display name">
            <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} autoFocus />
          </Field>
        )}
        {kind === "disqualify" && (
          <Alert variant="warning">
            <Icon.Alert />
            <AlertDescription>They leave the leaderboard and cannot advance. Reversible, and their work is kept either way.</AlertDescription>
          </Alert>
        )}
        {kind === "remove" && (
          <Alert variant="destructive">
            <Icon.Alert />
            <AlertDescription>This deletes the account outright. Only possible during registration, afterwards, disqualify instead.</AlertDescription>
          </Alert>
        )}
        {kind === "assign" && (
          <>
            <Field label="Unsold question">
              <SimpleCombobox
                className="w-full"
                size="default"
                value={v.qid}
                onValueChange={(qid: string) => setV({ ...v, qid, price: String(unsold.find((u) => u.id === qid)?.basePrice ?? 0) })}
                options={unsold.map((u) => ({ value: u.id, label: u.title }))}
              />
            </Field>
            <Field label="Price to charge" help="Deducted from their balance, as if they had won it.">
              <Input type="number" value={v.price} onChange={(e) => setV({ ...v, price: e.target.value })} />
            </Field>
          </>
        )}
        <Field label="Reason" help="Recorded in the audit log with your name and the time.">
          <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
    </Modal>
  );
}

/**
 * Staff are a different kind of account from participants: they are created,
 * not registered, and they never appear in the participant list. This is the
 * whole roster of people who run the contest.
 */
