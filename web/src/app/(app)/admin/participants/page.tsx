"use client";

/** People: participants with balances and ownership, repairs behind a menu, and staff accounts. */
import { useCallback, useEffect, useState } from "react";

import { useContest } from "@/components/contest-provider";
import { Icon } from "@/components/icons";
import { ReasonAction } from "@/components/reason-action";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Menu } from "@/components/ui/menu";
import { PageHeader } from "@/components/ui/page-header";
import { CardSkeleton } from "@/components/ui/skeleton";
import { Table, Td, Th } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/client";

type P = { id: string; name: string; username: string | null; balance: number; preferred_language: string | null; owned: number; disqualified: boolean; disqualified_reason: string | null };
type Action = { kind: "adjust" | "password" | "rename" | "disqualify" | "requalify" | "remove" | "assign"; p: P };

export default function ParticipantsPage() {
  const { state } = useContest();
  const { toast } = useToast();
  const [rows, setRows] = useState<P[] | null>(null);
  const [unsold, setUnsold] = useState<{ id: string; title: string; basePrice: number }[]>([]);
  const [filter, setFilter] = useState("");
  const [action, setAction] = useState<Action | null>(null);
  const load = useCallback(async () => {
    const [p, q] = await Promise.all([api.get<{ participants: P[] }>("/api/admin/participants"), api.get<{ questions: { id: string; title: string; basePrice: number; status: string }[] }>("/api/admin/questions")]);
    setRows(p.participants); setUnsold(q.questions.filter((x) => x.status === "unsold"));
  }, []);
  useEffect(() => { void load(); }, [load]);
  const phase = state?.contest.phase ?? "";
  const inPhase2 = ["auction1", "coding1", "auction2", "final"].includes(phase);
  const shown = (rows ?? []).filter((r) => !filter || r.name.toLowerCase().includes(filter.toLowerCase()));
  const ownNothing = inPhase2 ? (rows ?? []).filter((r) => r.owned === 0 && !r.disqualified).length : 0;

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader title="People" description={rows ? `${rows.length} participant${rows.length === 1 ? "" : "s"}. Repairs are behind each row's menu and every one needs a reason.` : undefined}
        actions={<Input className="w-56" placeholder="Filter by name" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter" />} />
      {ownNothing > 0 && <Alert tone="warning" title={`${ownNothing} participant${ownNothing === 1 ? " owns" : "s own"} nothing`}>They have money and nothing to solve. Assign an unsold question from the row menu, or accept it — the rules say it is a legitimate outcome.</Alert>}
      {!rows ? <CardSkeleton lines={8} /> : rows.length === 0 ? <EmptyState icon={<Icon.Users size={22} />} title="Nobody has registered yet" body="Participants register themselves at their machines while registration is open." /> : (
        <Card>
          <Table>
            <thead><tr><Th>Participant</Th><Th className="hidden sm:table-cell">Language</Th><Th className="text-right">Balance</Th><Th className="text-right">Owns</Th><Th>Status</Th><Th className="w-10"></Th></tr></thead>
            <tbody>{shown.map((p) => (
              <tr key={p.id} className={p.disqualified ? "opacity-60" : inPhase2 && p.owned === 0 ? "bg-amber-tint/60" : ""}>
                <Td><div className="font-semibold">{p.name}</div><div className="font-mono text-xs text-faint">{p.username}</div></Td>
                <Td className="hidden text-muted sm:table-cell">{p.preferred_language ?? "—"}</Td>
                <Td className="text-right tabular-nums">{p.balance.toLocaleString()}</Td><Td className="text-right tabular-nums">{p.owned}</Td>
                <Td>{p.disqualified ? <Badge tone="red" >disqualified</Badge> : <Badge tone="green">active</Badge>}</Td>
                <Td><Menu items={[
                  { label: "Adjust balance", onSelect: () => setAction({ kind: "adjust", p }) },
                  { label: "Reset password", onSelect: () => setAction({ kind: "password", p }) },
                  { label: "Rename", onSelect: () => setAction({ kind: "rename", p }) },
                  ...(inPhase2 && p.owned === 0 && unsold.length ? [{ label: "Assign an unsold question", onSelect: () => setAction({ kind: "assign", p }) }] : []),
                  p.disqualified ? { label: "Reverse disqualification", onSelect: () => setAction({ kind: "requalify", p }) } : { label: "Disqualify", danger: true, onSelect: () => setAction({ kind: "disqualify", p }) },
                  ...(phase === "registration" ? [{ label: "Remove account", danger: true, onSelect: () => setAction({ kind: "remove", p }) }] : []),
                ]} /></Td>
              </tr>
            ))}</tbody>
          </Table>
        </Card>
      )}
      <StaffForm />
      {action && <ActionDialog action={action} unsold={unsold} onClose={() => setAction(null)} onDone={async (msg) => { setAction(null); toast({ title: msg, tone: "success" }); await load(); }} />}
    </div>
  );
}

function ActionDialog({ action, unsold, onClose, onDone }: { action: Action; unsold: { id: string; title: string; basePrice: number }[]; onClose: () => void; onDone: (msg: string) => Promise<void> }) {
  const { p, kind } = action;
  const [v, setV] = useState<Record<string, string>>({ delta: "", password: "", name: p.name, qid: unsold[0]?.id ?? "", price: String(unsold[0]?.basePrice ?? 0) });
  const [reason, setReason] = useState(""); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const titles: Record<Action["kind"], string> = { adjust: `Adjust ${p.name}'s balance`, password: `Reset ${p.name}'s password`, rename: `Rename ${p.name}`, disqualify: `Disqualify ${p.name}?`, requalify: `Reverse ${p.name}'s disqualification`, remove: `Remove ${p.name}'s account?`, assign: `Assign a question to ${p.name}` };
  async function go() {
    setBusy(true); setError(null);
    try {
      const b = `/api/admin/participants/${p.id}`;
      if (kind === "adjust") await api.post(`${b}/adjust`, { reason, delta: Number(v.delta) });
      if (kind === "password") await api.post(`${b}/password`, { reason, password: v.password });
      if (kind === "rename") await api.post(`${b}/rename`, { reason, name: v.name });
      if (kind === "disqualify" || kind === "requalify") await api.post(`${b}/${kind}`, { reason });
      if (kind === "remove") await api.del(b, { reason });
      if (kind === "assign") await api.post(`/api/admin/questions/${v.qid}/assign`, { reason, participant_id: p.id, price: Number(v.price) });
      await onDone(`${titles[kind].replace("?", "")} — done`);
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }
  return (
    <Dialog open onClose={onClose} title={titles[kind]}>
      {kind === "adjust" && <Field label="Change (negative to deduct)"><Input type="number" value={v.delta} onChange={(e) => setV({ ...v, delta: e.target.value })} autoFocus /></Field>}
      {kind === "password" && <Field label="New password" hint="Tell them in person."><Input type="password" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} autoFocus /></Field>}
      {kind === "rename" && <Field label="New display name"><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} autoFocus /></Field>}
      {kind === "disqualify" && <Alert tone="warning">Removed from the leaderboard and cannot advance. Reversible; their work is kept.</Alert>}
      {kind === "remove" && <Alert tone="error">Deletes the account outright. Only during registration.</Alert>}
      {kind === "assign" && <><Field label="Unsold question"><Select value={v.qid} onChange={(e) => setV({ ...v, qid: e.target.value, price: String(unsold.find((u) => u.id === e.target.value)?.basePrice ?? 0) })}>{unsold.map((u) => <option key={u.id} value={u.id}>{u.title}</option>)}</Select></Field><Field label="Price to charge"><Input type="number" value={v.price} onChange={(e) => setV({ ...v, price: e.target.value })} /></Field></>}
      <div className="mt-3"><Field label="Reason (audit log)"><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></Field></div>
      {error && <div className="mb-3"><Alert tone="error">{error}</Alert></div>}
      <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant={kind === "disqualify" || kind === "remove" ? "danger" : "primary"} onClick={go} loading={busy} disabled={reason.trim().length < 3}>Confirm</Button></div>
    </Dialog>
  );
}

function StaffForm() {
  const { toast } = useToast();
  const [f, setF] = useState({ username: "", password: "", role: "evaluator", reason: "" });
  const [busy, setBusy] = useState(false);
  return (
    <Card>
      <CardHeader title="Staff accounts" description="Evaluators grade Phase 1 and see hack verdicts; they cannot change contest state or choose who advances. One account, one role." />
      <CardBody className="grid gap-3 md:grid-cols-[1fr_1fr_140px_1fr_auto]">
        <Input placeholder="display name" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} aria-label="Display name" />
        <Input type="password" placeholder="password (8+)" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} aria-label="Password" />
        <Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} aria-label="Role"><option value="evaluator">evaluator</option><option value="admin">admin</option></Select>
        <Input placeholder="reason" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} aria-label="Reason" />
        <Button loading={busy} onClick={async () => { setBusy(true); try { await api.post("/api/admin/staff", f); toast({ title: `Created ${f.role} '${f.username}'`, tone: "success" }); setF({ username: "", password: "", role: "evaluator", reason: "" }); } catch (err) { toast({ title: "Not created", description: errorMessage(err), tone: "error" }); } finally { setBusy(false); } }} disabled={!f.username || f.password.length < 8 || f.reason.length < 3} icon={<Icon.Users />}>Create</Button>
      </CardBody>
    </Card>
  );
}
