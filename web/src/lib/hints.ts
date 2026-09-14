/**
 * Hints (Epic B6): author-written text, unlocked in order, purchasable in any
 * phase for a question you own. Hidden testcases are never for sale.
 */
import { and, asc, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { hint, hintPurchase, ledger, ownership, participant } from "@/db/schema";

import { errors } from "./api";
import { audit } from "./audit";
import { publish } from "./events";
import { assertNotBlackedOut } from "./powerups";

/** Hints for a question as the owner sees them: bought ones in full, the next one's price only. */
export async function hintsFor(participantId: string, questionId: string) {
  const all = await db.select().from(hint).where(eq(hint.questionId, questionId)).orderBy(asc(hint.idx));
  const bought = await db
    .select({ idx: hintPurchase.hintIdx })
    .from(hintPurchase)
    .where(and(eq(hintPurchase.questionId, questionId), eq(hintPurchase.participantId, participantId)));
  const boughtSet = new Set(bought.map((b) => b.idx));
  const next = all.find((h) => !boughtSet.has(h.idx)) ?? null;
  return {
    total: all.length,
    revealed: all.filter((h) => boughtSet.has(h.idx)).map((h) => ({ idx: h.idx, body_md: h.bodyMd, price: h.price })),
    next: next ? { idx: next.idx, price: next.price } : null,
  };
}

export async function buyHint(participantId: string, questionId: string): Promise<{ idx: number; body_md: string; balance: number }> {
  // Blacked out means blacked out: the overlay is what they see, this is what
  // stops a client that ignores it.
  await assertNotBlackedOut(participantId);
  const result = await db.transaction(async (tx) => {
    const [p] = await tx.select().from(participant).where(eq(participant.userId, participantId)).for("update");
    if (!p) throw errors.forbidden("not a participant");
    const [own] = await tx
      .select()
      .from(ownership)
      .where(and(eq(ownership.questionId, questionId), eq(ownership.participantId, participantId), isNull(ownership.voidedAt)));
    if (!own) throw errors.forbidden("you do not own this question");

    const all = await tx.select().from(hint).where(eq(hint.questionId, questionId)).orderBy(asc(hint.idx));
    const bought = await tx
      .select({ idx: hintPurchase.hintIdx })
      .from(hintPurchase)
      .where(and(eq(hintPurchase.questionId, questionId), eq(hintPurchase.participantId, participantId)));
    const boughtSet = new Set(bought.map((b) => b.idx));
    const next = all.find((h) => !boughtSet.has(h.idx));
    if (!next) throw errors.conflict("no_more_hints", "there are no more hints for this question");
    if (next.price > p.balance) throw errors.conflict("insufficient_balance", `this hint costs ${next.price}; you have ${p.balance}`);

    const balanceAfter = p.balance - next.price;
    await tx.update(participant).set({ balance: balanceAfter }).where(eq(participant.userId, participantId));
    // The primary key makes a double-click a no-op rather than a double charge (US-B6-01).
    await tx.insert(hintPurchase).values({ questionId, hintIdx: next.idx, participantId, pricePaid: next.price });
    await tx.insert(ledger).values({ participantId, delta: -next.price, balanceAfter, reason: "hint", ref: `${questionId}#${next.idx}` });
    await audit({ actorId: participantId, action: "hint.buy", target: `${questionId}#${next.idx}`, reason: "participant purchase", detail: { price: next.price } }, tx);
    return { idx: next.idx, body_md: next.bodyMd, balance: balanceAfter };
  });
  publish("balance", { balance: result.balance }, participantId);
  return result;
}
