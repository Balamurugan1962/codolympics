"use client";

/**
 * Powerup configuration.
 *
 * Every number the marketplace uses lives in these rows — price, duration, how
 * many someone may hold or buy, and which parts of the contest a powerup works
 * in. Nothing about them is compiled into the frontend, so an organiser can
 * make a Blackout thirty seconds and 300 credits five minutes before the round
 * without a deploy.
 *
 * Changes govern the next purchase and the next use. A blackout already sitting
 * on somebody keeps the duration it landed with, because it stores a real end
 * time rather than a pointer at this row — shortening the setting mid-round
 * never cuts a block short, and lengthening it never extends one.
 */
import { useCallback, useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { ReasonAction } from "@/components/reason-action";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PageBody, PageHeader, Section } from "@/components/ui/page";
import { SectionSkeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";

type P = {
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

export default function PowerupsPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<P[] | null>(null);
  const [draft, setDraft] = useState<Record<number, Partial<P>>>({});

  const load = useCallback(async () => {
    const r = await api.get<{ powerups: P[] }>("/api/admin/powerups");
    setRows(r.powerups);
    setDraft({});
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  if (!rows) {
    return (
      <PageBody width="narrow">
        <PageHeader title="Powerups" />
        <div className="space-y-5">
          <SectionSkeleton lines={4} />
          <SectionSkeleton lines={4} />
        </div>
      </PageBody>
    );
  }

  const edit = (id: number, patch: Partial<P>) => setDraft((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  const valueOf = <K extends keyof P>(r: P, k: K): P[K] => (draft[r.id]?.[k] ?? r[k]) as P[K];
  const dirty = (r: P) => Object.keys(draft[r.id] ?? {}).length > 0;

  async function save(r: P, reason: string) {
    const d = draft[r.id] ?? {};
    await api.patch("/api/admin/powerups", {
      reason,
      id: r.id,
      name: d.name,
      description: d.description,
      price: d.price,
      duration_seconds: d.durationSeconds,
      enabled: d.enabled,
      max_held: d.maxHeld,
      max_purchases: d.maxPurchases,
      usable_phases: d.usablePhases,
    });
    toast({ title: `${r.name} saved`, description: "Recorded in the audit log.", tone: "success" });
    await load();
  }

  return (
    <PageBody width="narrow">
      <PageHeader
        title="Powerups"
        description="What is on sale, what it costs, and where it works. The marketplace itself is switched on in Settings."
      />

      <Alert variant="info" className="mb-5">
        <Icon.Info />
        <AlertTitle>Changes apply to what happens next</AlertTitle>
        <AlertDescription>
          A blackout already running keeps the duration it landed with. Editing these will not shorten or extend a block that is
          already on somebody.
        </AlertDescription>
      </Alert>

      <div className="space-y-5">
        {rows.map((r) => (
          <Section
            key={r.id}
            title={
              <span className="flex items-center gap-2">
                {r.kind === "blackout" ? <Icon.Ban size={15} /> : <Icon.Shield size={15} />}
                {r.name}
                {valueOf(r, "enabled") ? <Badge variant="success">on sale</Badge> : <Badge variant="neutral">off</Badge>}
              </span>
            }
            description={r.kind === "blackout" ? "Aimed at another competitor." : "Protects whoever holds it. Nothing to activate."}
            actions={
              <div className="flex items-center gap-2">
                {dirty(r) && (
                  <Button variant="ghost" size="sm" onClick={() => setDraft((d) => ({ ...d, [r.id]: {} }))}>
                    Discard
                  </Button>
                )}
                <ReasonAction
                  label={valueOf(r, "enabled") ? "Take off sale" : "Put on sale"}
                  size="sm"
                  icon={valueOf(r, "enabled") ? <Icon.Pause size={14} /> : <Icon.Play size={14} />}
                  title={`${valueOf(r, "enabled") ? "Take" : "Put"} ${r.name} ${valueOf(r, "enabled") ? "off" : "on"} sale`}
                  defaultReason={`${valueOf(r, "enabled") ? "Withdrawing" : "Offering"} ${r.name}.`}
                  description={
                    valueOf(r, "enabled")
                      ? "It disappears from the marketplace and cannot be used. Anything already held stays held."
                      : "It appears in the marketplace at its current price."
                  }
                  onConfirm={async (reason) => {
                    await api.patch("/api/admin/powerups", { reason, id: r.id, enabled: !valueOf(r, "enabled") });
                    await load();
                  }}
                />
              </div>
            }
          >
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name">
                  <Input value={valueOf(r, "name")} onChange={(e) => edit(r.id, { name: e.target.value })} />
                </Field>
                <Field label="Price" hint="in contest credits">
                  <Input
                    type="number"
                    min={0}
                    value={valueOf(r, "price")}
                    onChange={(e) => edit(r.id, { price: Number(e.target.value) })}
                  />
                </Field>
              </div>

              <Field label="Description" help="Shown in the marketplace exactly as written.">
                <Textarea rows={2} value={valueOf(r, "description")} onChange={(e) => edit(r.id, { description: e.target.value })} />
              </Field>

              <div className="grid gap-4 sm:grid-cols-3">
                {r.kind === "blackout" && (
                  <Field label="Duration" hint="seconds">
                    <Input
                      type="number"
                      min={1}
                      max={3600}
                      value={valueOf(r, "durationSeconds") ?? ""}
                      onChange={(e) => edit(r.id, { durationSeconds: e.target.value === "" ? null : Number(e.target.value) })}
                    />
                  </Field>
                )}
                <Field label="Hold at most" hint="blank for no limit">
                  <Input
                    type="number"
                    min={1}
                    placeholder="no limit"
                    value={valueOf(r, "maxHeld") ?? ""}
                    onChange={(e) => edit(r.id, { maxHeld: e.target.value === "" ? null : Number(e.target.value) })}
                  />
                </Field>
                <Field label="Buy at most" hint="whole contest">
                  <Input
                    type="number"
                    min={1}
                    placeholder="no limit"
                    value={valueOf(r, "maxPurchases") ?? ""}
                    onChange={(e) => edit(r.id, { maxPurchases: e.target.value === "" ? null : Number(e.target.value) })}
                  />
                </Field>
              </div>

              <Field label="Usable during" help="Buying is governed by the marketplace switch in Settings; this is where it may be used.">
                <div className="flex flex-wrap gap-1.5">
                  {PHASE_CHOICES.map(([key, label]) => {
                    const on = (valueOf(r, "usablePhases") ?? []).includes(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={on}
                        onClick={() => {
                          const cur = valueOf(r, "usablePhases") ?? [];
                          edit(r.id, { usablePhases: on ? cur.filter((p) => p !== key) : [...cur, key] });
                        }}
                        className={cn(
                          "rounded-md border px-2.5 py-1 text-[12px] font-medium transition-colors",
                          on ? "border-brand bg-brand text-white" : "border-line text-muted-foreground hover:border-line-2 hover:text-foreground",
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </Field>

              {dirty(r) && (
                <div className="flex justify-end border-t pt-4">
                  <ReasonAction
                    label="Save changes"
                    variant="default"
                    icon={<Icon.Save size={14} />}
                    title={`Save ${r.name}`}
                    defaultReason={`Adjusting ${r.name} for this contest.`}
                    description="Applies to the next purchase and the next use. Blackouts already running are untouched."
                    onConfirm={(reason) => save(r, reason)}
                  />
                </div>
              )}
            </div>
          </Section>
        ))}
      </div>
    </PageBody>
  );
}
