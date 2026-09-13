"use client";

/**
 * People. Participants and staff behind two tabs; every repair is one menu away
 * and every one asks for a reason before it happens.
 */
import { useCallback, useEffect, useState } from "react";

import { useContest } from "@/components/contest-provider";
import { Icon } from "@/components/icons";
import { LocalTime } from "@/components/local-time";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChoiceCards } from "@/components/ui/choice";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, FormGrid, SearchInput } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Menu } from "@/components/ui/menu";
import { Modal } from "@/components/ui/modal";
import { SimpleSelect } from "@/components/ui/select";
import { PageBody, PageHeader, Section, Toolbar } from "@/components/ui/page";
import { CardSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { Stat, StatRow } from "@/components/ui/stat";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
type Staff = { id: string; name: string; username: string | null; role: string; created_at: string };
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
      <PageHeader title="People" description="Participants compete; evaluators grade. One account, one role." />

      <Tabs defaultValue="participants">
        <TabsList variant="line" className="mb-5 w-full justify-start border-b">
          <TabsTrigger value="participants">Participants{all.length ? ` (${all.length})` : ""}</TabsTrigger>
          <TabsTrigger value="staff">Staff</TabsTrigger>
        </TabsList>

        <TabsContent value="participants">
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
        </TabsContent>

        <TabsContent value="staff">
          <StaffPanel />
        </TabsContent>
      </Tabs>

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
function StaffPanel() {
  const { state } = useContest();
  const [rows, setRows] = useState<Staff[] | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => setRows((await api.get<{ staff: Staff[] }>("/api/admin/staff")).staff), []);
  useEffect(() => {
    void load();
  }, [load]);

  const admins = (rows ?? []).filter((r) => r.role === "admin").length;

  return (
    <>
      <Section
        title="Staff accounts"
        description="Administrators run the contest; evaluators grade Phase 1 and can see hack verdicts. Neither competes, and neither can self-register."
        actions={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Icon.UserPlus size={14} /> Create a staff account
          </Button>
        }
        padded={false}
      >
        {!rows ? (
          <TableSkeleton rows={3} cols={4} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Icon.Shield />}
            title="No staff accounts yet"
            body="You are signed in as the bootstrap administrator. Create an evaluator before Phase 1 so grading is not one person's job."
            action={
              <Button size="sm" onClick={() => setCreating(true)}>
                <Icon.UserPlus size={14} /> Create a staff account
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="hidden sm:table-cell">Can do</TableHead>
                <TableHead className="hidden md:table-cell">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{r.name}</span>
                      {r.id === state?.viewer.id && <Badge variant="outline">you</Badge>}
                    </div>
                    <div className="font-mono text-[11.5px] text-faint">{r.username}</div>
                  </TableCell>
                  <TableCell>
                    {r.role === "admin" ? <Badge variant="navy">Administrator</Badge> : <Badge variant="info">Evaluator</Badge>}
                  </TableCell>
                  <TableCell className="hidden text-[12.5px] text-muted-foreground sm:table-cell">
                    {r.role === "admin" ? "Everything, including resets" : "Grade Phase 1 and review hacks"}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    <LocalTime iso={r.created_at} withDate />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>

      {rows && admins === 1 && (
        <Alert variant="warning" className="mt-4">
          <Icon.Alert />
          <AlertTitle>There is only one administrator</AlertTitle>
          <AlertDescription>
            If that account is locked out mid-contest nobody can advance the phase. Create a second one and keep the password off the machine.
          </AlertDescription>
        </Alert>
      )}

      {creating && (
        <CreateStaffDialog
          onClose={() => setCreating(false)}
          onDone={async () => {
            setCreating(false);
            await load();
          }}
        />
      )}
    </>
  );
}

function CreateStaffDialog({ onClose, onDone }: { onClose: () => void; onDone: () => Promise<void> }) {
  const { toast } = useToast();
  const [f, setF] = useState({ username: "", password: "", role: "evaluator", reason: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ready = f.username.length >= 2 && f.password.length >= 8 && f.reason.trim().length >= 3;

  async function create() {
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/admin/staff", f);
      toast({ title: `Created ${f.role} '${f.username}'`, description: "Tell them the password in person.", tone: "success" });
      await onDone();
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
      title="Create a staff account"
      description="They sign in with this name and password. Nothing is emailed — hand the password over in person."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={create} loading={busy} disabled={!ready}>
            Create account
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormGrid cols={2}>
          <Field label="Display name" required>
            <Input value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} placeholder="e.g. Anjali" autoFocus />
          </Field>
          <Field label="Password" hint="8+ characters" required>
            <Input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
          </Field>
        </FormGrid>
        <Field label="Role" required>
          <ChoiceCards
            cols={2}
            value={f.role}
            onChange={(role) => setF({ ...f, role })}
            name="Role"
            options={[
              { value: "evaluator", label: "Evaluator", icon: <Icon.Scale size={16} />, description: "Grades Phase 1 and reviews hack attempts. Cannot change contest state." },
              { value: "admin", label: "Administrator", icon: <Icon.Shield size={16} />, description: "Everything you can do, including advancing phases and resetting the contest." },
            ]}
          />
        </Field>
        <Field label="Reason" required help="Recorded in the audit log with your name and the time.">
          <Input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="e.g. second grader for Phase 1" />
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
