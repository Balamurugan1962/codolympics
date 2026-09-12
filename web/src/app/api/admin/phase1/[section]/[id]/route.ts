import { z } from "zod";

import { body, errors, json, route } from "@/lib/api";
import { deletePuzzle, updateHack, updatePuzzle } from "@/lib/phase1-admin";
import { requireApiViewer } from "@/lib/session";

import { Hack, Puzzle, toHackInput, toPuzzleInput } from "../schemas";

type Ctx = { params: Promise<{ section: string; id: string }> };

export const PATCH = route<Ctx>(async (req, { params }) => {
  const viewer = await requireApiViewer("admin");
  const { section, id } = await params;
  if (section === "puzzles") {
    const b = await body(req, Puzzle);
    await updatePuzzle(viewer.id, Number(id), toPuzzleInput(b), b.reason);
    return json({ ok: true });
  }
  if (section === "hacking") {
    const b = await body(req, Hack);
    await updateHack(viewer.id, Number(id), toHackInput(b), b.reason);
    return json({ ok: true });
  }
  throw errors.notFound("section");
});

export const DELETE = route<Ctx>(async (req, { params }) => {
  const viewer = await requireApiViewer("admin");
  const { section, id } = await params;
  const { reason } = await body(req, z.object({ reason: z.string().min(3) }));
  if (section !== "puzzles") throw errors.notFound("section");
  await deletePuzzle(viewer.id, Number(id), reason);
  return json({ ok: true });
});
