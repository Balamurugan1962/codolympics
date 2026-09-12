import { asc } from "drizzle-orm";

import { db } from "@/db";
import { p1HackQuestion, p1Question } from "@/db/schema";
import { body, errors, json, route } from "@/lib/api";
import { createHack, createPuzzle } from "@/lib/phase1-admin";
import { requireApiViewer } from "@/lib/session";

import { Hack, Puzzle, toHackInput, toPuzzleInput } from "./schemas";

type Ctx = { params: Promise<{ section: string }> };

/** All questions in a section, with secrets -- administrators only. */
export const GET = route<Ctx>(async (_req, { params }) => {
  await requireApiViewer("admin");
  const { section } = await params;
  if (section === "puzzles") return json({ questions: await db.select().from(p1Question).orderBy(asc(p1Question.orderIndex), asc(p1Question.id)) });
  if (section === "hacking") return json({ questions: await db.select().from(p1HackQuestion).orderBy(asc(p1HackQuestion.orderIndex), asc(p1HackQuestion.id)) });
  throw errors.notFound("section");
});

export const POST = route<Ctx>(async (req, { params }) => {
  const viewer = await requireApiViewer("admin");
  const { section } = await params;
  if (section === "puzzles") {
    const b = await body(req, Puzzle);
    return json({ id: await createPuzzle(viewer.id, toPuzzleInput(b), b.reason) }, { status: 201 });
  }
  if (section === "hacking") {
    const b = await body(req, Hack);
    return json({ id: await createHack(viewer.id, toHackInput(b), b.reason) }, { status: 201 });
  }
  throw errors.notFound("section");
});

