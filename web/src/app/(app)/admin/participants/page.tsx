"use client";

/**
 * The participant roster. Every repair is one menu away and every one asks for
 * a reason before it happens, which is what lands in the audit log.
 */
import { useCallback, useEffect, useState } from "react";

import { useContest } from "@/components/contest-provider";
import { Icon } from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, SearchInput } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Menu } from "@/components/ui/menu";
import { Modal } from "@/components/ui/modal";
import { SimpleSelect } from "@/components/ui/select";
import { PageBody, PageHeader, Section, Toolbar } from "@/components/ui/page";
import { CardSkeleton } from "@/components/ui/skeleton";
import { Stat, StatRow } from "@/components/ui/stat";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/client";

type P = {
  id: string;
  name: string;
  username: string | null;
  balance: number;
  preferred_language: string | null;
  owned: number;
  disqualified: boolean;
  disqualified_reason: string | null;
};
type Action = { kind: "adjust" | "password" | "rename" | "disqualify" | "requalify" | "remove" | "assign"; p: P };

export default function PeoplePage() {
  const { state } = useContest();
  const { toast } = useToast();
  const [rows, setRows] = useState<P[] | null>(null);
  const [unsold, setUnsold] = useState<{ id: string; title: string; basePrice: number }[]>([]);
  const [filter, setFilter] = useState("");
  const [action, setAction] = useState<Action | null>(null);

  const load = useCallback(async () => {
    const [p, q] = await Promise.all([
      api.get<{ participants: P[] }>("/api/admin/participants"),
      api.get<{ questions: { id: string; title: string; basePrice: number; status: string }[] }>("/api/admin/questions"),
    ]);
    setRows(p.participants);
    setUnsold(q.questions.filter((x) => x.status === "unsold"));
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const phase = state?.contest.phase ?? "";
  const inPhase2 = ["auction1", "coding1", "auction2", "final"].includes(phase);
  const all = rows ?? [];
  const shown = all.filter((r) => !filter || r.name.toLowerCase().includes(filter.toLowerCase()) || (r.username ?? "").toLowerCase().includes(filter.toLowerCase()));
  const ownNothing = inPhase2 ? all.filter((r) => r.owned === 0 && !r.disqualified).length : 0;
  const money = all.reduce((s, r) => s + r.balance, 0);

  return (
    <PageBody width="wide">
      <PageHeader
        title="Participants"
        description="Everyone competing. They register themselves; staff accounts live under Staff."
      />

      {!rows ? (
        <CardSkeleton lines={8} />
      ) : all.length === 0 ? (
        <Section padded={false}>
          <EmptyState
            icon={<Icon.Users />}
            title="Nobody has registered yet"
            body="Participants register themselves at their machines while registration is open."
          />
        </Section>
      ) : (
        <div className="space-y-5">
          <StatRow cols={4}>
            <Stat label="Registered" value={all.length} icon={<Icon.Users size={13} />} hint={`${all.filter((r) => r.disqualified).length} disqualified`} />
            <Stat
              label="Own nothing"
              value={ownNothing}
              tone={ownNothing ? "warning" : "default"}
              icon={<Icon.Alert size={13} />}
              hint={inPhase2 ? "have money, nothing to solve" : "only meaningful after an auction"}
            />
            <Stat label="Questions owned" value={all.reduce((s, r) => s + r.owned, 0)} icon={<Icon.Code size={13} />} />
            <Stat label="Money unspent" value={money.toLocaleString()} icon={<Icon.Coins size={13} />} hint="across everyone" />
          </StatRow>

          {ownNothing > 0 && (
            <Alert variant="warning">
              <Icon.Alert />
              <AlertTitle>
                {ownNothing} participant{ownNothing === 1 ? " owns" : "s own"} nothing
              </AlertTitle>
              <AlertDescription>
                They have money and nothing to solve. Assign an unsold question from the row menu, or leave it — losing every bid is a
                legitimate outcome and the rules say so.
              </AlertDescription>
            </Alert>
          )}

          <Section padded={false}>
            <Toolbar>
              <SearchInput
                className="w-full sm:w-72"
                placeholder="Filter by name or username"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                onClear={() => setFilter("")}
              />
              <span className="ml-auto text-[12px] text-muted-foreground">
                {shown.length} of {all.length}
              </span>
            </Toolbar>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Participant</TableHead>
                  <TableHead className="hidden sm:table-cell">Language</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Owns</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((p) => (
                  <TableRow key={p.id} className={p.disqualified ? "opacity-60" : ""}>
                    <TableCell>
                      <div className="font-semibold">{p.name}</div>
                      <div className="font-mono text-[11.5px] text-faint">{p.username}</div>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">{p.preferred_language ?? "—"}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{p.balance.toLocaleString()}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">
                      {p.owned > 0 ? p.owned : <span className="text-faint">0</span>}
                    </TableCell>
                    <TableCell>
                      {p.disqualified ? (
                        <StatusDot tone="destructive">Disqualified</StatusDot>
                      ) : inPhase2 && p.owned === 0 ? (
                        <StatusDot tone="warning">Owns nothing</StatusDot>
                      ) : (
                        <StatusDot tone="success">Active</StatusDot>
                      )}
                    </TableCell>
                    <TableCell>
                      <Menu
                        label={`Actions for ${p.name}`}
                        items={[
                          { label: "Adjust balance", icon: <Icon.Coins size={15} />, onSelect: () => setAction({ kind: "adjust", p }) },
                          { label: "Reset password", icon: <Icon.Key size={15} />, onSelect: () => setAction({ kind: "password", p }) },
                          { label: "Rename", icon: <Icon.Edit size={15} />, onSelect: () => setAction({ kind: "rename", p }) },
                          ...(inPhase2 && p.owned === 0 && unsold.length
                            ? [{ label: "Assign an unsold question", icon: <Icon.Gavel size={15} />, onSelect: () => setAction({ kind: "assign", p }) }]
                            : []),
                          { separator: true as const },
                          p.disqualified
                            ? { label: "Reverse disqualification", icon: <Icon.Undo size={15} />, onSelect: () => setAction({ kind: "requalify", p }) }
                            : { label: "Disqualify", icon: <Icon.Ban size={15} />, danger: true, onSelect: () => setAction({ kind: "disqualify", p }) },
                          ...(phase === "registration"
                            ? [{ label: "Remove account", icon: <Icon.Trash size={15} />, danger: true, onSelect: () => setAction({ kind: "remove", p }) }]
                            : []),
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {shown.length === 0 && <EmptyState compact icon={<Icon.Search />} title="Nobody matches that filter" />}
          </Section>
        </div>
      )}
      {action && (
        <ActionDialog
          action={action}
          unsold={unsold}
          onClose={() => setAction(null)}
          onDone={async (msg) => {
            setAction(null);
            toast({ title: msg, tone: "success" });
            await load();
          }}
        />
      )}
    </PageBody>
  );
}

function ActionDialog({
  action,
  unsold,
  onClose,
  onDone,
}: {
  action: Action;
  unsold: { id: string; title: string; basePrice: number }[];
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
      await onDone(titles[kind].replace("?", "") + " — done");
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
            <Input type="password" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} autoFocus />
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
            <AlertDescription>This deletes the account outright. Only possible during registration — afterwards, disqualify instead.</AlertDescription>
          </Alert>
        )}
        {kind === "assign" && (
          <>
            <Field label="Unsold question">
              <SimpleSelect
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
