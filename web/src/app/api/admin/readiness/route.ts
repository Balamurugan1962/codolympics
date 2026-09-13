import { count, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { user } from "@/db/auth-schema";
import { p1HackQuestion, p1Question, participant, question } from "@/db/schema";
import { json, route } from "@/lib/api";
import { getContest } from "@/lib/contest";
import { judge } from "@/lib/judge";
import { requireApiViewer } from "@/lib/session";

/**
 * The pre-contest checklist on the admin overview: each item says whether it
 * is done, and where to go to fix it. Computed fresh every time.
 */
export const GET = route(async () => {
  await requireApiViewer("admin");
  const c = await getContest();
  const [problems, qs, puzzles, hacks, people, staff] = await Promise.all([
    judge.problems().catch(() => null),
    db.select().from(question),
    db.select({ n: count(), live: sql<number>`count(*) filter (where ${p1Question.published})::int` }).from(p1Question),
    db.select({ n: count(), live: sql<number>`count(*) filter (where ${p1HackQuestion.published})::int` }).from(p1HackQuestion),
    db.select({ n: count() }).from(participant),
    db.select({ n: count() }).from(user).where(eq(user.role, "evaluator")),
  ]);

  const byId = new Map((problems ?? []).map((p) => [p.problem_id, p]));
  const contestQuestions = qs.filter((q) => !byId.get(q.id)?.hack_only);
  const unvalidated = contestQuestions.filter((q) => !q.validated && !byId.get(q.id)?.validated).map((q) => q.id);
  const missing = qs.filter((q) => !byId.has(q.id)).map((q) => q.id);
  const orphans = (problems ?? []).filter((p) => !p.hack_only && !qs.some((q) => q.id === p.problem_id)).map((p) => p.problem_id);

  const items = [
    { key: "judge", label: "Judge reachable", ok: problems !== null, detail: problems === null ? "the judge is not answering" : `${problems.length} package(s) on disk`, href: "/admin" },
    { key: "problems", label: "Every question has a judge package", ok: missing.length === 0 && qs.length > 0, detail: missing.length ? `missing: ${missing.join(", ")}` : `${qs.length} question(s)`, href: "/admin/problems" },
    { key: "details", label: "Every package has contest details", ok: orphans.length === 0, detail: orphans.length ? `no title/statement yet: ${orphans.join(", ")}` : "titles, statements and prices set", href: "/admin/problems" },
    { key: "validated", label: "Every question validated", ok: unvalidated.length === 0 && contestQuestions.length > 0, detail: unvalidated.length ? `not validated: ${unvalidated.join(", ")}` : contestQuestions.length ? "all passed" : "no questions to validate yet", href: "/admin/problems" },
    { key: "phase1", label: "Phase 1 questions published", ok: puzzles[0].live > 0 && hacks[0].live > 0, detail: `${puzzles[0].live}/${puzzles[0].n} puzzles, ${hacks[0].live}/${hacks[0].n} hacking`, href: "/admin/phase1" },
    { key: "basis", label: "Selection basis announced", ok: c.p1SelectionBasis.trim().length > 0, detail: c.p1SelectionBasis ? "set" : "participants must know how they will be selected before Phase 1", href: "/admin/contest" },
    { key: "evaluators", label: "At least one evaluator", ok: staff[0].n > 0, detail: `${staff[0].n} evaluator(s)`, href: "/admin/staff" },
    { key: "participants", label: "Participants registered", ok: people[0].n > 0, detail: `${people[0].n} registered`, href: "/admin/participants" },
    { key: "registration", label: "Registration closed before Phase 1", ok: !c.registrationOpen || c.phase !== "registration", detail: c.registrationOpen ? (c.phase === "registration" ? "still open — close it before Phase 1" : "still open") : "closed", href: "/admin" },
  ];
  return json({ items, done: items.filter((i) => i.ok).length, total: items.length });
});
