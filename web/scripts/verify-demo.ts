/**
 * Proves the demo set scores the way its model answers say it does.
 *
 * The auto-graded puzzles go through the app's own scoreAuto; the validator one
 * goes through the real judge, because a validator that does not load scores
 * every entry as unchecked and nothing in the app would notice.
 */
import { PUZZLES } from "./demo-content";
import { distinctEntries, normaliseAnswer, scoreAuto, type Q } from "../src/lib/phase1-puzzles";
import { judge } from "../src/lib/judge";

/**
 * What a right answer is worth. The answer itself comes from the question's own
 * `selfTest`, so there is one copy of it: two copies drift, and the one that
 * drifts is always the one nobody runs.
 */
const EXPECT: Record<string, { want: number; note: string }> = {
  "The next tile": { want: 10, note: "picks '19'" },
  "Who was in the building?": { want: 15, note: "picks Ana's only" },
  "The missing word": { want: 8, note: "'Root', wrong case on purpose" },
  Handshakes: { want: 10, note: "66" },
  "Put the build in order": { want: 12, note: "compile, run, compare, report" },
};
/** And what a wrong answer should get, so a pass is not just "everything scores". */
const WRONG: Record<string, unknown> = {
  "The next tile": 0,
  "Who was in the building?": [0, 1],
  "The missing word": "leaf",
  Handshakes: "144",
  "Put the build in order": [0, 1, 2, 3],
};

async function main() {
  let bad = 0;
  for (const p of PUZZLES) {
    const q = { ...p, id: 0, config: p.config ?? {}, answerKey: (p as { answerKey?: unknown }).answerKey ?? null } as unknown as Q;

    if (p.grading === "auto") {
      const e = EXPECT[p.title];
      const intended = (p as { selfTest?: { answer?: unknown } }).selfTest?.answer;
      const got = scoreAuto(q, normaliseAnswer(q, intended));
      const wrong = scoreAuto(q, normaliseAnswer(q, WRONG[p.title]));
      const ok = got === e.want && wrong < e.want;
      if (!ok) bad++;
      console.log(`${ok ? "ok  " : "FAIL"} ${p.title.padEnd(34)} right=${got}/${e.want} wrong=${wrong}  (${e.note})`);
      continue;
    }

    if (p.grading === "validator") {
      const entries = distinctEntries(q, ["1", "2", "3", "4", "6", "9", "12", "18", "36", "5", "36", "banana", "12 18"]);
      const { job_id } = await judge.validateAnswers({ validator: p.validatorPy!, entries, submission_id: "demo-verify" });
      type Answers = { status: string; results: { valid: boolean; error: string | null }[] };
      let result: Answers | null = null;
      for (let i = 0; i < 60 && !result; i++) {
        const job = await judge.job<Answers>(job_id);
        if (job.state === "done" && job.result) result = job.result;
        else await new Promise((r) => setTimeout(r, 500));
      }
      if (!result || result.status === "IE") {
        console.log(`FAIL ${p.title} — validator did not run: ${JSON.stringify(result)}`);
        bad++;
        continue;
      }
      const valid = result.results.filter((r) => r.valid).length;
      const score = valid * (p.pointsPerEntry ?? 0);
      const ok = valid === 9 && score === p.points;
      if (!ok) bad++;
      console.log(`${ok ? "ok  " : "FAIL"} ${p.title.padEnd(34)} ${valid}/9 factors accepted, score ${score}/${p.points}`);
      const finished: Answers = result;
      entries.forEach((e, i) => {
        const r = finished.results[i];
        if (!r.valid) console.log(`       rejected ${JSON.stringify(e).padEnd(10)} ${r.error}`);
      });
      continue;
    }

    console.log(`ok   ${p.title.padEnd(34)} marked by an evaluator (${p.points} + ${p.explainPoints} reasoning)`);
  }
  console.log(bad === 0 ? "\nEVERY PUZZLE SCORES AS ITS MODEL ANSWER SAYS" : `\n${bad} PROBLEM(S)`);
  process.exit(bad === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
