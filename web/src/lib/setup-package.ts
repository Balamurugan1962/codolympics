/**
 * The whole contest setup as one zip.
 *
 * The day before a contest you settle everything: the numbers, the problem set,
 * the Phase 1 questions, the running order, the people who will grade. None of
 * that should have to be done twice. This carries all of it, and deliberately
 * none of what happened when the contest ran.
 *
 *   contest.json      the settings, and the order everything is offered in
 *   staff.json        administrators and evaluators, with their credentials
 *   problems/<id>/    each Phase 2 problem: details, hints and its judge package
 *   phase1/…          puzzles and hacking questions
 *
 * What it refuses to carry is the point. Participants, balances, bids, lots,
 * ownership, answers, submissions, judgements, announcements and the audit log
 * are what *happened*, not what was set up — importing them would mean starting
 * day two with day one's results, and an audit log that describes a contest
 * this install never ran.
 *
 * The phase is not carried either: an import lands in registration, because a
 * setup is a contest that has not started.
 *
 * What *is* carried, and was not at first, is the proving: a validated package
 * arrives validated, a self-tested puzzle arrives ready, a proven hack arrives
 * with the input that proves it, and whatever was live goes back live. Proving
 * the set again is most of a day's setup work, and doing it twice is exactly
 * what this file exists to prevent. Every carried result is marked as having
 * been established elsewhere, so no screen claims this install proved it.
 */
import { asc, eq, inArray } from "drizzle-orm";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import fs from "node:fs/promises";
import path from "node:path";

import { db } from "@/db";
import { account, user } from "@/db/auth-schema";
import { contest, hint, p1HackQuestion, p1Question, question } from "@/db/schema";

import { errors } from "./api";
import { audit } from "./audit";
import { getContest, phaseSnapshot } from "./contest";
import { publish } from "./events";
import { exportProblem, importProblem } from "./problem-package";
import { importPackage as importPhase1, type Section } from "./phase1-package";

const FORMAT = 1;
const ROOT = path.resolve(process.env.PROBLEMS_DIR ?? "../judge/problems");
const ID = /^[A-Za-z0-9._-]+$/;

type Files = Record<string, Uint8Array>;
const write = (v: unknown) => strToU8(JSON.stringify(v, null, 2) + "\n");

/** Everything in the contest row that is a decision rather than a state. */
const SETTINGS = [
  "startingBalance", "bidIncrement", "countdownSeconds", "openingWindowSeconds", "ownershipCap",
  "coding1Minutes", "finalMinutes", "p1PuzzlesMinutes", "p1HackingMinutes",
  "p1SelectionBasis", "p1LeaderboardMode", "leaderboardMode",
] as const;

export type SetupSummary = {
  settings: boolean;
  staff: number;
  problems: number;
  puzzles: number;
  hacks: number;
  /** Arrived already proven — packages validated, questions self-tested, hacks broken. */
  verified: number;
  /** Made live here because they were live where the zip was made. */
  published: number;
  /** Still waiting on someone here: validation, a self-test, or a proof. */
  unverified: string[];
  warnings: string[];
};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export async function exportSetup(includeStaff: boolean): Promise<{ filename: string; zip: Uint8Array }> {
  const files: Files = {};
  const c = await getContest();

  const questions = await db.select().from(question).orderBy(asc(question.auctionOrder), asc(question.id));
  let onDisk: string[] = [];
  try {
    onDisk = (await fs.readdir(ROOT, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    /* no volume yet */
  }
  const ids = [...new Set([...questions.map((q) => q.id), ...onDisk])].filter((id) => ID.test(id));
  for (const id of ids) {
    const one = unzipSync((await exportProblem(id)).zip);
    for (const [name, data] of Object.entries(one)) files[`problems/${id}/${name}`] = data;
  }

  const puzzles = await db.select().from(p1Question).orderBy(asc(p1Question.orderIndex), asc(p1Question.id));
  const hacks = await db.select().from(p1HackQuestion).orderBy(asc(p1HackQuestion.orderIndex), asc(p1HackQuestion.id));
  // Phase 1 questions are exported through their own packer so the two formats
  // never drift; a set exported here imports on its own, and vice versa.
  const p1 = unzipSync((await (await import("./phase1-package")).exportMany(["puzzles", "hacking"] as Section[])).zip);
  for (const [name, data] of Object.entries(p1)) {
    if (name === "manifest.json") continue;
    files[`phase1/${name}`] = data;
  }

  files["contest.json"] = write({
    format: FORMAT,
    type: "setup",
    exported_at: new Date().toISOString(),
    settings: Object.fromEntries(SETTINGS.map((k) => [k, c[k]])),
    // The order is part of the setup: it was decided once and should not have
    // to be decided again. (A single-problem export drops it on purpose — one
    // problem cannot know where it belongs in someone else's running order.)
    auction_order: questions.map((q) => q.id),
    phase1_order: { puzzles: puzzles.map((q) => q.title), hacking: hacks.map((q) => q.title) },
    contains: { problems: ids.length, puzzles: puzzles.length, hacks: hacks.length },
  });

  if (includeStaff) {
    const rows = await db
      .select({ u: user, password: account.password, providerId: account.providerId, accountId: account.accountId })
      .from(user)
      .leftJoin(account, eq(account.userId, user.id))
      .where(inArray(user.role, ["admin", "evaluator"]))
      .orderBy(asc(user.role), asc(user.name));
    files["staff.json"] = write({
      format: FORMAT,
      // Salted, slow password hashes — not plaintext, but still credentials.
      // Keep this zip where you would keep a password list.
      warning: "This file contains password hashes. Treat the zip as a credential file.",
      staff: rows.map((r) => ({
        name: r.u.name,
        username: r.u.username,
        display_username: r.u.displayUsername,
        email: r.u.email,
        role: r.u.role,
        provider_id: r.providerId ?? "credential",
        password_hash: r.password ?? null,
      })),
    });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  return { filename: `codolympics-setup-${stamp}.zip`, zip: zipSync(files, { level: 6 }) };
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

const NOISE = /(^|\/)(__MACOSX\/|\.DS_Store$|Thumbs\.db$)/;

/**
 * Restore a setup. Additive by design: nothing already here is deleted, and a
 * staff account whose username exists is left alone rather than overwritten —
 * locking yourself out by importing a zip is not a recoverable mistake.
 */
export async function importSetup(actorId: string, zip: Uint8Array, reason: string): Promise<SetupSummary> {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(zip);
  } catch {
    throw errors.invalid("that is not a valid zip file");
  }
  const names = Object.keys(files).filter((n) => !n.endsWith("/") && !NOISE.test(n));

  const metaRaw = names.find((n) => n === "contest.json" || n.endsWith("/contest.json"));
  if (!metaRaw) throw errors.invalid("no contest.json — that is not a setup zip");
  const root = metaRaw.slice(0, metaRaw.length - "contest.json".length);
  const meta = JSON.parse(strFromU8(files[metaRaw])) as Record<string, unknown>;
  if (typeof meta.format === "number" && meta.format > FORMAT) {
    throw errors.invalid(`that zip was made by a newer version (format ${meta.format})`);
  }

  const c = await getContest();
  const summary: SetupSummary = {
    settings: false, staff: 0, problems: 0, puzzles: 0, hacks: 0,
    verified: 0, published: 0, unverified: [], warnings: [],
  };
  if (c.phase !== "registration") {
    summary.warnings.push(`The contest is in ${c.phase}. Imported content is added, but nothing that has already happened is touched.`);
  }

  // --- settings ------------------------------------------------------------
  const settings = (meta.settings ?? null) as Record<string, unknown> | null;
  if (settings) {
    const patch: Record<string, unknown> = {};
    for (const k of SETTINGS) if (k in settings) patch[k] = settings[k];
    if (Object.keys(patch).length > 0) {
      await db.update(contest).set(patch).where(eq(contest.id, 1));
      summary.settings = true;
    }
  }

  // --- staff ---------------------------------------------------------------
  const staffName = names.find((n) => n === `${root}staff.json`);
  if (staffName) {
    const doc = JSON.parse(strFromU8(files[staffName])) as { staff?: Record<string, unknown>[] };
    for (const s of doc.staff ?? []) {
      const username = String(s.username ?? "").toLowerCase();
      if (!username) continue;
      const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.username, username));
      if (existing) {
        summary.warnings.push(`Kept the existing account "${username}" — an import never overwrites a login.`);
        continue;
      }
      const hash = s.password_hash == null ? null : String(s.password_hash);
      if (!hash) {
        summary.warnings.push(`Skipped "${username}" — the zip carries no password for it.`);
        continue;
      }
      const id = crypto.randomUUID();
      await db.transaction(async (tx) => {
        await tx.insert(user).values({
          id,
          name: String(s.name ?? username),
          email: String(s.email ?? `${username}@contest.local`),
          emailVerified: true,
          username,
          displayUsername: String(s.display_username ?? s.name ?? username),
          role: s.role === "admin" ? "admin" : "evaluator",
        });
        // Better Auth resolves a credential account by accountId === user.id,
        // so this must be the *new* id. Carrying the exported one across
        // installs is what makes a restored login silently fail to sign in.
        await tx.insert(account).values({
          id: crypto.randomUUID(),
          accountId: id,
          providerId: String(s.provider_id ?? "credential"),
          userId: id,
          password: hash,
          updatedAt: new Date(),
        });
      });
      summary.staff += 1;
    }
  }

  // --- Phase 2 problems ----------------------------------------------------
  const problemDirs = [
    ...new Set(
      names.filter((n) => n.startsWith(`${root}problems/`) && n.endsWith("/question.json")).map((n) => n.slice(0, n.lastIndexOf("/") + 1)),
    ),
  ].sort();
  // Collected so Phase 1 knows which judge packages this zip actually brought;
  // the auction order lists only auctioned problems, and a hacking package is
  // never one of those.
  const imported = new Set<string>();
  for (const dir of problemDirs) {
    const one: Files = {};
    for (const n of names) if (n.startsWith(dir)) one[n.slice(dir.length)] = files[n];
    try {
      // goLive: this is your own setup coming back, so what was live is put
      // back live -- guarded, inside the importer, to registration only.
      const r = await importProblem(actorId, zipSync(one, { level: 0 }), { reason, goLive: true });
      imported.add(r.id);
      summary.problems += 1;
      // A hacking package is proven by its question's breaking input, not by a
      // validation it can never have; asking for one would be a job with no
      // way to finish it.
      if (r.validated) summary.verified += 1;
      else if (!r.hackOnly) summary.unverified.push(r.id);
      if (r.live) summary.published += 1;
    } catch (err) {
      summary.warnings.push(`${dir.replace(`${root}problems/`, "").replace(/\/$/, "")}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // The running order was a decision; put it back.
  const order = Array.isArray(meta.auction_order) ? (meta.auction_order as string[]) : [];
  for (const [i, id] of order.entries()) {
    await db.update(question).set({ auctionOrder: i + 1 }).where(eq(question.id, id));
  }

  // --- Phase 1 -------------------------------------------------------------
  const p1: Files = {};
  for (const n of names) if (n.startsWith(`${root}phase1/`)) p1[n.slice(`${root}phase1/`.length)] = files[n];
  if (Object.keys(p1).length > 0) {
    try {
      const r = await importPhase1(actorId, zipSync(p1, { level: 0 }), reason, imported, { goLive: true });
      summary.puzzles = r.created.filter((q) => q.section === "puzzles").length;
      summary.hacks = r.created.filter((q) => q.section === "hacking").length;
      summary.verified += r.verified;
      summary.published += r.published;
      summary.unverified.push(...r.unverified);
      for (const m of r.missingPackages) summary.warnings.push(`"${m.title}" needs the judge package ${m.problem_id}.`);
      for (const s of r.skipped) summary.warnings.push(`${s.path}: ${s.why}`);
    } catch (err) {
      summary.warnings.push(`Phase 1: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // What is actually left to do here, rather than a standing instruction to
  // redo the work the zip exists to carry.
  if (summary.unverified.length > 0) {
    summary.warnings.push(
      `Never proven anywhere: ${summary.unverified.join(", ")}. Validate or self-test each of these here before publishing it.`,
    );
  }
  if (c.phase !== "registration") {
    summary.warnings.push("Nothing was published, because the contest is already running — publishing now would change what participants can see.");
  } else if (summary.published === 0 && summary.problems + summary.puzzles + summary.hacks > 0) {
    summary.warnings.push("Nothing in the zip was live when it was exported, so nothing was published here.");
  }

  await audit({
    actorId,
    action: "setup.import",
    reason,
    detail: {
      settings: summary.settings, staff: summary.staff, problems: summary.problems,
      puzzles: summary.puzzles, hacks: summary.hacks, verified: summary.verified, published: summary.published,
    },
  });
  publish("phase", phaseSnapshot(await getContest()));
  return summary;
}
