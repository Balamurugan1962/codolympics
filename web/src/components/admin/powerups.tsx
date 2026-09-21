"use client";

/**
 * Powerup configuration: the list, and one powerup's settings.
 *
 * Every number the marketplace uses lives in these rows — price, duration, how
 * many someone may hold or buy, and which parts of the contest a powerup works
 * in. Nothing about them is compiled into the frontend, so an organiser can
 * make a Blackout thirty seconds and 300 coins five minutes before the round
 * without a deploy.
 *
 * The list says what is on sale and for how much; a powerup's own page holds
 * its settings. Editing one powerup is a self-contained job, and stacking both
 * of them open on one screen meant scrolling past four fields you were not
 * changing to reach the one you were.
 *
 * Changes govern the next purchase and the next use. A blackout already sitting
 * on somebody keeps the duration it landed with, because it stores a real end
 * time rather than a pointer at this row — shortening the setting mid-round
 * never cuts a block short, and lengthening it never extends one.
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { ActionButton } from "@/components/action-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChoiceCards } from "@/components/ui/choice";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Hint } from "@/components/ui/hint";
import { Input } from "@/components/ui/input";
import { PageHeader, Section } from "@/components/ui/page";
import { ListSkeleton, SectionSkeleton, Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";

export type Powerup = {
  id: number;
  kind: "blackout" | "shield";
  name: string;
  description: string;
  price: number;
  durationSeconds: number | null;
  enabled: boolean;
  maxHeld: number | null;
  maxPurchases: number | null;
  usablePhases: string[];
};

/** Only the phases where a powerup could sensibly do anything. */
const PHASE_CHOICES: [string, string][] = [
  ["p1_puzzles", "Section A"],
  ["p1_hacking", "Section B"],
  ["auction1", "Auction 1"],
  ["coding1", "Coding 1"],
  ["auction2", "Auction 2"],
  ["final", "Final"],
];

const PHASE_LABEL = new Map(PHASE_CHOICES);

const KIND_BLURB: Record<Powerup["kind"], string> = {
  blackout: "Aimed at another competitor.",
  shield: "One is up at a time, for the duration set here; the rest wait in a queue and start on their own. Nothing to activate.",
};

function KindIcon({ kind }: { kind: Powerup["kind"] }) {
  return kind === "blackout" ? <Icon.Ban size={15} /> : <Icon.Shield size={15} />;
}

function useLoadPowerups() {
  const [rows, setRows] = useState<Powerup[] | null>(null);
  const load = useCallback(async () => {
    const r = await api.get<{ powerups: Powerup[] }>("/api/admin/powerups");
    setRows(r.powerups);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return { rows, load };
}

/** What a powerup costs and where it works, in one line. */
function terms(p: Powerup): string {
  const where = p.usablePhases.length
    ? p.usablePhases.map((k) => PHASE_LABEL.get(k) ?? k).join(", ")
    : "nowhere, no phases picked";
  const bits = [`${p.price} coins`];
  if (p.durationSeconds === -1) bits.push("up until it absorbs an attack");
  else if (p.durationSeconds) bits.push(`${p.durationSeconds}s`);
  bits.push(where);
  return bits.join(" · ");
}

// ---------------------------------------------------------------------------

export function PowerupList() {
  const { rows } = useLoadPowerups();
  if (!rows) return <ListSkeleton rows={2} />;
  if (rows.length === 0) {
    return (
      <Section padded={false}>
        <EmptyState icon={<Icon.Spark />} title="No powerups" body="This contest was set up without any." />
      </Section>
    );
  }

  return (
    <Section padded={false} bodyClassName="divide-y">
      {rows.map((p) => (
        <Link
          key={p.id}
          href={`/admin/powerups/${p.id}`}
          className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40"
        >
          <span className="text-muted-foreground">
            <KindIcon kind={p.kind} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate text-[13.5px] font-medium">{p.name}</span>
              {p.enabled ? <Badge variant="success">on sale</Badge> : <Badge variant="neutral">off</Badge>}
            </span>
            <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">{terms(p)}</span>
          </span>
          <Icon.ChevronRight size={15} className="shrink-0 text-muted-foreground" />
        </Link>
      ))}
    </Section>
  );
}

// ---------------------------------------------------------------------------

type AfterCap = "break" | "forever";
type Rules = {
  revealAttacker: boolean;
  revealShields: boolean;
  attackCap: number;
  attackBreakSeconds: number;
  countAbsorbedAttacks: boolean;
  afterCap: AfterCap;
};
type Switches = "revealAttacker" | "revealShields" | "countAbsorbedAttacks";

const SWITCH: Record<Switches, { field: string; label: string; help: string; on: string; off: string }> = {
  revealAttacker: {
    field: "reveal_attacker",
    label: "Tell the target who attacked them",
    help: "Off, and a blackout arrives from \"someone\", on the overlay and in the notification.",
    on: "Targets are told who attacked them.",
    off: "Targets are not told who attacked them.",
  },
  revealShields: {
    field: "reveal_shields",
    label: "Attackers can see who has a shield up",
    help: "Off, and the target list shows no shields, so an attack on a shielded person is a gamble.",
    on: "Attackers can see who has a shield up.",
    off: "Attackers cannot see who has a shield up.",
  },
  countAbsorbedAttacks: {
    field: "count_absorbed_attacks",
    label: "An attack a shield absorbed counts toward the cap",
    help: "Off, and only blackouts that land bring the break closer.",
    on: "Absorbed attacks count toward the cap.",
    off: "Only landed attacks count toward the cap.",
  },
};

/**
 * The rules of attacking, decided by the organisers for the whole contest:
 * what an attack gives away, and how often one person can be attacked. The
 * switches save the moment they are flipped; the numbers save on Save.
 */
export function AttackRules() {
  const { toast } = useToast();
  const [rules, setRules] = useState<Rules | null>(null);
  const [draft, setDraft] = useState<{ attackCap?: number; attackBreakSeconds?: number; afterCap?: AfterCap }>({});
  const load = useCallback(async () => {
    const c = await api.get<Rules>("/api/admin/contest");
    setRules({
      revealAttacker: c.revealAttacker,
      revealShields: c.revealShields,
      attackCap: c.attackCap,
      attackBreakSeconds: c.attackBreakSeconds,
      countAbsorbedAttacks: c.countAbsorbedAttacks,
      afterCap: c.afterCap,
    });
  }, []);
  useEffect(() => { void load(); }, [load]);

  const flip = async (key: Switches, on: boolean) => {
    if (!rules) return;
    setRules({ ...rules, [key]: on });
    try {
      await api.patch("/api/admin/contest", { reason: on ? SWITCH[key].on : SWITCH[key].off, [SWITCH[key].field]: on });
    } catch {
      toast({ title: "Not saved", tone: "error" });
      await load();
    }
  };

  const saveNumbers = async () => {
    await api.patch("/api/admin/contest", {
      reason: "Changed how often one person can be attacked.",
      attack_cap: draft.attackCap,
      attack_break_seconds: draft.attackBreakSeconds,
      after_cap: draft.afterCap,
    });
    toast({ title: "Attack cap saved", description: "Recorded in the audit log.", tone: "success" });
    setDraft({});
    await load();
  };

  if (!rules) return <SectionSkeleton lines={5} />;
  const cap = draft.attackCap ?? rules.attackCap;
  const seconds = draft.attackBreakSeconds ?? rules.attackBreakSeconds;
  const afterCap = draft.afterCap ?? rules.afterCap;
  const dirty = Object.keys(draft).length > 0;

  return (
    <>
      <Section title="What an attack reveals" description="For the whole contest. Each switch saves at once and is recorded in the audit log.">
        <SwitchRows keys={["revealAttacker", "revealShields"]} rules={rules} onFlip={flip} />
      </Section>

      <Section
        title="How often one person can be attacked"
        description="Without a cap, everybody attacks whoever is in front."
        info="After the cap is reached, nobody can attack that person: for a break, or for the rest of the contest. An attack on them then is refused and costs nothing. With breaks, each one for the same person is twice as long as their last, so the most-hunted person gets ever-longer peace, and counting starts afresh after each."
        footer={dirty && (
          <>
            <Button variant="ghost" onClick={() => setDraft({})}>Discard</Button>
            <ActionButton label="Save changes" variant="default" icon={<Icon.Save size={14} />} onAct={saveNumbers} />
          </>
        )}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Attacks one person can take" hint="0 for no cap">
            <Input type="number" min={0} value={cap} onChange={(e) => setDraft((d) => ({ ...d, attackCap: Number(e.target.value) }))} />
          </Field>
          {afterCap === "break" && (
            <Field label="First break" hint="seconds; doubles each time">
              <Input type="number" min={1} max={7200} value={seconds} onChange={(e) => setDraft((d) => ({ ...d, attackBreakSeconds: Number(e.target.value) }))} />
            </Field>
          )}
        </div>
        <Field label="Then" className="mt-4">
          <ChoiceCards
            cols={2}
            size="sm"
            value={afterCap}
            onChange={(v) => setDraft((d) => ({ ...d, afterCap: v }))}
            options={[
              { value: "break", label: "A break, then attacks resume", description: "Each break for the same person is twice as long as their last." },
              { value: "forever", label: "Off limits for the rest of the contest", description: "The cap is the end of it. Nobody can attack them again." },
            ]}
          />
        </Field>
        {cap > 0 && (
          <p className="mt-3 text-[12px] text-muted-foreground">
            {afterCap === "break"
              ? `After ${cap} attack${cap === 1 ? "" : "s"}: ${seconds}s of peace, then ${seconds * 2}s the next time, then ${seconds * 4}s.`
              : `After ${cap} attack${cap === 1 ? "" : "s"} on one person, nobody can attack them again.`}
          </p>
        )}
        <div className="mt-4 border-t pt-1">
          <SwitchRows keys={["countAbsorbedAttacks"]} rules={rules} onFlip={flip} />
        </div>
      </Section>
    </>
  );
}

function SwitchRows({ keys, rules, onFlip }: { keys: Switches[]; rules: Rules; onFlip: (key: Switches, on: boolean) => void }) {
  return (
    <ul className="divide-y">
      {keys.map((key) => (
        <li key={key} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
          <div>
            <div className="text-[13px] font-medium">{SWITCH[key].label}</div>
            <div className="mt-0.5 text-[12px] text-muted-foreground">{SWITCH[key].help}</div>
          </div>
          <Switch checked={rules[key]} onCheckedChange={(on) => onFlip(key, on)} aria-label={SWITCH[key].label} />
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------

/** One powerup's settings. Nothing saves until you press Save. */
export function PowerupDetail({ id }: { id: number }) {
  const { toast } = useToast();
  const { rows, load } = useLoadPowerups();
  const [draft, setDraft] = useState<Partial<Powerup>>({});

  if (!rows)
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-3.5 w-72" />
        </div>
        <SectionSkeleton lines={6} />
      </div>
    );
  const row = rows.find((r) => r.id === id);
  if (!row) {
    return (
      <Section padded={false}>
        <EmptyState
          icon={<Icon.Search />}
          title="No such powerup"
          body="It may have been removed."
          action={
            <Button variant="outline" asChild>
              <Link href="/admin/powerups">Back to powerups</Link>
            </Button>
          }
        />
      </Section>
    );
  }

  const edit = (patch: Partial<Powerup>) => setDraft((d) => ({ ...d, ...patch }));
  const dirty = Object.keys(draft).length > 0;
  const on = draft.enabled ?? row.enabled;

  const name = row.name;
  async function save() {
    await api.patch("/api/admin/powerups", {
      reason: `Adjusted ${name} for this contest.`,
      id,
      name: draft.name,
      description: draft.description,
      price: draft.price,
      duration_seconds: draft.durationSeconds,
      enabled: draft.enabled,
      max_held: draft.maxHeld,
      max_purchases: draft.maxPurchases,
      usable_phases: draft.usablePhases,
    });
    toast({ title: `${name} saved`, description: "Recorded in the audit log.", tone: "success" });
    setDraft({});
    await load();
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={
          <>
            <KindIcon kind={row.kind} />
            {row.name}
            {on ? <Badge variant="success">on sale</Badge> : <Badge variant="neutral">off</Badge>}
          </>
        }
        description={KIND_BLURB[row.kind] + " Nothing saves until you press Save."}
        info="Changes govern the next purchase and the next use. A blackout already sitting on somebody, or a shield already up, keeps the duration it started with, so shortening this never cuts one short and lengthening it never extends one."
        actions={
          <ActionButton
            label={on ? "Take off sale" : "Put on sale"}
            icon={on ? <Icon.Pause size={14} /> : <Icon.Play size={14} />}
            onAct={async () => {
              await api.patch("/api/admin/powerups", {
                reason: on ? `Took ${row.name} off sale.` : `Put ${row.name} on sale.`,
                id,
                enabled: !on,
              });
              await load();
            }}
          />
        }
      />

      <Section>
        <PowerupFields row={row} draft={draft} onEdit={edit} />
      </Section>

      {dirty && (
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={() => setDraft({})}>
            Discard
          </Button>
          <ActionButton label="Save changes" variant="default" icon={<Icon.Save size={14} />} onAct={save} />
        </div>
      )}
    </div>
  );
}

/** Everything an organiser can set on a powerup, in one form. */
function PowerupFields({ row, draft, onEdit }: { row: Powerup; draft: Partial<Powerup>; onEdit: (patch: Partial<Powerup>) => void }) {
  const valueOf = <K extends keyof Powerup>(k: K): Powerup[K] => (draft[k] ?? row[k]) as Powerup[K];
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <Input value={valueOf("name")} onChange={(e) => onEdit({ name: e.target.value })} />
        </Field>
        <Field label="Price" hint="coins">
          <Input type="number" min={0} value={valueOf("price")} onChange={(e) => onEdit({ price: Number(e.target.value) })} />
        </Field>
      </div>

      <Field label="Description" help="Shown in the marketplace exactly as written.">
        <Textarea rows={2} value={valueOf("description")} onChange={(e) => onEdit({ description: e.target.value })} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <NumberField
          label={row.kind === "shield" ? <span className="flex items-center gap-1">Up for <Hint>Seconds. Set -1 and a shield stays up until it absorbs an attack.</Hint></span> : "Duration"}
          hint="seconds"
          min={row.kind === "shield" ? -1 : 1}
          max={3600}
          value={valueOf("durationSeconds")}
          onChange={(v) => onEdit({ durationSeconds: v })}
        />
        <NumberField label="Hold at most" hint="blank for no limit" value={valueOf("maxHeld")} onChange={(v) => onEdit({ maxHeld: v })} />
        <NumberField
          label="Buy at most"
          hint="whole contest"
          value={valueOf("maxPurchases")}
          onChange={(v) => onEdit({ maxPurchases: v })}
        />
      </div>

      <Field
        label="Usable during"
        help="Buying is governed by the marketplace switch in Settings; this is where it may be used."
      >
        <PhasePicker
          picked={valueOf("usablePhases") ?? []}
          onToggle={(key) => {
            const cur = valueOf("usablePhases") ?? [];
            onEdit({ usablePhases: cur.includes(key) ? cur.filter((p) => p !== key) : [...cur, key] });
          }}
        />
      </Field>
    </div>
  );
}

/** A whole number or nothing, where nothing means no limit. */
function NumberField({
  label,
  hint,
  min = 1,
  max,
  value,
  onChange,
}: {
  label: React.ReactNode;
  hint: string;
  min?: number;
  max?: number;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <Field label={label} hint={hint}>
      <Input
        type="number"
        min={min}
        max={max}
        placeholder="no limit"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      />
    </Field>
  );
}

function PhasePicker({ picked, onToggle }: { picked: string[]; onToggle: (key: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PHASE_CHOICES.map(([key, label]) => {
        const on = picked.includes(key);
        return (
          <button
            key={key}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(key)}
            className={cn(
              "border px-2.5 py-1.5 text-[12px] font-medium transition-colors",
              on
                ? "border-brand bg-brand text-white"
                : "border-line text-muted-foreground hover:border-line-2 hover:text-foreground",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
