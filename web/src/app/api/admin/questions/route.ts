import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { DIFFICULTIES, hint, question } from "@/db/schema";
import { body, json, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { requireApiViewer } from "@/lib/session";

export const GET = route(async () => {
  await requireApiViewer("admin");
  const qs = await db.select().from(question).orderBy(asc(question.auctionOrder), asc(question.id));
  const hs = await db.select().from(hint).orderBy(asc(hint.questionId), asc(hint.idx));
  return json({ questions: qs.map((q) => ({ ...q, hints: hs.filter((h) => h.questionId === q.id) })) });
});

const Upsert = z.object({
  id: z.string().regex(/^[A-Za-z0-9._-]+$/),
  title: z.string().min(1).max(200),
  difficulty: z.enum(DIFFICULTIES),
  score: z.number().int().min(0),
  base_price: z.number().int().min(0),
  statement_md: z.string().max(200_000),
  sample_count: z.number().int().min(0).max(20),
  auction_order: z.number().int().min(0),
  hints: z.array(z.object({ price: z.number().int().min(0), body_md: z.string().max(20_000) })).max(20),
  reason: z.string().min(3),
});

/** Create or update the contest-facing side of a question: form fields, not the judge package. */
export const POST = route(async (req) => {
  const viewer = await requireApiViewer("admin");
  const b = await body(req, Upsert);
  await db.transaction(async (tx) => {
    await tx
      .insert(question)
      .values({ id: b.id, title: b.title, difficulty: b.difficulty, score: b.score, basePrice: b.base_price, statementMd: b.statement_md, sampleCount: b.sample_count, auctionOrder: b.auction_order })
      .onConflictDoUpdate({ target: question.id, set: { title: b.title, difficulty: b.difficulty, score: b.score, basePrice: b.base_price, statementMd: b.statement_md, sampleCount: b.sample_count, auctionOrder: b.auction_order } });
    await tx.delete(hint).where(eq(hint.questionId, b.id));
    if (b.hints.length) await tx.insert(hint).values(b.hints.map((h, i) => ({ questionId: b.id, idx: i, price: h.price, bodyMd: h.body_md })));
    await audit({ actorId: viewer.id, action: "question.upsert", target: b.id, reason: b.reason, detail: { title: b.title, hints: b.hints.length } }, tx);
  });
  return json({ ok: true });
});
