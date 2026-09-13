import { z } from "zod";

import { body, errors, json, route } from "@/lib/api";
import { publishHack, publishPuzzle, testHack, testPuzzle, voidHack, voidPuzzle } from "@/lib/phase1-admin";
import { requireApiViewer } from "@/lib/session";

type Ctx = { params: Promise<{ section: string; id: string; action: string }> };

/** test | publish | unpublish | void, for either section. */
export const POST = route<Ctx>(async (req, { params }) => {
  const { section, id: raw, action } = await params;
  // Evaluators author and self-test; putting a question in front of
  // participants, or taking it away again, is the administrator's call.
  const viewer = await requireApiViewer(...(action === "test" ? (["admin", "evaluator"] as const) : (["admin"] as const)));
  const id = Number(raw);
  const puzzles = section === "puzzles";
  if (!puzzles && section !== "hacking") throw errors.notFound("section");

  switch (action) {
    case "test": {
      if (puzzles) {
        const b = await body(req, z.object({ answer: z.unknown().optional(), should_pass: z.array(z.string()).optional(), should_fail: z.array(z.string()).optional() }));
        return json(await testPuzzle(id, { answer: b.answer, shouldPass: b.should_pass, shouldFail: b.should_fail }));
      }
      const b = await body(req, z.object({ breaking_input: z.string().max(262_144) }));
      return json(await testHack(id, b.breaking_input));
    }
    case "publish":
    case "unpublish": {
      const { reason } = await body(req, z.object({ reason: z.string().min(3) }));
      if (puzzles) await publishPuzzle(viewer.id, id, action === "publish", reason);
      else await publishHack(viewer.id, id, action === "publish", reason);
      return json({ ok: true });
    }
    case "void": {
      const { reason } = await body(req, z.object({ reason: z.string().min(3) }));
      if (puzzles) await voidPuzzle(viewer.id, id, reason);
      else await voidHack(viewer.id, id, reason);
      return json({ ok: true });
    }
    default:
      throw errors.notFound("action");
  }
});
