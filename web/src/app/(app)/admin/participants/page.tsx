"use client";

/**
 * The participant roster. Every repair is one menu away, and each one asks for
 * a reason before it happens — these are the actions that move coins, rename
 * somebody, take them out of the contest or reset the password they are sitting
 * in front of, so the log needs to say why, in someone's own words. Creating an
 * account does not ask: the log already says who was created, by whom, when.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { useContest } from "@/components/contest-provider";
import { Icon } from "@/components/icons";
import { Pagination, usePaged } from "@/components/ui/pagination";
import { PHASE_LABEL } from "@/components/shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, SearchInput } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Menu } from "@/components/ui/menu";
import { Modal } from "@/components/ui/modal";
import { SimpleCombobox } from "@/components/ui/combobox";
import { PageBody, PageHeader, Section, Toolbar } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/skeleton";
import { Stat, StatRow } from "@/components/ui/stat";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/client";
import { LANGUAGES, languageName } from "@/lib/languages";
import { cn } from "@/lib/utils";
import { ActionDialog, type Action, type ParticipantRow as P } from "@/components/admin/participant-actions";


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
  const paged = usePaged(shown, { param: "page" });
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
        <PageSkeleton stats={4} rows={8} cols={5} />
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
                They have money and nothing to solve. Assign an unsold question from the row menu, or leave it, losing every bid is a
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
{paged.from}–{paged.to} of {paged.total}
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
                {paged.rows.map((p) => (
                  <TableRow
                    key={p.id}
                    className={cn("cursor-pointer", p.disqualified && "opacity-60")}
                    onClick={() => router.push(`/admin/participants/${p.id}`)}
                  >
                    <TableCell>
                      <Link href={`/admin/participants/${p.id}`} className="font-semibold hover:underline" onClick={(e) => e.stopPropagation()}>{p.name}</Link>
                      <div className="font-mono text-[11.5px] text-faint">{p.username}</div>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">{p.preferred_language ? languageName(p.preferred_language) : "not chosen"}</TableCell>
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
                    <TableCell onClick={(e) => e.stopPropagation()}>
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
            <Pagination paged={paged} unit="people" />
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
  const [f, setF] = useState({ username: "", password: "", language: "cpp" });
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const phase = state?.contest.phase ?? "registration";
  const late = phase !== "registration";
  const name = f.username.trim();
  const nameBad = name.length > 0 && !NAME_RULE.test(name);
  const signIn = name.replace(/\s+/g, "_").toLowerCase();
  const ready = NAME_RULE.test(name) && f.password.length >= 8;

  async function create() {
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/admin/participants", {
        username: name,
        password: f.password,
        preferred_language: f.language,
        reason: `Created the participant ${name}.`,
      });
      toast({ title: `${name} added`, description: "Hand the password over in person. Nothing is emailed.", tone: "success" });
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
            <SimpleCombobox className="w-full sm:w-56" size="default" value={f.language} onValueChange={(v) => setF({ ...f, language: v })} options={LANGUAGES} />
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
