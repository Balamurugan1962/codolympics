"use client";

/**
 * People. Participants and staff behind two tabs; every repair is one menu
 * away and every one asks for a reason before it happens.
 */
import { useCallback, useEffect, useState } from "react";

import { useContest } from "@/components/contest-provider";
import { Icon } from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { FormGrid } from "@/components/ui/form";
import { Field, Input, SearchInput, Select, Textarea } from "@/components/ui/input";
import { Menu } from "@/components/ui/menu";
import { PageBody, PageHeader, Section, Toolbar } from "@/components/ui/page";
import { CardSkeleton } from "@/components/ui/skeleton";
import { Stat, StatRow } from "@/components/ui/stat";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/client";

type P = { id: string; name: string; username: string | null; balance: number; preferred_language: string | null; owned: number; disqualified: boolean; disqualified_reason: string | null };
type Action = { kind: "adjust" | "password" | "rename" | "disqualify" | "requalify" | "remove" | "assign"; p: P };

export default function PeoplePage() {
  const { state } = useContest();
  const { toast } = useToast();
  const [tab, setTab] = useState<"participants" | "staff">("participants");
  const [rows, setRows] = useState<P[] | null>(null);
  const [unsold, setUnsold] = useState<{ id: string; title: string; basePrice: number }[]>([]);
  const [filter, setFilter] = useState("");
  const [action, setAction] = useState<Action | null>(null);

  const load = useCallback(async () => {
    const [p, q] = await Promise.all([
      api.get<{ participants: P[] }>("/api/admin/participants"),
      api.get<{ questions: { id: string; title: string; basePrice: number; status: string }[] }>("/api/admin/questions"),
    ]);
    setRows(p.participants); setUnsold(q.questions.filter((x) => x.status === "unsold"));
  }, []);
  useEffect(() => { void load(); }, [load]);

  const phase = state?.contest.phase ?? "";
  const inPhase2 = ["auction1", "coding1", "auction2", "final"].includes(phase);
  const all = rows ?? [];
  const shown = all.filter((r) => !filter || r.name.toLowerCase().includes(filter.toLowerCase()));
  const ownNothing = inPhase2 ? all.filter((r) => r.owned === 0 && !r.disqualified).length : 0;
  const money = all.reduce((s, r) => s + r.balance, 0);

  return (
    <PageBody width="wide">
      <PageHeader title="People" description="Participants compete; evaluators grade. One account, one role." />

      <div className="mb-4"><Tabs value={tab} onChange={setTab} tabs={[{ value: "participants", label: `Participants${all.length ? ` (${all.length})` : ""}` }, { value: "staff", label: "Staff" }]} /></div>

      {tab === "staff" ? <StaffPanel /> : !rows ? <CardSkeleton lines={8} /> : all.length === 0 ? (
        <Section padded={false}>
          <EmptyState icon={<Icon.Users size={20} />} title="Nobody has registered yet" body="Participants register themselves at their machines while registration is open." />
        </Section>
      ) : (
        <div className="space-y-4">
          <StatRow cols={4}>
            <Stat label="Registered" value={all.length} icon={<Icon.Users size={13} />} hint={`${all.filter((r) => r.disqualified).length} disqualified`} />
            <Stat label="Own nothing" value={ownNothing} tone={ownNothing ? "amber" : "ink"} icon={<Icon.Alert size={13} />} hint={inPhase2 ? "have money, nothing to solve" : "only meaningful after an auction"} />
            <Stat label="Questions owned" value={all.reduce((s, r) => s + r.owned, 0)} icon={<Icon.Code size={13} />} />
            <Stat label="Money unspent" value={money.toLocaleString()} icon={<Icon.Coins size={13} />} hint="across everyone" />
          </StatRow>

          {ownNothing > 0 && (
            <Alert tone="warning" title={`${ownNothing} participant${ownNothing === 1 ? " owns" : "s own"} nothing`}>
              They have money and nothing to solve. Assign an unsold question from the row menu, or leave it — losing every bid is a legitimate outcome and the rules say so.
            </Alert>
          )}

          <Section padded={false}>
            <Toolbar><SearchInput className="w-64" placeholder="Filter by name" value={filter} onChange={(e) => setFilter(e.target.value)} /></Toolbar>
            <Table>
              <thead>
                <tr>
                  <Th>Participant</Th>
                  <Th className="hidden sm:table-cell">Language</Th>
                  <Th align="right">Balance</Th>
                  <Th align="right" className="hidden sm:table-cell">Owns</Th>
                  <Th>Status</Th>
                  <Th className="w-12"><span className="sr-only">Actions</span></Th>
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => (
                  <Tr key={p.id} className={p.disqualified ? "opacity-60" : ""}>
                    <Td>
                      <div className="font-semibold">{p.name}</div>
                      <div className="font-mono text-[11.5px] text-faint">{p.username}</div>
                    </Td>
                    <Td className="hidden text-muted sm:table-cell">{p.preferred_language ?? "—"}</Td>
                    <Td align="right" className="font-medium">{p.balance.toLocaleString()}</Td>
                    <Td align="right" className="hidden sm:table-cell">{p.owned > 0 ? p.owned : <span className="text-faint">0</span>}</Td>
                    <Td>{p.disqualified ? <StatusDot tone="red">Disqualified</StatusDot> : inPhase2 && p.owned === 0 ? <StatusDot tone="amber">Owns nothing</StatusDot> : <StatusDot tone="green">Active</StatusDot>}</Td>
                    <Td>
                      <Menu items={[
                        { label: "Adjust balance", onSelect: () => setAction({ kind: "adjust", p }) },
                        { label: "Reset password", onSelect: () => setAction({ kind: "password", p }) },
                        { label: "Rename", onSelect: () => setAction({ kind: "rename", p }) },
                        ...(inPhase2 && p.owned === 0 && unsold.length ? [{ label: "Assign an unsold question", onSelect: () => setAction({ kind: "assign", p }) }] : []),
                        p.disqualified
                          ? { label: "Reverse disqualification", onSelect: () => setAction({ kind: "requalify", p }) }
                          : { label: "Disqualify", danger: true, onSelect: () => setAction({ kind: "disqualify", p }) },
                        ...(phase === "registration" ? [{ label: "Remove account", danger: true, onSelect: () => setAction({ kind: "remove", p }) }] : []),
                      ]} />
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            {shown.length === 0 && <EmptyState compact title="Nobody matches that filter" />}
          </Section>
        </div>
      )}

      {action && <ActionDialog action={action} unsold={unsold} onClose={() => setAction(null)} onDone={async (msg) => { setAction(null); toast({ title: msg, tone: "success" }); await load(); }} />}
    </PageBody>
  );
}

function ActionDialog({ action, unsold, onClose, onDone }: { action: Action; unsold: { id: string; title: string; basePrice: number }[]; onClose: () => void; onDone: (msg: string) => Promise<void> }) {
  const { p, kind } = action;
  const [v, setV] = useState<Record<string, string>>({ delta: "", password: "", name: p.name, qid: unsold[0]?.id ?? "", price: String(unsold[0]?.basePrice ?? 0) });
  const [reason, setReason] = useState(""); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const titles: Record<Action["kind"], string> = {
    adjust: `Adjust ${p.name}'s balance`, password: `Reset ${p.name}'s password`, rename: `Rename ${p.name}`,
    disqualify: `Disqualify ${p.name}?`, requalify: `Reverse ${p.name}'s disqualification`, remove: `Remove ${p.name}'s account?`, assign: `Assign a question to ${p.name}`,
  };

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
      await onDone(titles[kind].replace("?", "") + " — done");
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }

  return (
    <Dialog open onClose={onClose} title={titles[kind]}>
      <div className="space-y-4">
        {kind === "adjust" && <Field label="Change" help="Negative to deduct. The participant is notified."><Input type="number" value={v.delta} onChange={(e) => setV({ ...v, delta: e.target.value })} autoFocus placeholder="e.g. -50" /></Field>}
        {kind === "password" && <Field label="New password" help="Tell them in person; nothing is emailed."><Input type="password" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} autoFocus /></Field>}
        {kind === "rename" && <Field label="New display name"><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} autoFocus /></Field>}
        {kind === "disqualify" && <Alert tone="warning">They leave the leaderboard and cannot advance. Reversible, and their work is kept either way.</Alert>}
        {kind === "remove" && <Alert tone="error">This deletes the account outright. Only possible during registration — afterwards, disqualify instead.</Alert>}
        {kind === "assign" && (
          <>
            <Field label="Unsold question">
              <Select value={v.qid} onChange={(e) => setV({ ...v, qid: e.target.value, price: String(unsold.find((u) => u.id === e.target.value)?.basePrice ?? 0) })}>
                {unsold.map((u) => <option key={u.id} value={u.id}>{u.title}</option>)}
              </Select>
            </Field>
            <Field label="Price to charge" help="Deducted from their balance, as if they had won it."><Input type="number" value={v.price} onChange={(e) => setV({ ...v, price: e.target.value })} /></Field>
          </>
        )}
        <Field label="Reason" help="Recorded in the audit log with your name and the time."><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        {error && <Alert tone="error">{error}</Alert>}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant={kind === "disqualify" || kind === "remove" ? "danger" : "primary"} onClick={go} loading={busy} disabled={reason.trim().length < 3}>Confirm</Button>
      </div>
    </Dialog>
  );
}

function StaffPanel() {
  const { toast } = useToast();
  const [f, setF] = useState({ username: "", password: "", role: "evaluator", reason: "" });
  const [busy, setBusy] = useState(false);

  return (
    <Section
      title="Create a staff account"
      description="Evaluators grade Phase 1 and can see hack verdicts. They cannot change contest state, and they cannot choose who advances."
      footer={
        <Button loading={busy} icon={<Icon.Plus size={14} />} disabled={!f.username || f.password.length < 8 || f.reason.trim().length < 3}
          onClick={async () => {
            setBusy(true);
            try { await api.post("/api/admin/staff", f); toast({ title: `Created ${f.role} '${f.username}'`, tone: "success" }); setF({ username: "", password: "", role: "evaluator", reason: "" }); }
            catch (err) { toast({ title: "Not created", description: errorMessage(err), tone: "error" }); } finally { setBusy(false); }
          }}>Create account</Button>
      }
    >
      <FormGrid cols={2}>
        <Field label="Display name"><Input value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} placeholder="e.g. Anjali" /></Field>
        <Field label="Password" hint="8+ characters"><Input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        <Field label="Role" help="An evaluator cannot also compete."><Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="evaluator">Evaluator</option><option value="admin">Administrator</option></Select></Field>
        <Field label="Reason"><Input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="e.g. second grader for Phase 1" /></Field>
      </FormGrid>
      <div className="mt-4"><Badge tone="grey">Evaluators do not self-register — accounts are created here</Badge></div>
    </Section>
  );
}
