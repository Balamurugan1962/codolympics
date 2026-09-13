import { z } from "zod";

import { participantsOverview } from "@/lib/admin";
import { body, json, route } from "@/lib/api";
import { createParticipant } from "@/lib/registration";
import { requireApiViewer } from "@/lib/session";

const Body = z.object({
  username: z.string().min(2).max(32),
  password: z.string().min(8).max(128),
  preferred_language: z.string().max(32).nullish(),
  reason: z.string().min(3),
});

/** Balances, ownership counts and the "owns nothing" flag (US-B4-03). */
export const GET = route(async () => {
  await requireApiViewer("admin");
  return json({ participants: await participantsOverview() });
});

/**
 * Add a participant by hand. Self-registration is the normal path (POST
 * /api/register); this is the organiser's repair for when it did not work.
 */
export const POST = route(async (req) => {
  const viewer = await requireApiViewer("admin");
  const b = await body(req, Body);
  const id = await createParticipant(viewer.id, {
    username: b.username,
    password: b.password,
    preferredLanguage: b.preferred_language ?? null,
    reason: b.reason,
  });
  return json({ id }, { status: 201 });
});
