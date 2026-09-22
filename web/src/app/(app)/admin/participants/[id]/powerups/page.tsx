"use client";

/**
 * One participant's powerups: every one they bought, every one they used and
 * on whom, and every one used on them, each with the time it happened, plus
 * what they hold right now and how their shields went.
 *
 * The page for "I never bought that", "my blackout did nothing" and "who
 * blacked me out": the answer is a time and a name, not a balance.
 */
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { Event, Timeline, spansDays, type Tone } from "@/components/admin/timeline";
import { Icon } from "@/components/icons";
import { LocalTime } from "@/components/local-time";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { PageBody, Section } from "@/components/ui/page";
import { AsideBlock, Facts, RecordBody, RecordHeader } from "@/components/ui/record";
import { DetailSkeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/client";
import { useCameFrom } from "@/lib/came-from";

type PowerupEvent = {
  id: number;
  kind: "purchase" | "use" | "blocked" | "expired";
  powerup: string | null;
  powerup_kind: "blackout" | "shield" | null;
  actor_id: string;
  actor: string;
  target: string | null;
  /** Their own doing, as opposed to something used on them. */
  mine: boolean;
  cost: number;
  seconds: number | null;
  at: string;
};
type Shield = {
  id: number; name: string; seconds: number; starts_at: string; ends_at: string | null;
  absorbed_at: string | null; absorbed_by: string | null; up: boolean;
};
type Data = {
  participant: { id: string; name: string; username: string | null };
  holdings: { powerup_id: number; name: string; kind: "blackout" | "shield"; quantity: number; purchased: number }[];
  shields: Shield[];
  events: PowerupEvent[];
};

/** How long a powerup lasts, as the organiser wrote it: 60 s, 5 min. */
function lasting(seconds: number | null): string | null {
  if (seconds === null) return null;
  if (seconds < 0) return "until it absorbs an attack";
  return seconds % 60 === 0 && seconds >= 60 ? `${seconds / 60} min` : `${seconds} s`;
}

/** One event as a line: who did what to whom, from this participant's side. */
function describe(e: PowerupEvent, name: string): { title: string; tone: Tone; chip: ReactNode; summary?: string } {
  const item = e.powerup ?? "a powerup";
  const time = lasting(e.seconds);
  if (e.kind === "purchase") {
    return { title: `Bought ${item}`, tone: "info", chip: <Badge variant="info">bought</Badge>, summary: `${e.cost.toLocaleString()} coins` };
  }
  if (!e.mine) {
    const landed = e.kind === "use";
    return {
      title: `${e.actor} used ${item} on ${name}`,
      tone: landed ? "destructive" : "success",
      chip: landed ? <Badge variant="destructive">landed on them</Badge> : <Badge variant="success">absorbed by their shield</Badge>,
      summary: landed && time ? `blacked out for ${time}` : undefined,
    };
  }
  const landed = e.kind === "use";
  return {
    title: `Used ${item} on ${e.target ?? "someone"}`,
    tone: landed ? "warning" : "neutral",
    chip: landed ? <Badge variant="warning">landed</Badge> : <Badge variant="neutral">blocked by a shield</Badge>,
    summary: landed && time ? `${e.target} blacked out for ${time}` : "The powerup was spent all the same.",
  };
}

function shieldSummary(s: Shield): string {
  if (s.absorbed_at) return `absorbed an attack from ${s.absorbed_by ?? "someone"}`;
  if (s.up) return s.ends_at ? "up now" : "up now, until it absorbs an attack";
  return "ran out unattacked";
}

export default function ParticipantPowerupsPage() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { setD(await api.get<Data>(`/api/admin/participants/${id}/powerups`)); }
    catch { setError("That participant's powerups could not be loaded."); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const back = useCameFrom({ href: `/admin/participants/${id}`, label: d?.participant.name ?? "Participant" });

  if (error) return <PageBody><Alert variant="destructive"><Icon.Alert /><AlertDescription>{error}</AlertDescription></Alert></PageBody>;
  if (!d) return <PageBody width="wide"><DetailSkeleton tabs={0} stats={3} /></PageBody>;

  const name = d.participant.name;
  const bought = d.events.filter((e) => e.kind === "purchase");
  const used = d.events.filter((e) => e.mine && e.kind !== "purchase");
  const received = d.events.filter((e) => !e.mine);
  const spent = bought.reduce((s, e) => s + e.cost, 0);
  const dated = spansDays(d.events.map((e) => e.at));

  return (
    <PageBody width="wide">
      <RecordHeader
        back={back}
        title="Powerups"
        meta={`Everything ${name} bought and used, and everything used on them, newest first.`}
        figures={[
          { label: "Bought", value: bought.length, note: `${spent.toLocaleString()} coins in all` },
          { label: "Used", value: used.length, note: `${used.filter((e) => e.kind === "use").length} landed` },
          { label: "Used on them", value: received.length, note: `${received.filter((e) => e.kind === "blocked").length} absorbed`, tone: received.some((e) => e.kind === "use") ? "destructive" : "default" },
        ]}
      />

      <RecordBody
        aside={
          <>
            <AsideBlock title="Holding now">
              {d.holdings.length === 0 ? (
                <p className="text-[12.5px] text-faint">Nothing bought yet.</p>
              ) : (
                <Facts
                  items={d.holdings.map((h) => ({
                    label: h.name,
                    value: h.kind === "shield"
                      ? `${h.quantity} waiting, ${h.purchased} bought`
                      : `${h.quantity} unused of ${h.purchased} bought`,
                  }))}
                />
              )}
            </AsideBlock>
            <AsideBlock title="Shields">
              {d.shields.length === 0 ? (
                <p className="text-[12.5px] text-faint">No shield has started.</p>
              ) : (
                <ul className="space-y-2 text-[12.5px]">
                  {d.shields.map((s) => (
                    <li key={s.id} className="flex items-baseline justify-between gap-3">
                      <span>
                        <span className={s.up ? "font-medium text-brand-deep" : undefined}>{shieldSummary(s)}</span>
                        {s.seconds > 0 && <span className="text-faint"> · {lasting(s.seconds)}</span>}
                      </span>
                      <span className="shrink-0 text-faint"><LocalTime iso={s.absorbed_at ?? s.starts_at} withDate={dated} /></span>
                    </li>
                  ))}
                </ul>
              )}
            </AsideBlock>
          </>
        }
      >
        <Section title="What happened" description={d.events.length ? "Every purchase and use, with the moment it happened." : undefined} padded={false}>
          {d.events.length === 0 ? (
            <p className="px-5 py-6 text-center text-[13px] text-faint">{name} has not bought a powerup, and nobody has used one on them.</p>
          ) : (
            <Timeline>
              {d.events.map((e) => {
                const line = describe(e, name);
                return <Event key={e.id} at={e.at} withDate={dated} tone={line.tone} title={line.title} chips={line.chip} summary={line.summary} />;
              })}
            </Timeline>
          )}
        </Section>
      </RecordBody>
    </PageBody>
  );
}
