import { json, route } from "@/lib/api";
import { currentVersion, markValidated, packagesOnDisk, validateVersion, versionsOf } from "@/lib/problems";
import { requireApiViewer } from "@/lib/session";

export type ValidateAllRow = {
  id: string;
  version: string | null;
  ok: boolean;
  skipped: string | null;
  verdict: string | null;
  passed: number | null;
  testcases: number | null;
  max_time_ms: number | null;
  issues: string[];
};

/**
 * Validate every package that can be validated, one at a time.
 *
 * Sequential on purpose: the judge's concurrency is sized for a contest, and a
 * burst of validations racing real submissions would slow both. A handful of
 * packages takes seconds.
 *
 * A hacking package is skipped -- it has no testcases of its own, so there is
 * nothing for a reference to be right about.
 */
export const POST = route(async () => {
  await requireApiViewer("admin", "evaluator");
  const packages = await packagesOnDisk();
  const rows: ValidateAllRow[] = [];

  for (const p of packages) {
    const version = (await currentVersion(p.problem_id)) ?? (await versionsOf(p.problem_id)).at(-1) ?? null;
    const base: ValidateAllRow = {
      id: p.problem_id, version, ok: false, skipped: null,
      verdict: null, passed: null, testcases: null, max_time_ms: null, issues: [],
    };

    if (p.hack_only) { rows.push({ ...base, skipped: "hacking package — nothing to validate against" }); continue; }
    if (!version) { rows.push({ ...base, skipped: "no version on disk" }); continue; }
    if (!p.has_reference) { rows.push({ ...base, skipped: "no reference solution in the package" }); continue; }

    try {
      const r = await validateVersion(p.problem_id, version);
      await markValidated(p.problem_id, r.ok);
      rows.push({
        ...base, ok: r.ok, verdict: r.reference?.verdict ?? null, passed: r.reference?.passed ?? null,
        testcases: r.testcases, max_time_ms: r.reference?.max_time_ms ?? null, issues: r.issues,
      });
    } catch (err) {
      rows.push({ ...base, issues: [err instanceof Error ? err.message : String(err)] });
    }
  }

  return json({ results: rows });
});
