/** Pure scoring logic for Section A (US-P5-01) and the bid ladder (US-B3-01). */
import { describe, expect, it } from "vitest";

import { nextBidAmount } from "@/lib/auction";
import { distinctEntries, normaliseAnswer, scoreAuto, type Q } from "@/lib/phase1-puzzles";

function q(over: Partial<Q>): Q {
  return {
    id: 1, title: "t", bodyMd: "", category: "pattern", kind: "fill_blank", grading: "auto", points: 10, explainPoints: 0,
    orderIndex: 0, published: true, voided: false, config: {}, answerKey: null, modelAnswer: null, validatorPy: null,
    pointsPerEntry: null, maxEntries: 100, formatRegex: null, formatHint: null, ready: true, ...over,
  } as Q;
}

describe("bid ladder", () => {
  it("first bid is the base price, then exactly one increment each", () => {
    expect(nextBidAmount(null, 100, 10)).toBe(100);
    expect(nextBidAmount(100, 100, 10)).toBe(110);
    expect(nextBidAmount(370, 100, 10)).toBe(380);
  });
});

describe("scoreAuto", () => {
  it("mcq_single: exact option", () => {
    const x = q({ kind: "mcq_single", config: { options: ["a", "b", "c"] }, answerKey: { option: 1 } });
    expect(scoreAuto(x, 1)).toBe(10);
    expect(scoreAuto(x, 0)).toBe(0);
  });

  it("mcq_multi: all-or-nothing by default, per-option with partial credit", () => {
    const x = q({ kind: "mcq_multi", config: { options: ["a", "b", "c", "d"] }, answerKey: { options: [0, 2] } });
    expect(scoreAuto(x, [0, 2])).toBe(10);
    expect(scoreAuto(x, [0])).toBe(0);
    const partial = q({ ...x, config: { options: ["a", "b", "c", "d"], partialCredit: true } });
    expect(scoreAuto(partial, [0])).toBe(5);        // one of two correct
    expect(scoreAuto(partial, [0, 1])).toBe(0);     // one right, one wrong cancels
    expect(scoreAuto(partial, [0, 2, 3])).toBe(5);  // two right, one wrong
  });

  it("fill_blank: accepted spellings, whitespace and case folded", () => {
    const x = q({ kind: "fill_blank", answerKey: { accepted: ["Bala", "Balamurugan"] } });
    expect(scoreAuto(x, "  bala ")).toBe(10);
    expect(scoreAuto(x, "BALAMURUGAN")).toBe(10);
    expect(scoreAuto(x, "Charan")).toBe(0);
    const strict = q({ ...x, config: { caseSensitive: true } });
    expect(scoreAuto(strict, "bala")).toBe(0);
  });

  it("numeric: within tolerance", () => {
    const x = q({ kind: "numeric", config: { tolerance: 0.01 }, answerKey: { value: 41 } });
    expect(scoreAuto(x, "41")).toBe(10);
    expect(scoreAuto(x, "41.005")).toBe(10);
    expect(scoreAuto(x, "42")).toBe(0);
  });

  it("sequence: exact order", () => {
    const x = q({ kind: "sequence", config: { items: ["Coding", "Quiz", "Debate"] }, answerKey: { order: [0, 2, 1] } });
    expect(scoreAuto(x, [0, 2, 1])).toBe(10);
    expect(scoreAuto(x, [0, 1, 2])).toBe(0);
  });

  it("set: unordered, normalised, partial credit optional", () => {
    const x = q({ kind: "set", answerKey: { members: ["Arun", "Bala"] } });
    expect(scoreAuto(x, ["bala", " ARUN"])).toBe(10);
    expect(scoreAuto(x, ["Arun"])).toBe(0);
    const partial = q({ ...x, config: { partialCredit: true } });
    expect(scoreAuto(partial, ["Arun"])).toBe(5);
    expect(scoreAuto(partial, ["Arun", "Deepak"])).toBe(0);
  });

  it("long_text is never auto-scored", () => {
    expect(scoreAuto(q({ kind: "long_text" }), "anything")).toBe(0);
  });
});

describe("normaliseAnswer enforces shape server-side", () => {
  it("rejects an option index out of range", () => {
    const x = q({ kind: "mcq_single", config: { options: ["a", "b"] } });
    expect(() => normaliseAnswer(x, 5)).toThrow();
    expect(normaliseAnswer(x, "1")).toBe(1);
  });

  it("applies the format regex even if the client skipped it", () => {
    const x = q({ kind: "fill_blank", formatRegex: "^\\d{4}$", formatHint: "four digits" });
    expect(() => normaliseAnswer(x, "12a4")).toThrow(/four digits/);
    expect(normaliseAnswer(x, " 1234 ")).toBe("1234");
  });

  it("caps set entries at max_entries", () => {
    const x = q({ kind: "set", maxEntries: 2 });
    expect(normaliseAnswer(x, ["a", "b", "c"])).toEqual(["a", "b"]);
  });

  it("requires every sequence item exactly once", () => {
    const x = q({ kind: "sequence", config: { items: ["a", "b", "c"] } });
    expect(() => normaliseAnswer(x, [0, 0, 1])).toThrow();
    expect(normaliseAnswer(x, [2, 0, 1])).toEqual([2, 0, 1]);
  });
});

describe("distinctEntries for validator scoring", () => {
  it("collapses whitespace and case unless case-sensitive, and caps", () => {
    const x = q({ kind: "set", maxEntries: 3 });
    expect(distinctEntries(x, ["5239", " 5239", "5239 ", "abc", "ABC", "9821"])).toEqual(["5239", "abc", "9821"]);
    const strict = q({ kind: "set", config: { caseSensitive: true } });
    expect(distinctEntries(strict, ["abc", "ABC"])).toEqual(["abc", "ABC"]);
  });
});
