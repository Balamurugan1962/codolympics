/**
 * A whole Phase 2 problem as one portable zip.
 *
 * A Phase 2 problem is two things that normally live apart: the judge package
 * on the problems volume (problem.json, tests, checker, reference) and the
 * contest-facing side in the database (title, statement, score, base price,
 * hints). Moving one without the other gives you a problem nobody can solve or
 * a question the judge has never heard of, so this carries both.
 *
 *   question.json        title, statement, score, price, hints
 *   package/…            the judge package, byte for byte
 *
 * The package sits in its own folder so `package/` alone is exactly what the
 * upload endpoint already accepts — the two formats stay compatible, and a zip
 * built by hand for the judge still imports here.
 */
import { asc, eq } from "drizzle-orm";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import fs from "node:fs/promises";
import path from "node:path";

import { db } from "@/db";
import { DIFFICULTIES, hint, question } from "@/db/schema";

import { errors } from "./api";
import { audit } from "./audit";
import { getContest } from "./contest";
import { currentVersion, publishVersion, stampImportedValidation, uploadPackage, validationOf, versionsOf } from "./problems";

const FORMAT = 1;
const ROOT = path.resolve(process.env.PROBLEMS_DIR ?? "../judge/problems");
const ID = /^[A-Za-z0-9._-]+$/;
const MAX_PACKAGE_BYTES = 64 * 1024 * 1024;

type Files = Record<string, Uint8Array>;

/** Every file in a version directory, keyed by its path inside the package. */
async function readVersion(id: string, version: string): Promise<Files> {
  const base = path.join(ROOT, id, version);
  const out: Files = {};
  let total = 0;

  async function walk(dir: string, prefix: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.isDirectory()) {
        await walk(full, rel);
      } else if (e.isFile()) {
        const data = await fs.readFile(full);
        total += data.byteLength;
        if (total > MAX_PACKAGE_BYTES) throw errors.invalid("that package is larger than 64 MB");
        out[rel] = new Uint8Array(data);
      }
    }
  }

  try {
    await walk(base, "");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") throw errors.notFound("package version");
    throw err;
  }
  return out;
}

/**
 * One problem. The live version is exported when there is one — that is the
 * package this contest actually ran, which is what anyone re-importing wants;
 * otherwise the latest upload, because an unpublished draft is still worth
 * carrying.
 */
export async function exportProblem(id: string): Promise<{ filename: string; zip: Uint8Array }> {
  if (!ID.test(id)) throw errors.invalid("problem id: letters, digits, . _ - only");

  const [q] = await db.select().from(question).where(eq(question.id, id));
  const hints = await db.select().from(hint).where(eq(hint.questionId, id)).orderBy(asc(hint.idx));
  const version = (await currentVersion(id)) ?? (await versionsOf(id)).at(-1) ?? null;
  if (!q && !version) throw errors.notFound("problem");

  const files: Files = {};
  if (version) {
    for (const [name, data] of Object.entries(await readVersion(id, version))) files[`package/${name}`] = data;
  }

  files["question.json"] = strToU8(
    JSON.stringify(
      {
        format: FORMAT,
        type: "problem",
        id,
        // Absent when a package was uploaded but never described.
        details: q
          ? {
              title: q.title,
              difficulty: q.difficulty,
              score: q.score,
              base_price: q.basePrice,
              statement_md: q.statementMd,
              sample_count: q.sampleCount,
              hints: hints.map((h) => ({ price: h.price, body_md: h.bodyMd })),
            }
          : null,
        // Recorded for the reader, never replayed: auction order and published
        // state belong to the contest that exported this, not to the problem.
        //
        // The validation result travels the same way. It is provenance, not
        // permission: the one thing it cannot carry is how fast the importing
        // machine is, and a reference at 1900ms of a 2000ms limit passes on the
        // exporter and times out here. Shown, never trusted.
        exported_from: {
          version,
          auction_order: q?.auctionOrder ?? null,
          was_live: Boolean(await currentVersion(id)),
          validation: version ? await validationOf(id, version) : null,
        },
      },
      null,
      2,
    ) + "\n",
  );

  return { filename: `${id}.zip`, zip: zipSync(files, { level: 6 }) };
}

/**
 * Every problem, as one zip. Each keeps the same shape it has on its own, one
 * directory down, so a bundle can be unzipped and a single problem handed to
 * someone without repacking anything.
 */
export async function exportAllProblems(): Promise<{ filename: string; zip: Uint8Array }> {
  const described = await db.select({ id: question.id }).from(question).orderBy(asc(question.auctionOrder), asc(question.id));
  let onDisk: string[] = [];
  try {
    onDisk = (await fs.readdir(ROOT, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    /* no volume yet */
  }
  // A package with no details, and details with no package, are both worth
  // carrying — they are exactly the half-finished work someone wants to move.
  const ids = [...new Set([...described.map((q) => q.id), ...onDisk])].filter((id) => ID.test(id));
  if (ids.length === 0) throw errors.notFound("problems");

  const files: Files = {};
  for (const id of ids) {
    const one = unzipSync((await exportProblem(id)).zip);
    for (const [name, data] of Object.entries(one)) files[`problems/${id}/${name}`] = data;
  }
  files["manifest.json"] = strToU8(JSON.stringify({ format: FORMAT, type: "problems", exported_at: new Date().toISOString(), ids }, null, 2) + "\n");

  const stamp = new Date().toISOString().slice(0, 10);
  return { filename: `codolympics-problems-${stamp}.zip`, zip: zipSync(files, { level: 6 }) };
}

export type ProblemImport = {
  id: string;
  version: string | null;
  details: boolean;
  hints: number;
  /** The package arrived with a validation that passed, so it is not re-run. */
  validated: boolean;
  /** A hacking package: no testcases, so validation does not apply to it. */
  hackOnly: boolean;
  /** It was published here, because it was live where the zip was made. */
  live: boolean;
  warnings: string[];
};

const NOISE = /(^|\/)(__MACOSX\/|\.DS_Store$|Thumbs\.db$)/;

/**
 * A bundle holds `problems/<id>/…`; anything else is a single problem. Split
 * here rather than teaching the single importer about bundles, so one problem
 * is imported by exactly the same code either way.
 */
export async function importProblems(
  actorId: string,
  zip: Uint8Array,
  input: { id?: string; reason: string; goLive?: boolean },
): Promise<ProblemImport[]> {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(zip);
  } catch {
    throw errors.invalid("that is not a valid zip file");
  }

  const dirs = [
    ...new Set(
      Object.keys(files)
        .filter((n) => !NOISE.test(n) && n.startsWith("problems/") && n.endsWith("/question.json"))
        .map((n) => n.slice(0, n.lastIndexOf("/") + 1)),
    ),
  ].sort();
  if (dirs.length === 0) return [await importProblem(actorId, zip, input)];

  const out: ProblemImport[] = [];
  for (const dir of dirs) {
    const one: Files = {};
    for (const [name, data] of Object.entries(files)) {
      if (name.startsWith(dir) && !NOISE.test(name)) one[name.slice(dir.length)] = data;
    }
    // The id in the bundle path wins over anything typed in the dialog: a
    // bundle is many problems and one typed id cannot name them all.
    out.push(await importProblem(actorId, zipSync(one, { level: 0 }), { reason: input.reason, goLive: input.goLive }));
  }
  return out;
}

/**
 * Import a problem zip: the package becomes a new unpublished version, and the
 * details are written if the zip carries them.
 *
 * A validation that travelled with the package is kept rather than demanded
 * again: re-doing yesterday's work is exactly what an import exists to avoid.
 * It is recorded as having run elsewhere, and every screen that shows it says
 * so, because the one thing a zip cannot carry is how fast this machine is.
 *
 * `goLive` restores what was live where the zip was made -- only during
 * registration, and only for a package whose validation passed.
 */
export async function importProblem(
  actorId: string,
  zip: Uint8Array,
  input: { id?: string; reason: string; goLive?: boolean },
): Promise<ProblemImport> {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(zip);
  } catch {
    throw errors.invalid("that is not a valid zip file");
  }

  const names = Object.keys(files).filter((n) => !n.endsWith("/") && !NOISE.test(n));
  const metaName = names.find((n) => n === "question.json" || n.endsWith("/question.json"));
  const meta = metaName ? (JSON.parse(strFromU8(files[metaName])) as Record<string, unknown>) : null;
  if (meta && typeof meta.format === "number" && meta.format > FORMAT) {
    throw errors.invalid(`that zip was made by a newer version (format ${meta.format})`);
  }

  const id = (input.id ?? (meta?.id as string | undefined) ?? "").trim();
  if (!id) throw errors.invalid("the zip has no id — give one, or export the problem from this app");
  if (!ID.test(id)) throw errors.invalid("problem id: letters, digits, . _ - only");

  // The package may be under package/, or be the whole zip when it was built
  // for the judge by hand. Both are accepted.
  const prefix = names.some((n) => n.startsWith("package/")) ? "package/" : "";
  const pkg: Files = {};
  for (const n of names) {
    if (prefix && !n.startsWith(prefix)) continue;
    const rel = n.slice(prefix.length);
    if (!rel || rel === "question.json" || rel.includes("..")) continue;
    pkg[rel] = files[n];
  }

  const warnings: string[] = [];
  let version: string | null = null;
  let hackOnly = false;
  // validation.json lives inside the version directory, so it travels with the
  // package for free and needs no field of its own.
  let validation: Awaited<ReturnType<typeof stampImportedValidation>> = null;
  if (Object.keys(pkg).length > 0) {
    if (!pkg["problem.json"]) throw errors.invalid("the package has no problem.json at its root");
    ({ version } = await uploadPackage(actorId, { id, zip: zipSync(pkg, { level: 0 }), reason: input.reason }));
    validation = await stampImportedValidation(id, version);
    try {
      hackOnly = Boolean((JSON.parse(strFromU8(pkg["problem.json"])) as { hack_only?: boolean }).hack_only);
    } catch {
      /* uploadPackage already rejected a package whose problem.json will not parse */
    }
  } else {
    warnings.push("No judge package in the zip — the details were imported, but nothing can be judged until one is uploaded.");
  }

  const details = (meta?.details ?? null) as Record<string, unknown> | null;
  let hintCount = 0;
  if (details) {
    const difficulty = String(details.difficulty ?? "");
    if (!(DIFFICULTIES as readonly string[]).includes(difficulty)) throw errors.invalid(`unknown difficulty "${difficulty}"`);
    const rawHints = Array.isArray(details.hints) ? (details.hints as { price?: number; body_md?: string }[]) : [];
    hintCount = rawHints.length;

    await db.transaction(async (tx) => {
      // The auction order is this contest's business: a new problem goes to the
      // end of the running order rather than claiming someone else's slot.
      const [existing] = await tx.select({ order: question.auctionOrder }).from(question).where(eq(question.id, id));
      const order = existing?.order ?? (await tx.select({ id: question.id }).from(question)).length + 1;

      const row = {
        title: String(details.title ?? id),
        difficulty: difficulty as (typeof DIFFICULTIES)[number],
        score: Number(details.score ?? 0),
        basePrice: Number(details.base_price ?? 0),
        statementMd: String(details.statement_md ?? ""),
        sampleCount: Number(details.sample_count ?? 0),
        auctionOrder: order,
        // Carried, not assumed: only a record that actually passed counts.
        validated: Boolean(validation?.ok),
      };
      await tx.insert(question).values({ id, ...row }).onConflictDoUpdate({ target: question.id, set: row });
      await tx.delete(hint).where(eq(hint.questionId, id));
      if (rawHints.length) {
        await tx.insert(hint).values(
          rawHints.map((h, i) => ({ questionId: id, idx: i, price: Number(h.price ?? 0), bodyMd: String(h.body_md ?? "") })),
        );
      }
      await audit(
        { actorId, action: "problem.import", target: id, reason: input.reason, detail: { version, hints: rawHints.length } },
        tx,
      );
    });
  } else {
    warnings.push("No contest details in the zip — add a title, statement and price before this can be auctioned.");
    await audit({ actorId, action: "problem.import", target: id, reason: input.reason, detail: { version, hints: 0 } });
  }

  // What was live where this was exported is worth restoring; what was never
  // proven is not. Publishing mid-contest rejudges, so an import never does it.
  const wasLive = Boolean((meta?.exported_from as { was_live?: boolean } | undefined)?.was_live);
  let live = false;
  if (version && input.goLive && wasLive) {
    const phase = (await getContest()).phase;
    if (phase !== "registration") {
      warnings.push(`Left unpublished: the contest is in ${phase}, and publishing then rejudges. Publish it yourself when you are ready.`);
    } else if (!validation?.ok && !hackOnly) {
      warnings.push(`Left unpublished: nothing in the zip says this package passed validation. Validate it here, then publish.`);
    } else {
      // A hacking package has no testcases for a reference to be right about,
      // so there is no validation to wait for. What proves it is the hacking
      // question's own breaking input, which travels with that question. It
      // still has to go live, or the judge cannot serve it and Section B
      // fails on the first attempt.
      await publishVersion(actorId, { id, version, reason: input.reason, confirmedRejudge: 0 });
      live = true;
    }
  }

  if (version && !live) {
    warnings.push(
      validation?.ok
        ? `Uploaded as ${version}, already validated where it was exported. Publish it when you are ready.`
        : hackOnly
          ? `Uploaded as ${version}. A hacking package has no testcases to validate; publish it when its question is proven.`
          : `Uploaded as ${version}. Validate it, then publish — nothing was published by this import.`,
    );
  }
  return { id, version, details: Boolean(details), hints: hintCount, validated: Boolean(validation?.ok), hackOnly, live, warnings };
}
