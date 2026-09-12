/**
 * Nothing secret reaches a participant (NFR-B-05, NFR-F-04, NFR-P-03).
 * These are the "view" functions every participant-facing route goes
 * through; if a field is not in the output here, it is not in the response.
 */
import { describe, expect, it } from "vitest";

import { participantAttempt, participantHackQuestion } from "@/lib/phase1-hacking";
import { participantQuestion } from "@/lib/phase1-puzzles";
import { participantView } from "@/lib/submissions";

describe("participant views", () => {
  it("a judgement never carries jury_detail", () => {
    const view = participantView({
      id: 1, submissionId: 1, state: "done", jobId: "j", verdict: "WA", passed: 3, total: 10, firstFail: 3, maxTimeMs: 12,
      maxMemoryKb: 100, compileOutput: "", message: "wrong answer on test 3", juryDetail: "token 2: expected '41', got '39'",
      problemVersion: "v1", progressDone: 4, progressTotal: 10, attempt: 1, retries: 0, cancelled: false, supersededAt: null,
      createdAt: new Date(), endedAt: new Date(),
    });
    expect(JSON.stringify(view)).not.toContain("41");
    expect(JSON.stringify(view)).not.toMatch(/jury/i);
    expect(view.first_fail).toBe(3); // the number is fine; the contents are not
  });

  it("a puzzle never carries its answer key, validator or model answer", () => {
    const view = participantQuestion({
      id: 1, title: "Crack the password", bodyMd: "...", category: "constraint", kind: "set", grading: "validator", points: 10,
      explainPoints: 0, orderIndex: 0, published: true, voided: false, config: {}, answerKey: { members: ["SECRET"] },
      modelAnswer: "MODEL", validatorPy: "def check(e): return True", pointsPerEntry: 1, maxEntries: 100,
      formatRegex: "^\\d{4}$", formatHint: "four digits", ready: true,
    });
    const s = JSON.stringify(view);
    expect(s).not.toContain("SECRET");
    expect(s).not.toContain("MODEL");
    expect(s).not.toContain("def check");
    expect(view.format_hint).toBe("four digits"); // format IS shared; correctness is not
  });

  it("a hacking question carries the given solution but nothing else executable", () => {
    const view = participantHackQuestion({
      id: 1, title: "t", statementMd: "s", constraintsMd: "c", problemId: "hack-01", givenSource: "int main(){}", givenLanguage: "cpp",
      hackPoints: 20, failPenalty: 0, orderIndex: 0, published: true, voided: false, ready: true,
    });
    expect(view.given_source).toBe("int main(){}");
    expect(JSON.stringify(view)).not.toContain("problem_id"); // the judge package id is internal
  });

  it("a hack attempt never carries the verdict", () => {
    const view = participantAttempt({
      id: 1, participantId: "p", questionId: 1, input: "1 2", state: "done", jobId: "j", validInput: true, invalidReason: null,
      hacked: true, verdict: "TLE", pointsAwarded: 20, retries: 0, createdAt: new Date(), endedAt: new Date(),
    });
    expect(JSON.stringify(view)).not.toContain("TLE");
    expect(view.hacked).toBe(true);
  });
});
