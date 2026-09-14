"use client";

/**
 * The participant roster. Every repair is one menu away and every one asks for
 * a reason before it happens, which is what lands in the audit log.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { useContest } from "@/components/contest-provider";
import { Icon } from "@/components/icons";
import { PHASE_LABEL } from "@/components/shell";
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
  const router = useRouter();
  const [rows, setRows] = useState<P[] | null>(null);
  const [unsold, setUnsold] = useState<{ id: string; title: string; basePrice: number }[]>([]);
  const [filter, setFilter] = useState("");
  const [action, setAction] = useState<Action | null>(null);
  const [creating, setCreating] = useState(false);

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
        actions={
          <Button onClick={() => setCreating(true)}>
            <Icon.UserPlus size={14} /> Add a participant
          </Button>
        }
      />

      {!rows ? (
        <CardSkeleton lines={8} />
      ) : all.length === 0 ? (
        <Section padded={false}>
          <EmptyState
            icon={<Icon.Users />}
            title="Nobody has registered yet"
            body="They register themselves while registration is open."
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
                    <TableCell className="text-right font-medium num">{p.balance.toLocaleString()}</TableCell>
                    <TableCell className="hidden text-right num sm:table-cell">
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
      {creating && (
        <CreateParticipantDialog
          onClose={() => setCreating(false)}
          onDone={async () => {
            setCreating(false);
            await load();
          }}
        />
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

/** 2–32 of letters, digits, spaces, _ . - — the same rule the server enforces. */
const NAME_RULE = /^[A-Za-z0-9 _.-]{2,32}$/;

/** What the worker image ships. Only the language the editor opens in; never a restriction. */
const LANGUAGES = [
  { value: "cpp", label: "C++" },
  { value: "c", label: "C" },
  { value: "python", label: "Python 3" },
  { value: "pypy", label: "PyPy 3" },
  { value: "java", label: "Java 21" },
  { value: "javascript", label: "JavaScript" },
];

/** Readable and long enough to be worth using — this is written on paper, not typed from memory. */
function suggestPassword(): string {
  const words = ["amber", "cobalt", "dynamo", "ember", "falcon", "granite", "harbour", "indigo", "juniper", "kestrel", "lantern", "meridian", "nimbus", "onyx", "pivot", "quarry", "ridge", "summit", "tundra", "umbra", "vertex", "willow", "zenith"];
  const pick = () => words[Math.floor(Math.random() * words.length)];
  return `${pick()}-${pick()}-${Math.floor(Math.random() * 90 + 10)}`;
}

/**
 * Adding a participant by hand. Self-registration is the normal path; this is
 * the repair for when it did not work, so it says plainly what the account will
 * start with and warns if the contest has already moved past registration.
 */
function CreateParticipantDialog({ onClose, onDone }: { onClose: () => void; onDone: () => Promise<void> }) {
  const { state } = useContest();
  const { toast } = useToast();
  const [f, setF] = useState({ username: "", password: "", language: "cpp", reason: "" });
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const phase = state?.contest.phase ?? "registration";
  const late = phase !== "registration";
  const name = f.username.trim();
  const nameBad = name.length > 0 && !NAME_RULE.test(name);
  const signIn = name.replace(/\s+/g, "_").toLowerCase();
  const ready = NAME_RULE.test(name) && f.password.length >= 8 && f.reason.trim().length >= 3;

  async function create() {
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/admin/participants", {
        username: name,
        password: f.password,
        preferred_language: f.language,
        reason: f.reason.trim(),
      });
      toast({ title: `${name} added`, description: "Hand the password over in person — nothing is emailed.", tone: "success" });
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
      size="lg"
      title="Add a participant"
      description="For someone whose machine would not load the page, or who arrived late. They start with exactly what everyone else started with."
      footer={
        <>
          <span className="mr-auto hidden text-[12px] text-faint sm:block">Recorded in the audit log</span>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={create} loading={busy} disabled={!ready}>
            <Icon.UserPlus size={14} /> Add participant
          </Button>
        </>
      }
    >
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready && !busy) void create();
        }}
      >
        {late && (
          <Alert variant="warning">
            <Icon.Alert />
            <AlertTitle>The contest has already started</AlertTitle>
            <AlertDescription>
              It is in {PHASE_LABEL[phase] ?? phase}. They will join with a full starting balance and will have missed whatever has already run.
            </AlertDescription>
          </Alert>
        )}

        <fieldset className="space-y-4">
          <legend className="mb-3 text-[11px] font-semibold tracking-[0.07em] text-faint uppercase">Who they are</legend>

          <Field
            label="Display name"
            required
            help={
              name && !nameBad ? (
                <>
                  They will sign in as <span className="font-mono font-semibold text-foreground">{signIn}</span>
                </>
              ) : (
                "Shown on the leaderboard. Letters, digits, spaces, _ . - "
              )
            }
            error={nameBad ? "2–32 characters: letters, digits, spaces, and _ . - only" : undefined}
          >
            <Input
              value={f.username}
              onChange={(e) => setF({ ...f, username: e.target.value })}
              placeholder="e.g. Bala"
              autoFocus
              autoComplete="off"
              aria-invalid={nameBad || undefined}
              maxLength={32}
            />
          </Field>

          <Field label="Password" required hint={`${f.password.length}/8 minimum`} help="Tell them in person. An administrator can reset it later.">
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Input
                  type={show ? "text" : "password"}
                  value={f.password}
                  onChange={(e) => setF({ ...f, password: e.target.value })}
                  className={show ? "pr-9 font-mono" : "pr-9"}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? "Hide password" : "Show password"}
                  className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-sm p-1.5 text-faint transition-colors hover:bg-muted hover:text-foreground"
                >
                  {show ? <Icon.EyeOff size={14} /> : <Icon.Eye size={14} />}
                </button>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setF((v) => ({ ...v, password: suggestPassword() }));
                  setShow(true);
                  setCopied(false);
                }}
              >
                <Icon.Refresh size={14} /> Suggest
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Copy password"
                disabled={!f.password}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(f.password);
                    setCopied(true);
                  } catch {
                    setShow(true);
                  }
                }}
              >
                {copied ? <Icon.Check size={14} className="text-green" /> : <Icon.Copy size={14} />}
              </Button>
            </div>
          </Field>

          <Field label="Language to start in" help="Only the editor's default. They can switch language on any question, at any time.">
            <SimpleSelect className="w-full sm:w-56" size="default" value={f.language} onValueChange={(v) => setF({ ...f, language: v })} options={LANGUAGES} />
          </Field>
        </fieldset>

        <fieldset>
          <legend className="mb-3 text-[11px] font-semibold tracking-[0.07em] text-faint uppercase">Why</legend>
          <Field label="Reason" required help="Goes into the audit log with your name and the time.">
            <Input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="e.g. their machine could not reach the server" />
          </Field>
        </fieldset>

        {error && (
          <Alert variant="destructive">
            <Icon.Alert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </form>
    </Modal>
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
