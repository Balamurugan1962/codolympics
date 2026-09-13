import { z } from "zod";

import { body, errors, json, route } from "@/lib/api";
import { markValidated, publishVersion, samplesFor, validateVersion } from "@/lib/problems";
import { requireApiViewer } from "@/lib/session";
import { submissionCount } from "@/lib/submissions";

type Ctx = { params: Promise<{ id: string; action: string }> };

/**
 * Evaluators may prove a package and preview it; only an administrator makes
 * one live, because publishing mid-contest rejudges submissions that have
 * already been made and can change a verdict someone is relying on.
 */
export const POST = route<Ctx>(async (req, { params }) => {
  const { id, action } = await params;
  const viewer = await requireApiViewer(...(action === "publish" ? (["admin"] as const) : (["admin", "evaluator"] as const)));
  switch (action) {
    case "validate": {
      const b = await body(req, z.object({ version: z.string().regex(/^v\d+$/), reference_source: z.string().optional(), wrong_source: z.string().optional(), language: z.string().optional() }));
      const report = await validateVersion(id, b.version, { reference_source: b.reference_source, wrong_source: b.wrong_source, language: b.language });
      await markValidated(id, report.ok);
      return json(report);
    }
    case "blast-radius":
      return json({ submissions: await submissionCount(id) });
    case "samples": {
      // The administrator's preview: the same first-K testcases the owner will see.
      const b = await body(req, z.object({ version: z.string().regex(/^v\d+$/).optional(), count: z.number().int().min(0).max(20) }));
      return json({ samples: await samplesFor(id, b.count, b.version) });
    }
    case "publish": {
      const b = await body(req, z.object({ version: z.string().regex(/^v\d+$/), reason: z.string().min(3), confirmed_rejudge: z.number().int().min(0) }));
      return json(await publishVersion(viewer.id, { id, version: b.version, reason: b.reason, confirmedRejudge: b.confirmed_rejudge }));
    }
    default:
      throw errors.notFound("action");
  }
});
