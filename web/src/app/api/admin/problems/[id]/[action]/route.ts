import { z } from "zod";

import { body, errors, json, route } from "@/lib/api";
import { markValidated, publishVersion, validateVersion } from "@/lib/problems";
import { requireApiViewer } from "@/lib/session";
import { submissionCount } from "@/lib/submissions";

type Ctx = { params: Promise<{ id: string; action: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const viewer = await requireApiViewer("admin");
  const { id, action } = await params;
  switch (action) {
    case "validate": {
      const b = await body(req, z.object({ version: z.string().regex(/^v\d+$/), reference_source: z.string().optional(), wrong_source: z.string().optional(), language: z.string().optional() }));
      const report = await validateVersion(id, b.version, { reference_source: b.reference_source, wrong_source: b.wrong_source, language: b.language });
      await markValidated(id, report.ok);
      return json(report);
    }
    case "blast-radius":
      return json({ submissions: await submissionCount(id) });
    case "publish": {
      const b = await body(req, z.object({ version: z.string().regex(/^v\d+$/), reason: z.string().min(3), confirmed_rejudge: z.number().int().min(0) }));
      return json(await publishVersion(viewer.id, { id, version: b.version, reason: b.reason, confirmedRejudge: b.confirmed_rejudge }));
    }
    default:
      throw errors.notFound("action");
  }
});
