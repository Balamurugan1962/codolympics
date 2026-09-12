/**
 * Moving the contest through its phases (US-B2-01). Only an administrator
 * advances a phase, with a reason; deadlines are set here and gate answering
 * and submitting elsewhere. Nothing auto-advances -- a passed deadline closes
 * the round but leaves the organiser in control of what happens next.
 */
import { count, eq } from "drizzle-orm";

import { db } from "@/db";
import { contest, p1Advancement, participant, question, type Phase } from "@/db/schema";

import { errors } from "./api";
import { audit } from "./audit";
import { createLotsForRound, openNextLot } from "./auction";
import { getContest, nextPhase, phaseDurationMinutes, phaseSnapshot } from "./contest";
import { publish } from "./events";
import { judge } from "./judge";
import { scoreValidatorQuestions } from "./phase1-puzzles";

/** What would stop or warn about advancing. Shown before confirmation. */
export async function advanceChecks(): Promise<{ next: Phase | null; blockers: string[]; warnings: string[] }> {
  const c = await getContest();
  const next = nextPhase(c.phase);
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (!next) return { next, blockers: ["the contest has ended"], warnings };

  if (c.phase === "registration") {
    if (c.registrationOpen) blockers.push("close registration first — the roster must be final because balances are equal");
    const [{ n }] = await db.select({ n: count() }).from(participant);
    if (n === 0) blockers.push("nobody has registered");
  }
  if (next === "auction1") {
    const [{ n }] = await db.select({ n: count() }).from(p1Advancement).where(eq(p1Advancement.advanced, true));
    if (n === 0) blockers.push("no participant has been selected to advance");
    // Confirm every question exists with testcases before anyone can pay for it (US-B8-03).
    const qs = await db.select({ id: question.id, validated: question.validated }).from(question);
    if (qs.length === 0) blockers.push("there are no questions to auction");
    for (const q of qs) {
      try {
        const info = await judge.problem(q.id);
        if (info.testcases === 0) warnings.push(`${q.id} has no testcases`);
        if (!info.validated && !q.validated) warnings.push(`${q.id} has not been validated`);
      } catch {
        blockers.push(`${q.id} is missing from the judge`);
      }
    }
  }
  return { next, blockers, warnings };
}

export async function advancePhase(actorId: string, reason: string, opts: { acknowledgeWarnings?: boolean } = {}): Promise<Phase> {
  const { next, blockers, warnings } = await advanceChecks();
  if (!next) throw errors.conflict("ended", "the contest has ended");
  if (blockers.length) throw errors.conflict("blocked", blockers.join("; "));
  if (warnings.length && !opts.acknowledgeWarnings) throw errors.conflict("warnings", warnings.join("; "));

  const c = await getContest();
  const minutes = phaseDurationMinutes(c, next);
  const phaseEndsAt = minutes ? new Date(Date.now() + minutes * 60_000) : null;

  // Leaving Section A: score validator questions now that nobody can change an answer.
  if (c.phase === "p1_puzzles") await scoreValidatorQuestions();

  await db.transaction(async (tx) => {
    await tx.update(contest).set({ phase: next, phaseEndsAt }).where(eq(contest.id, 1));
    await audit({ actorId, action: "phase.advance", target: next, reason, detail: { from: c.phase, warnings } }, tx);
  });

  if (next === "auction1") { await createLotsForRound(1); await openNextLot(1); }
  if (next === "auction2") { await createLotsForRound(2); await openNextLot(2); }

  publish("phase", phaseSnapshot(await getContest()));
  publish("leaderboard", {});
  return next;
}

/** Extend the current round (US-B2-03). All clients see the new deadline via the phase event. */
export async function extendPhase(actorId: string, minutes: number, reason: string): Promise<void> {
  const c = await getContest();
  if (!c.phaseEndsAt) throw errors.conflict("no_deadline", "the current phase has no deadline to extend");
  const base = Math.max(c.phaseEndsAt.getTime(), Date.now());
  await db.transaction(async (tx) => {
    await tx.update(contest).set({ phaseEndsAt: new Date(base + minutes * 60_000) }).where(eq(contest.id, 1));
    await audit({ actorId, action: "phase.extend", target: c.phase, reason, detail: { minutes } }, tx);
  });
  publish("phase", phaseSnapshot(await getContest()));
}

export async function setRegistration(actorId: string, open: boolean, reason: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(contest).set({ registrationOpen: open }).where(eq(contest.id, 1));
    await audit({ actorId, action: open ? "registration.open" : "registration.close", reason }, tx);
  });
  publish("phase", phaseSnapshot(await getContest()));
}

/** Whether the current phase's deadline has passed (rounds close; phases do not auto-advance). */
export function deadlinePassed(c: { phaseEndsAt: Date | null }): boolean {
  return c.phaseEndsAt !== null && c.phaseEndsAt.getTime() <= Date.now();
}
