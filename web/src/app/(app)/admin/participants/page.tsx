"use client";

/** Participants: balances, ownership, live repairs, staff accounts (US-B1-01, US-B4-03, US-B9-04, US-P6-03). */
import { useCallback, useEffect, useState } from "react";

import { useContest } from "@/components/contest-provider";
import { ReasonAction } from "@/components/reason-action";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { api, errorMessage } from "@/lib/client";

type P = { id: string; name: string; username: string | null; balance: number; preferred_language: string | null; owned: number; disqualified: boolean; disqualified_reason: string | null };

export default function ParticipantsPage() {
  const { state } = useContest();
  const [rows, setRows] = useState<P[]>([]);
  const [unsold, setUnsold] = useState<{ id: string; title: string; basePrice: number }[]>([]);
  const load = useCallback(async () => {
    const [p, q] = await Promise.all([api.get<{ participants: P[] }>("/api/admin/participants"), api.get<{ questions: { id: string; title: string; basePrice: number; status: string }[] }>("/api/admin/questions")]);
    setRows(p.participants); setUnsold(q.questions.filter((x) => x.status === "unsold"));
  }, []);
  useEffect(() => { void load(); }, [load]);
  const inPhase2 = ["auction1", "coding1", "auction2", "final"].includes(state?.contest.phase ?? "");
  const ownNothing = inPhase2 ? rows.filter((r) => r.owned === 0 && !r.disqualified) : [];

  return (
    <div className="space-y-6">
      {ownNothing.length > 0 && <Alert tone="warning" title={`${ownNothing.length} participant(s) own nothing`}>They have money and nothing to do. Assign an unsold question below, or accept it — the rules say it is a legitimate outcome.</Alert>}
      <Card>
        <CardHeader title={`Participants (${rows.length})`} />
        <Table>
          <thead><tr><Th>Name</Th><Th>Language</Th><Th>Balance</Th><Th>Owns</Th><Th>Status</Th><Th>Actions</Th></tr></thead>
          <tbody>{rows.map((p) => (
            <tr key={p.id} className={p.disqualified ? "opacity-60" : inPhase2 && p.owned === 0 ? "bg-amber-tint" : ""}>
              <Td className="font-semibold">{p.name}</Td><Td className="text-muted">{p.preferred_language ?? "—"}</Td>
              <Td className="tabular-nums">{p.balance}</Td><Td className="tabular-nums">{p.owned}</Td>
              <Td>{p.disqualified ? <Badge tone="red" >disqualified</Badge> : <Badge tone="green">active</Badge>}</Td>
              <Td><div className="flex flex-wrap gap-1">
                <ReasonAction label="Adjust balance" title={`Adjust ${p.name}'s balance`} fields={[{ name: "delta", label: "Change (negative to deduct)", type: "number" }]} onConfirm={async (reason, v) => { await api.post(`/api/admin/participants/${p.id}/adjust`, { reason, delta: Number(v.delta) }); await load(); }} />
                <ReasonAction label="Reset password" title={`Reset ${p.name}'s password`} fields={[{ name: "password", label: "New password", type: "password" }]} onConfirm={async (reason, v) => { await api.post(`/api/admin/participants/${p.id}/password`, { reason, password: v.password }); }} />
                <ReasonAction label="Rename" title={`Rename ${p.name}`} fields={[{ name: "name", label: "New display name", defaultValue: p.name }]} onConfirm={async (reason, v) => { await api.post(`/api/admin/participants/${p.id}/rename`, { reason, name: v.name }); await load(); }} />
                {inPhase2 && p.owned === 0 && unsold.length > 0 && <AssignAction p={p} unsold={unsold} onDone={load} />}
                {p.disqualified
                  ? <ReasonAction label="Requalify" title={`Reverse ${p.name}'s disqualification`} onConfirm={async (reason) => { await api.post(`/api/admin/participants/${p.id}/requalify`, { reason }); await load(); }} />
                  : <ReasonAction label="Disqualify" variant="danger" title={`Disqualify ${p.name}?`} description="Removed from the leaderboard and cannot advance. Reversible. Their work is kept." onConfirm={async (reason) => { await api.post(`/api/admin/participants/${p.id}/disqualify`, { reason }); await load(); }} />}
                {state?.contest.phase === "registration" && <ReasonAction label="Remove" variant="danger" title={`Remove ${p.name}'s account?`} onConfirm={async (reason) => { await api.del(`/api/admin/participants/${p.id}`, { reason }); await load(); }} />}
              </div></Td>
            </tr>
          ))}</tbody>
        </Table>
      </Card>
      <StaffForm />
    </div>
  );
}

function AssignAction({ p, unsold, onDone }: { p: P; unsold: { id: string; title: string; basePrice: number }[]; onDone: () => void }) {
  const [qid, setQid] = useState(unsold[0]?.id ?? "");
  return (
    <span className="inline-flex items-center gap-1">
      <Select className="h-8 w-40 text-xs" value={qid} onChange={(e) => setQid(e.target.value)}>{unsold.map((u) => <option key={u.id} value={u.id}>{u.title}</option>)}</Select>
      <ReasonAction label="Assign" title={`Assign ${qid} to ${p.name}`} fields={[{ name: "price", label: "Price to charge", type: "number", defaultValue: String(unsold.find((u) => u.id === qid)?.basePrice ?? 0) }]}
        onConfirm={async (reason, v) => { await api.post(`/api/admin/questions/${qid}/assign`, { reason, participant_id: p.id, price: Number(v.price) }); onDone(); }} />
    </span>
  );
}

function StaffForm() {
  const [f, setF] = useState({ username: "", password: "", role: "evaluator", reason: "" });
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <Card>
      <CardHeader title="Create an evaluator or administrator" />
      <CardBody className="grid gap-3 md:grid-cols-5">
        <Input placeholder="display name" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} />
        <Input type="password" placeholder="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        <Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="evaluator">evaluator</option><option value="admin">admin</option></Select>
        <Input placeholder="reason" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
        <Button onClick={async () => { try { await api.post("/api/admin/staff", f); setMsg(`Created ${f.role} '${f.username}'.`); setF({ username: "", password: "", role: "evaluator", reason: "" }); } catch (err) { setMsg(errorMessage(err)); } }} disabled={!f.username || f.password.length < 8 || f.reason.length < 3}>Create</Button>
        {msg && <div className="col-span-full"><Alert tone={msg.startsWith("Created") ? "success" : "error"}>{msg}</Alert></div>}
        <p className="col-span-full text-xs text-faint">One account, one role. Evaluators grade Phase 1 and can see hack verdicts; they cannot change contest state or select who advances.</p>
      </CardBody>
    </Card>
  );
}

export { Field };
