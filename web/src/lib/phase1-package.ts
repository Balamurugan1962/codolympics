/**
 * Phase 1 questions as portable zips.
 *
 * Phase 2 problems arrive as a package built outside the app. Phase 1 questions
 * are the other way round: they are written *in* the app, and the zip is what
 * you get out of it — so an author can build a set on one machine, keep it in a
 * repository, and import it into the contest install on the day.
 *
 * The format is deliberately plain. `question.json` is the whole question, and
 * the two things that are really files — a validator script, a given solution —
 * are written out as files so they can be diffed, reviewed and edited in an
 * editor rather than escaped inside JSON.
 *
 *   puzzle.zip     question.json, validator.py?
 *   hack.zip       question.json, given.<ext>
 *   a set          manifest.json, puzzles/<slug>/…, hacking/<slug>/…
 *
 * What a hacking question does NOT carry is its judge package: the reference
 * solution, the tests and the limits live on the judge and are moved with the
 * Problems export. Importing a hack whose package is missing is allowed and
 * lands as a draft — the question is still worth keeping — and the import says
 * which package it is waiting for.
 */
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

import { db } from "@/db";
import { p1HackQuestion, p1Question, P1_CATEGORIES, P1_GRADING, P1_KINDS } from "@/db/schema";
import { asc, eq, inArray } from "drizzle-orm";

import { errors } from "./api";
import { getContest } from "./contest";
import { carryVerification, createHack, createPuzzle, publishHack, publishPuzzle } from "./phase1-admin";

/** Bumped only for a change that an older importer could not read. */
const FORMAT = 1;

export type Section = "puzzles" | "hacking";

const EXTENSION: Record<string, string> = {
  cpp: "cpp", c: "c", python: "py", pypy: "py", java: "java", javascript: "js", typescript: "ts", go: "go", rust: "rs", kotlin: "kt",
};

/** A filename that survives every filesystem and still says which question it is. */
function slug(title: string, id: number): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${String(id).padStart(3, "0")}-${base || "question"}`;
}

const json = (v: unknown) => strToU8(JSON.stringify(v, null, 2) + "\n");

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

type Files = Record<string, Uint8Array>;

/**
 * One puzzle as files.
 *
 * `voided` and `orderIndex` are left out: they describe this question's place
 * in this contest rather than the question. Two things that look like state do
 * travel, because they are work rather than circumstance — whether the
 * self-test passed, and whether it was live — and an import that threw them
 * away would mean proving and publishing the whole set again the next morning.
 * Both are labelled as second-hand where they land; see `carryVerification`.
 */
function puzzleFiles(q: typeof p1Question.$inferSelect): Files {
  const files: Files = {};
  const doc: Record<string, unknown> = {
    format: FORMAT,
    type: "puzzle",
    title: q.title,
    body_md: q.bodyMd,
    category: q.category,
    kind: q.kind,
    grading: q.grading,
    points: q.points,
    explain_points: q.explainPoints,
    config: q.config,
    answer_key: q.answerKey,
    model_answer: q.modelAnswer,
    points_per_entry: q.pointsPerEntry,
    max_entries: q.maxEntries,
    format_regex: q.formatRegex,
    format_hint: q.formatHint,
    verified: q.ready,
    was_published: q.published,
  };
  if (q.validatorPy) {
    doc.validator_file = "validator.py";
    files["validator.py"] = strToU8(q.validatorPy);
  }
  files["question.json"] = json(doc);
  return files;
}

function hackFiles(q: typeof p1HackQuestion.$inferSelect): Files {
  const name = `given.${EXTENSION[q.givenLanguage] ?? "txt"}`;
  return {
    "question.json": json({
      format: FORMAT,
      type: "hack",
      title: q.title,
      statement_md: q.statementMd,
      constraints_md: q.constraintsMd,
      problem_id: q.problemId,
      given_language: q.givenLanguage,
      given_file: name,
      hack_points: q.hackPoints,
      fail_penalty: q.failPenalty,
      verified: q.ready,
      was_published: q.published,
      // The input that proves the given solution breaks. It is an answer, so a
      // zip carrying it is a zip to keep as carefully as the answer keys that
      // are already in here.
      breaking_input: q.breakingInput,
    }),
    [name]: strToU8(q.givenSource),
  };
}

/** One question, as a zip whose root is the question itself. */
export async function exportOne(section: Section, id: number): Promise<{ filename: string; zip: Uint8Array }> {
  if (section === "puzzles") {
    const [q] = await db.select().from(p1Question).where(eq(p1Question.id, id));
    if (!q) throw errors.notFound("question");
    return { filename: `${slug(q.title, q.id)}.zip`, zip: zipSync(puzzleFiles(q), { level: 6 }) };
  }
  const [q] = await db.select().from(p1HackQuestion).where(eq(p1HackQuestion.id, id));
  if (!q) throw errors.notFound("question");
  return { filename: `${slug(q.title, q.id)}.zip`, zip: zipSync(hackFiles(q), { level: 6 }) };
}

/** A whole section, or both, as one zip with a manifest. */
export async function exportMany(sections: Section[]): Promise<{ filename: string; zip: Uint8Array }> {
  const files: Files = {};
  const manifest: { format: number; exported_at: string; puzzles: string[]; hacking: string[] } = {
    format: FORMAT,
    exported_at: new Date().toISOString(),
    puzzles: [],
    hacking: [],
  };

  if (sections.includes("puzzles")) {
    const rows = await db.select().from(p1Question).orderBy(asc(p1Question.orderIndex), asc(p1Question.id));
    for (const q of rows) {
      const dir = `puzzles/${slug(q.title, q.id)}`;
      manifest.puzzles.push(dir);
      for (const [name, data] of Object.entries(puzzleFiles(q))) files[`${dir}/${name}`] = data;
    }
  }
  if (sections.includes("hacking")) {
    const rows = await db.select().from(p1HackQuestion).orderBy(asc(p1HackQuestion.orderIndex), asc(p1HackQuestion.id));
    for (const q of rows) {
      const dir = `hacking/${slug(q.title, q.id)}`;
      manifest.hacking.push(dir);
      for (const [name, data] of Object.entries(hackFiles(q))) files[`${dir}/${name}`] = data;
    }
  }

  files["manifest.json"] = json(manifest);
  const stamp = new Date().toISOString().slice(0, 10);
  const what = sections.length === 1 ? sections[0] : "phase1";
  return { filename: `codolympics-${what}-${stamp}.zip`, zip: zipSync(files, { level: 6 }) };
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export type ImportResult = {
  created: { section: Section; id: number; title: string; verified: boolean; published: boolean }[];
  /** Arrived proven, so the self-test and the hack proof are not asked for again. */
  verified: number;
  /** The ones that did not, by title — someone here still has to prove these. */
  unverified: string[];
  /** Published here, because they were live where the zip was made. */
  published: number;
  /** Hacking questions whose judge package is not on this install. */
  missingPackages: { title: string; problem_id: string }[];
  skipped: { path: string; why: string }[];
};

/** Zips made on a Mac carry these; they are not part of anyone's question. */
const NOISE = /(^|\/)(__MACOSX\/|\.DS_Store$|Thumbs\.db$)/;

function read(files: Record<string, Uint8Array>, path: string): string | null {
  const f = files[path];
  return f ? strFromU8(f) : null;
}

/** Every directory that holds a question.json, whatever the zip's shape. */
function questionDirs(files: Record<string, Uint8Array>): string[] {
  return Object.keys(files)
    .filter((n) => !NOISE.test(n) && n.endsWith("question.json"))
    .map((n) => n.slice(0, -"question.json".length))
    .sort();
}

/**
 * Import every question in a zip.
 *
 * A question that was proven where it was exported arrives proven, marked as
 * having been proven elsewhere. Without `goLive` each still lands as a draft:
 * a set someone hands you is not a set to put in front of participants
 * unlooked-at. `goLive` is for the other case — your own setup, coming back —
 * and even then it only restores what was live and only during registration.
 */
export async function importPackage(
  actorId: string,
  zip: Uint8Array,
  reason: string,
  knownProblemIds: Set<string>,
  opts: { goLive?: boolean } = {},
): Promise<ImportResult> {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(zip);
  } catch {
    throw errors.invalid("that is not a valid zip file");
  }

  const dirs = questionDirs(files);
  if (dirs.length === 0) throw errors.invalid("no question.json in the zip — export one from this page to see the shape");

  const out: ImportResult = { created: [], verified: 0, unverified: [], published: 0, missingPackages: [], skipped: [] };
  // Restoring what was live is only safe before anyone is looking: publishing
  // into a running section changes what participants see mid-round.
  const goLive = Boolean(opts.goLive) && (await getContest()).phase === "registration";

  for (const dir of dirs) {
    const raw = read(files, `${dir}question.json`);
    let doc: Record<string, unknown>;
    try {
      doc = JSON.parse(raw ?? "");
    } catch {
      out.skipped.push({ path: `${dir}question.json`, why: "not valid JSON" });
      continue;
    }
    if (typeof doc.format === "number" && doc.format > FORMAT) {
      out.skipped.push({ path: dir || "question.json", why: `made by a newer version (format ${doc.format})` });
      continue;
    }

    try {
      if (doc.type === "hack") {
        const givenName = String(doc.given_file ?? "");
        const source = givenName ? read(files, `${dir}${givenName}`) : null;
        if (source === null) throw new Error(`the given solution (${givenName || "given_file"}) is missing from the zip`);
        const problemId = String(doc.problem_id ?? "");
        const id = await createHack(
          actorId,
          {
            title: String(doc.title ?? "Untitled"),
            statementMd: String(doc.statement_md ?? ""),
            constraintsMd: String(doc.constraints_md ?? ""),
            problemId,
            givenSource: source,
            givenLanguage: String(doc.given_language ?? "cpp"),
            hackPoints: Number(doc.hack_points ?? 0),
            failPenalty: Number(doc.fail_penalty ?? 0),
            orderIndex: 0,
          },
          reason,
        );
        const title = String(doc.title ?? "Untitled");
        const entry = { section: "hacking" as const, id, title, verified: false, published: false };
        out.created.push(entry);
        if (!problemId || !knownProblemIds.has(problemId)) {
          // A proof is about a package. With none on this install there is
          // nothing here that could break, so readiness cannot carry either.
          out.missingPackages.push({ title, problem_id: problemId });
        } else if (doc.verified === true) {
          await carryVerification("hacking", id, { breakingInput: doc.breaking_input == null ? null : String(doc.breaking_input) });
          entry.verified = true;
          out.verified += 1;
          if (goLive && doc.was_published === true) {
            await publishHack(actorId, id, true, reason);
            entry.published = true;
            out.published += 1;
          }
        } else {
          out.unverified.push(title);
        }
      } else {
        const validatorName = doc.validator_file ? String(doc.validator_file) : null;
        const validator = validatorName ? read(files, `${dir}${validatorName}`) : null;
        if (validatorName && validator === null) throw new Error(`the validator (${validatorName}) is missing from the zip`);

        const kind = String(doc.kind ?? "");
        const category = String(doc.category ?? "");
        const grading = String(doc.grading ?? "");
        if (!(P1_KINDS as readonly string[]).includes(kind)) throw new Error(`unknown kind "${kind}"`);
        if (!(P1_CATEGORIES as readonly string[]).includes(category)) throw new Error(`unknown category "${category}"`);
        if (!(P1_GRADING as readonly string[]).includes(grading)) throw new Error(`unknown grading "${grading}"`);

        const id = await createPuzzle(
          actorId,
          {
            title: String(doc.title ?? "Untitled"),
            bodyMd: String(doc.body_md ?? ""),
            category: category as (typeof P1_CATEGORIES)[number],
            kind: kind as (typeof P1_KINDS)[number],
            grading: grading as (typeof P1_GRADING)[number],
            points: Number(doc.points ?? 0),
            explainPoints: Number(doc.explain_points ?? 0),
            orderIndex: 0,
            config: (doc.config ?? {}) as never,
            answerKey: (doc.answer_key ?? null) as never,
            modelAnswer: doc.model_answer == null ? null : String(doc.model_answer),
            validatorPy: validator,
            pointsPerEntry: doc.points_per_entry == null ? null : Number(doc.points_per_entry),
            maxEntries: Number(doc.max_entries ?? 100),
            formatRegex: doc.format_regex == null ? null : String(doc.format_regex),
            formatHint: doc.format_hint == null ? null : String(doc.format_hint),
          },
          reason,
        );
        const entry = { section: "puzzles" as const, id, title: String(doc.title ?? "Untitled"), verified: false, published: false };
        out.created.push(entry);
        if (doc.verified === true) {
          await carryVerification("puzzles", id);
          entry.verified = true;
          out.verified += 1;
          if (goLive && doc.was_published === true) {
            await publishPuzzle(actorId, id, true, reason);
            entry.published = true;
            out.published += 1;
          }
        } else {
          out.unverified.push(entry.title);
        }
      }
    } catch (err) {
      out.skipped.push({ path: dir || "question.json", why: err instanceof Error ? err.message : String(err) });
    }
  }

  if (out.created.length === 0) {
    throw errors.invalid(out.skipped[0] ? `nothing could be imported: ${out.skipped[0].why}` : "nothing to import");
  }
  return out;
}

export { inArray };
