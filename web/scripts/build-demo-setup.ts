/**
 * Builds the demo setup zip.
 *
 * Runs against a scratch database and a scratch problems volume, seeds the
 * content from demo-content.ts through the app's own functions, then exports
 * with the app's own exporter. Going through the real code paths rather than
 * hand-writing a zip is the point: if the format changes, this breaks loudly
 * instead of producing a file that no longer imports.
 *
 *   DATABASE_URL=postgres://…/contest_seed \
 *   PROBLEMS_DIR=/tmp/seed-problems \
 *   pnpm tsx scripts/build-demo-setup.ts out.zip
 */
import { eq } from "drizzle-orm";
import { zipSync, strToU8 } from "fflate";
import fs from "node:fs/promises";
import path from "node:path";

import { db } from "../src/db";
import { contest, hint, question } from "../src/db/schema";
import { createHack, createPuzzle } from "../src/lib/phase1-admin";
import { uploadPackage } from "../src/lib/problems";
import { createStaff } from "../src/lib/registration";
import { exportSetup } from "../src/lib/setup-package";

import { HACKS, PROBLEMS, PUZZLES, SETTINGS } from "./demo-content";

const ACTOR = "seed";

/** Testcases are numbered so they sort in the order they were written. */
function packageFor(p: (typeof PROBLEMS)[number]): Uint8Array {
  const files: Record<string, Uint8Array> = {
    "problem.json": strToU8(
      JSON.stringify(
        {
          id: p.id,
          time_limit_ms: p.timeLimitMs,
          memory_limit_mb: p.memoryLimitMb,
          compare: "tokens",
          reference: { language: "python", file: "solution.py" },
        },
        null,
        2,
      ) + "\n",
    ),
    "solution.py": strToU8(p.reference),
  };
  p.tests.forEach(([input, answer], i) => {
    const n = String(i + 1).padStart(5, "0");
    files[`tests/${n}.in`] = strToU8(input);
    files[`tests/${n}.ans`] = strToU8(answer);
  });
  return zipSync(files, { level: 6 });
}

/** A hacking package has no testcases of its own: only the reference and the constraints. */
function hackPackageFor(h: (typeof HACKS)[number]): Uint8Array {
  return zipSync(
    {
      "problem.json": strToU8(
        JSON.stringify(
          {
            id: h.problemId,
            time_limit_ms: 2000,
            memory_limit_mb: 256,
            compare: "tokens",
            hack_only: true,
            reference: { language: "python", file: "solution.py" },
          },
          null,
          2,
        ) + "\n",
      ),
      "solution.py": strToU8(h.reference),
      "validator.py": strToU8(h.validator),
    },
    { level: 6 },
  );
}

async function main() {
  const out = process.argv[2];
  if (!out) throw new Error("usage: build-demo-setup.ts <out.zip>");

  const root = path.resolve(process.env.PROBLEMS_DIR ?? "../judge/problems");
  console.log(`seeding into ${root}`);

  // --- settings ----------------------------------------------------------
  await db.insert(contest).values({ id: 1 }).onConflictDoNothing();
  await db.update(contest).set(SETTINGS).where(eq(contest.id, 1));
  console.log("settings set");

  // --- staff -------------------------------------------------------------
  // Passwords are hashed by Better Auth here, which is why the export carries
  // a usable credential rather than a string this script invented.
  await createStaff(ACTOR, { username: "admin", password: "admin12345678", role: "admin", reason: "demo setup" });
  await createStaff(ACTOR, { username: "bala", password: "12345678", role: "evaluator", reason: "demo setup" });
  console.log("staff: admin (administrator), bala (evaluator)");

  // --- Phase 2 problems --------------------------------------------------
  for (const [i, p] of PROBLEMS.entries()) {
    await uploadPackage(ACTOR, { id: p.id, zip: packageFor(p), reason: "demo setup" });
    await db.insert(question).values({
      id: p.id,
      title: p.title,
      difficulty: p.difficulty,
      score: p.score,
      basePrice: p.basePrice,
      statementMd: p.statementMd,
      sampleCount: p.sampleCount,
      auctionOrder: i + 1,
    });
    await db.insert(hint).values(p.hints.map((h, idx) => ({ questionId: p.id, idx, price: h.price, bodyMd: h.bodyMd })));
    console.log(`problem ${p.id}: ${p.tests.length} tests, ${p.hints.length} hints`);
  }

  // --- Phase 1 -----------------------------------------------------------
  for (const q of PUZZLES) {
    const { maxEntriesHint, ...input } = q as typeof q & { maxEntriesHint?: boolean };
    void maxEntriesHint;
    await createPuzzle(ACTOR, input as never, "demo setup");
    console.log(`puzzle: ${q.title} (${q.kind}/${q.grading})`);
  }
  for (const h of HACKS) {
    await uploadPackage(ACTOR, { id: h.problemId, zip: hackPackageFor(h), reason: "demo setup" });
    await createHack(
      ACTOR,
      {
        title: h.title,
        statementMd: h.statementMd,
        constraintsMd: h.constraintsMd,
        problemId: h.problemId,
        givenSource: h.givenSource,
        givenLanguage: h.givenLanguage,
        hackPoints: h.hackPoints,
        failPenalty: h.failPenalty,
        orderIndex: h.orderIndex,
      },
      "demo setup",
    );
    console.log(`hack: ${h.title} (breaks on ${JSON.stringify(h.breakingInput)})`);
  }

  // --- export ------------------------------------------------------------
  const { zip, filename } = await exportSetup(true);
  await fs.writeFile(out, zip);
  console.log(`\nwrote ${out} (${(zip.byteLength / 1024).toFixed(1)} KB, exporter called it ${filename})`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
