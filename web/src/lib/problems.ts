/**
 * Problem packages (US-B8-01..03, US-B9-01). The app writes to the problems
 * volume; the judge mounts it read-only and reads it (decision 68).
 *
 *   problems/<id>/
 *     current -> v3        swapping this symlink is the atomic publish
 *     v1/ v2/ v3/          each a complete judge package
 *
 * Upload -> validate (against the new, unpublished version) -> publish.
 * Publishing mid-contest rejudges every submission for the question.
 */
import { unzipSync } from "fflate";
import { eq } from "drizzle-orm";
import fs from "node:fs/promises";
import path from "node:path";

import { db } from "@/db";
import { question } from "@/db/schema";

import { errors } from "./api";
import { audit } from "./audit";
import { getContest, isPhase2 } from "./contest";
import { judge, JudgeError, type ValidationReport } from "./judge";
import { rejudgeQuestion, submissionCount } from "./submissions";

const ROOT = path.resolve(process.env.PROBLEMS_DIR ?? "../judge/problems");
const ID = /^[A-Za-z0-9._-]+$/;

function dirFor(id: string, ...rest: string[]): string {
  if (!ID.test(id)) throw errors.invalid("problem id: letters, digits, . _ - only");
  return path.join(ROOT, id, ...rest);
}

/** Remove every package from the problems volume. Only the contest reset calls this. */
export async function deleteAllPackages(): Promise<number> {
  let entries: string[] = [];
  try { entries = await fs.readdir(ROOT); } catch { return 0; }
  for (const name of entries) await fs.rm(path.join(ROOT, name), { recursive: true, force: true });
  return entries.length;
}

export async function versionsOf(id: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dirFor(id), { withFileTypes: true });
    return entries.filter((e) => e.isDirectory() && /^v\d+$/.test(e.name)).map((e) => e.name).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
  } catch {
    return [];
  }
}

export async function currentVersion(id: string): Promise<string | null> {
  try {
    return path.basename(await fs.readlink(dirFor(id, "current")));
  } catch {
    return null;
  }
}

/** Extract a zip into the next version directory. Never touches the live one. */
export async function uploadPackage(actorId: string, input: { id: string; zip: Uint8Array; reason: string }): Promise<{ version: string }> {
  const existing = await versionsOf(input.id);
  const next = `v${existing.length ? Number(existing[existing.length - 1].slice(1)) + 1 : 1}`;
  const target = dirFor(input.id, next);

  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(input.zip);
  } catch {
    throw errors.invalid("the upload is not a valid zip file");
  }
  const names = Object.keys(files).filter((n) => !n.endsWith("/") && !n.includes("__MACOSX") && !path.basename(n).startsWith("."));
  if (names.length === 0) throw errors.invalid("the zip is empty");

  // If everything sits under one top-level folder, strip it.
  const tops = new Set(names.map((n) => n.split("/")[0]));
  const strip = tops.size === 1 && names.every((n) => n.includes("/")) ? `${[...tops][0]}/` : "";
  const rel = (n: string) => (strip && n.startsWith(strip) ? n.slice(strip.length) : n);

  if (!names.some((n) => rel(n) === "problem.json")) throw errors.invalid("the package has no problem.json at its root");

  await fs.mkdir(target, { recursive: true });
  for (const n of names) {
    const r = rel(n);
    if (r.includes("..")) continue;
    const dest = path.join(target, r);
    if (!dest.startsWith(target)) continue;
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, files[n]);
  }

  await audit({ actorId, action: "problem.upload", target: input.id, reason: input.reason, detail: { version: next, files: names.length } });
  return { version: next };
}

/** Validate a specific version through the judge (US-B8-02). */
export async function validateVersion(
  id: string,
  version: string,
  body: { reference_source?: string; wrong_source?: string; language?: string } = {},
): Promise<ValidationReport> {
  if (!ID.test(id) || !/^v\d+$/.test(version)) throw errors.invalid("bad id or version");
  try {
    return await judge.validate(id, body, version);
  } catch (err) {
    if (err instanceof JudgeError && err.status === 404) throw errors.notFound(`${id} ${version} on the judge`);
    throw err;
  }
}

/**
 * Publish a version: swap the symlink atomically, then rejudge if the contest
 * is running. Returns how many submissions were rejudged.
 */
export async function publishVersion(actorId: string, input: { id: string; version: string; reason: string; confirmedRejudge: number }): Promise<{ rejudged: number }> {
  const versions = await versionsOf(input.id);
  if (!versions.includes(input.version)) throw errors.notFound(`${input.id} ${input.version}`);

  // The blast radius must have been shown and confirmed (US-F9-03).
  const c = await getContest();
  const affected = isPhase2(c.phase) ? await submissionCount(input.id) : 0;
  if (affected !== input.confirmedRejudge) {
    throw errors.conflict("confirm_rejudge", `publishing will rejudge ${affected} submission(s); confirm that number`);
  }

  const link = dirFor(input.id, "current");
  const tmp = dirFor(input.id, `.current.${Date.now()}`);
  await fs.symlink(input.version, tmp);
  await fs.rename(tmp, link); // atomic replace of the symlink

  await db.update(question).set({ problemVersion: input.version, validated: false }).where(eq(question.id, input.id));
  await audit({ actorId, action: "problem.publish", target: input.id, reason: input.reason, detail: { version: input.version, rejudged: affected } });

  const rejudged = affected > 0 ? await rejudgeQuestion(input.id) : 0;
  return { rejudged };
}

export async function markValidated(id: string, ok: boolean): Promise<void> {
  await db.update(question).set({ validated: ok }).where(eq(question.id, id));
}

/** Read the first K testcases of a version -- the samples (decision 69). */
export async function samplesFor(id: string, count: number, version?: string | null) {
  const out: { input: string; output: string }[] = [];
  for (let i = 0; i < count; i++) {
    try {
      const t = await judge.testcase(id, i, version ?? undefined);
      out.push({ input: t.input, output: t.answer });
    } catch {
      break;
    }
  }
  return out;
}
