"use client";

/**
 * Staff: the people who run the contest rather than compete in it.
 *
 * A separate page from Participants on purpose. They are different kinds of
 * account — staff are created by an administrator and never self-register, they
 * have no balance, no questions and no score — and mixing them into the
 * participant roster made both lists harder to read.
 */
import { useCallback, useEffect, useState } from "react";

import { useContest } from "@/components/contest-provider";
import { Icon } from "@/components/icons";
import { LocalTime } from "@/components/local-time";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChoiceCards } from "@/components/ui/choice";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PageBody, PageHeader, Section } from "@/components/ui/page";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api, errorMessage } from "@/lib/client";
import { cn } from "@/lib/utils";

type Staff = { id: string; name: string; username: string | null; role: string; created_at: string };

export default function StaffPage() {
  return (
    <PageBody width="wide">
      <PageHeader
        title="Staff"
        description="Administrators run the contest; evaluators grade Phase 1 and review hack attempts. Neither competes, and neither can create their own account."
      />
      <StaffPanel />
    </PageBody>
  );
}

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
        title={
          <span className="flex items-center gap-1.5">
            Staff accounts
            {/* Advice, not an alarm: a banner that cannot be dismissed is noise
                on a page you visit every day. */}
            {rows && admins === 1 && <Hint>{SINGLE_ADMIN}</Hint>}
          </span>
        }
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

const SINGLE_ADMIN =
  "There is only one administrator. If that account is locked out mid-contest nobody can advance the phase — create a second one and keep the password off the machine.";

/** A quiet info icon that says more on hover. For advice worth having and not worth shouting. */
function Hint({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label="More information" className="text-faint transition-colors hover:text-muted-foreground">
          <Icon.Info size={14} />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-72 text-[12px] leading-relaxed">{children}</TooltipContent>
    </Tooltip>
  );
}

/** 2–32 of letters, digits, spaces, _ . - — the same rule the server enforces. */
const NAME_RULE = /^[A-Za-z0-9 _.-]{2,32}$/;

const ROLES = [
  {
    value: "evaluator",
    label: "Evaluator",
    icon: <Icon.Scale size={16} />,
    summary: "Grades Phase 1 and reviews hack attempts.",
    can: ["Grade written answers and explanations", "See hack verdicts and jury detail", "Watch the Phase 1 standings"],
    cannot: ["Advance the phase or change settings", "Choose who goes through to Phase 2", "Compete"],
  },
  {
    value: "admin",
    label: "Administrator",
    icon: <Icon.Shield size={16} />,
    summary: "Everything you can do, including the irreversible things.",
    can: ["Everything an evaluator can", "Advance phases, run the auction, change settings", "Reset or wipe the whole contest"],
    cannot: ["Compete"],
  },
] as const;

/** Readable and long enough to be worth using — this is written on paper, not typed from memory. */
function suggestPassword(): string {
  const words = ["amber", "cobalt", "dynamo", "ember", "falcon", "granite", "harbour", "indigo", "juniper", "kestrel", "lantern", "meridian", "nimbus", "onyx", "pivot", "quarry", "ridge", "summit", "tundra", "umbra", "vertex", "willow", "zenith"];
  const pick = () => words[Math.floor(Math.random() * words.length)];
  return `${pick()}-${pick()}-${Math.floor(Math.random() * 90 + 10)}`;
}

function CreateStaffDialog({ onClose, onDone }: { onClose: () => void; onDone: () => Promise<void> }) {
  const { toast } = useToast();
  const [f, setF] = useState({ username: "", password: "", role: "evaluator" as "evaluator" | "admin", reason: "" });
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const name = f.username.trim();
  const nameBad = name.length > 0 && !NAME_RULE.test(name);
  const signIn = name.replace(/\s+/g, "_").toLowerCase();
  const role = ROLES.find((r) => r.value === f.role)!;
  const ready = NAME_RULE.test(name) && f.password.length >= 8 && f.reason.trim().length >= 3;

  async function create() {
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/admin/staff", { ...f, username: name });
      toast({ title: `${role.label} '${name}' created`, description: "Hand the password over in person — nothing is emailed.", tone: "success" });
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
      title="Create a staff account"
      description="Staff sign in with a name and a password you set here. Nothing is emailed and nothing is recoverable — write the password down before you close this."
      footer={
        <>
          <span className="mr-auto hidden text-[12px] text-faint sm:block">Recorded in the audit log</span>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={create} loading={busy} disabled={!ready}>
            <Icon.UserPlus size={14} /> Create {role.label.toLowerCase()}
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
                "Shown on grading screens and in the audit log. Letters, digits, spaces, _ . - "
              )
            }
            error={nameBad ? "2–32 characters: letters, digits, spaces, and _ . - only" : undefined}
          >
            <Input
              value={f.username}
              onChange={(e) => setF({ ...f, username: e.target.value })}
              placeholder="e.g. Anjali Rao"
              autoFocus
              autoComplete="off"
              aria-invalid={nameBad || undefined}
              maxLength={32}
            />
          </Field>

          <Field label="Password" required hint={`${f.password.length}/8 minimum`} help="They cannot change it themselves; an administrator resets it.">
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Input
                  type={show ? "text" : "password"}
                  value={f.password}
                  onChange={(e) => setF({ ...f, password: e.target.value })}
                  className={cn("pr-9", show && "font-mono")}
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
                    setShow(true); // no clipboard permission: at least make it readable
                  }
                }}
              >
                {copied ? <Icon.Check size={14} className="text-green" /> : <Icon.Copy size={14} />}
              </Button>
            </div>
          </Field>
        </fieldset>

        <fieldset>
          <legend className="mb-3 text-[11px] font-semibold tracking-[0.07em] text-faint uppercase">What they can do</legend>
          <ChoiceCards
            cols={1}
            value={f.role}
            onChange={(v) => setF({ ...f, role: v })}
            name="Role"
            options={ROLES.map((r) => ({ value: r.value, label: r.label, icon: r.icon, description: r.summary }))}
          />
          <div className="mt-3 grid gap-3 rounded-md border bg-muted/40 p-3.5 sm:grid-cols-2">
            <div>
              <div className="mb-1.5 text-[11px] font-semibold tracking-[0.06em] text-green-dark uppercase">Can</div>
              <ul className="space-y-1 text-[12px] leading-snug">
                {role.can.map((x) => (
                  <li key={x} className="flex gap-1.5">
                    <Icon.Check size={12} className="mt-0.5 shrink-0 text-green" />
                    {x}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="mb-1.5 text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">Cannot</div>
              <ul className="space-y-1 text-[12px] leading-snug">
                {role.cannot.map((x) => (
                  <li key={x} className="flex gap-1.5">
                    <Icon.X size={12} className="mt-0.5 shrink-0 text-faint" />
                    {x}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {f.role === "admin" && (
            <Alert variant="warning" className="mt-3">
              <Icon.Alert />
              <AlertDescription>
                An administrator can wipe the contest and cannot be stopped by you afterwards. Only create one for someone who is running the
                day with you.
              </AlertDescription>
            </Alert>
          )}
        </fieldset>

        <fieldset>
          <legend className="mb-3 text-[11px] font-semibold tracking-[0.07em] text-faint uppercase">Why</legend>
          <Field label="Reason" required help="Goes into the audit log with your name and the time. Write what a colleague would need to understand this later.">
            <Input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="e.g. second grader for Phase 1" />
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
