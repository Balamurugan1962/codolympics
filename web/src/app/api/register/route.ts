import { z } from "zod";

import { body, json, route } from "@/lib/api";
import { registerParticipant } from "@/lib/registration";

const Body = z.object({
  username: z.string().min(2).max(32),
  password: z.string().min(8).max(128),
  preferred_language: z.string().max(32).optional(),
});

/** US-B1-01: self-registration in the hall. The client signs in afterwards. */
export const POST = route(async (req) => {
  const b = await body(req, Body);
  const id = await registerParticipant({ username: b.username, password: b.password, preferredLanguage: b.preferred_language });
  return json({ id }, { status: 201 });
});
