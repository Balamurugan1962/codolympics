"use client";

/**
 * Look inside a problem package before it leaves the browser. The server
 * does the same checks again on upload (lib/problems.ts); this just tells
 * the author what they are about to send, and catches the obvious
 * mistakes — a missing problem.json, a checker that is not there — before
 * a round trip.
 */
import { unzipSync } from "fflate";

export type ProblemJson = {
  time_limit_ms?: number; memory_limit_mb?: number; compare?: string; early_exit?: boolean; float_tolerance?: number;
  hack_only?: boolean; reference?: { language?: string; file?: string };
};

export type PackageInspection = {
  files: string[];
  strippedFolder: string | null;
  problem: ProblemJson | null;
  tests: { name: string; hasAnswer: boolean }[];
  testcases: number;
  hasChecker: boolean;
  hasValidator: boolean;
  reference: { language: string; file: string; present: boolean } | null;
  samples: { input: string; output: string }[];
  issues: string[];    // the server will reject these
  warnings: string[];  // worth a look
};

const decoder = new TextDecoder();

export async function inspectPackage(file: File, sampleCount = 3): Promise<PackageInspection> {
  const issues: string[] = [];
  const warnings: string[] = [];
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
  } catch {
    return { files: [], strippedFolder: null, problem: null, tests: [], testcases: 0, hasChecker: false, hasValidator: false, reference: null, samples: [], issues: ["This is not a valid zip file."], warnings };
  }

  const raw = Object.keys(entries).filter((n) => !n.endsWith("/") && !n.includes("__MACOSX") && !n.split("/").pop()!.startsWith("."));
  if (raw.length === 0) issues.push("The zip is empty.");

  // A single top-level folder is stripped, exactly as the server does it.
  const tops = new Set(raw.map((n) => n.split("/")[0]));
  const strip = tops.size === 1 && raw.every((n) => n.includes("/")) ? `${[...tops][0]}/` : "";
  const rel = (n: string) => (strip && n.startsWith(strip) ? n.slice(strip.length) : n);
  const files = raw.map(rel).sort();
  const get = (r: string) => { const k = raw.find((n) => rel(n) === r); return k ? entries[k] : undefined; };

  let problem: ProblemJson | null = null;
  const pj = get("problem.json");
  if (!pj) issues.push("There is no problem.json at the root of the package.");
  else {
    try { problem = JSON.parse(decoder.decode(pj)) as ProblemJson; }
    catch { issues.push("problem.json is not valid JSON."); }
  }

  const inputs = files.filter((f) => /^tests\/[^/]+\.in$/.test(f));
  const tests = inputs.map((f) => {
    const stem = f.slice("tests/".length, -".in".length);
    return { name: stem, hasAnswer: files.includes(`tests/${stem}.ans`) || files.includes(`tests/${stem}.out`) };
  }).sort((a, b) => a.name.localeCompare(b.name));
  const unanswered = tests.filter((t) => !t.hasAnswer);
  if (unanswered.length) warnings.push(`${unanswered.length} testcase${unanswered.length === 1 ? " has" : "s have"} no .ans/.out file: ${unanswered.slice(0, 3).map((t) => t.name).join(", ")}${unanswered.length > 3 ? "…" : ""}.`);
  if (tests.length > 1 && new Set(tests.map((t) => t.name.length)).size > 1) warnings.push("Testcase names are not zero-padded; the judge orders them lexically, so 10 will run before 2.");

  const hasChecker = files.includes("checker.py");
  const hasValidator = files.includes("validator.py");
  if (problem) {
    if (problem.compare === "checker" && !hasChecker) issues.push("compare is \"checker\" but there is no checker.py.");
    if (typeof problem.time_limit_ms !== "number") warnings.push("problem.json has no time_limit_ms; the judge's default applies.");
    if (typeof problem.memory_limit_mb !== "number") warnings.push("problem.json has no memory_limit_mb; the judge's default applies.");
    if (problem.hack_only && !hasValidator) warnings.push("A hacking problem without validator.py accepts any input as valid. Every submitted input counts.");
    if (problem.hack_only && !problem.reference) issues.push("A hacking problem needs a stored reference solution (\"reference\" in problem.json).");
    if (!problem.hack_only && tests.length === 0) issues.push("There are no testcases under tests/.");
  }

  let reference: PackageInspection["reference"] = null;
  if (problem?.reference?.file) {
    const present = files.includes(problem.reference.file);
    reference = { language: problem.reference.language ?? "?", file: problem.reference.file, present };
    if (!present) issues.push(`The reference solution ${problem.reference.file} named in problem.json is not in the package.`);
  }

  const samples: PackageInspection["samples"] = [];
  for (const t of tests.slice(0, sampleCount)) {
    const inp = get(`tests/${t.name}.in`);
    const ans = get(`tests/${t.name}.ans`) ?? get(`tests/${t.name}.out`);
    if (!inp) break;
    samples.push({ input: clip(decoder.decode(inp)), output: ans ? clip(decoder.decode(ans)) : "" });
  }

  return { files, strippedFolder: strip ? strip.slice(0, -1) : null, problem, tests, testcases: tests.length, hasChecker, hasValidator, reference, samples, issues, warnings };
}

function clip(s: string, max = 4000): string {
  return s.length > max ? `${s.slice(0, max)}\n… (${s.length - max} more characters)` : s;
}
