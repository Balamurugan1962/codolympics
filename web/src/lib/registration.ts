/**
 * Accounts: participant self-registration, the first administrator, and
 * evaluator accounts an administrator creates (US-B1-01, US-P1-01).
 */
import { count, eq } from "drizzle-orm";

import { db } from "@/db";
import { user } from "@/db/auth-schema";
import { ledger, participant } from "@/db/schema";

import { ApiError, errors } from "./api";
import { audit } from "./audit";
import { auth, syntheticEmail, type Role } from "./auth";
import { getContest } from "./contest";

const USERNAME = /^[A-Za-z0-9_][A-Za-z0-9_ .-]{1,31}$/;

/** Create the user through Better Auth so the password is hashed its way. */
async function createUser(username: string, password: string, extra: Record<string, unknown> = {}) {
  username = username.trim();
  if (!USERNAME.test(username)) throw errors.invalid("display name: 2–32 letters, digits, spaces, _ . -");
  if (password.length < 8) throw errors.invalid("password: at least 8 characters");
  try {
    const result = await auth.api.signUpEmail({
      body: {
        email: syntheticEmail(username.replace(/\s+/g, "_")),
        name: username,
        password,
        username: username.replace(/\s+/g, "_").toLowerCase(),
        displayUsername: username,
        ...extra,
      } as never,
    });
    return result.user;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/already|exists|unique|taken/i.test(message)) {
      throw errors.conflict("name_taken", "that display name is already registered; pick another");
    }
    throw errors.invalid(message);
  }
}

/** A participant registering at their machine in the hall. Returns the user id. */
export async function registerParticipant(input: {
  username: string;
  password: string;
  preferredLanguage?: string;
}): Promise<string> {
  const c = await getContest();
  if (!c.registrationOpen || c.phase !== "registration") {
    throw errors.conflict("registration_closed", "registration is closed");
  }

  const created = await createUser(input.username, input.password, {
    preferredLanguage: input.preferredLanguage ?? null,
  });

  // Everyone starts with the identical configured balance (US-B1-01).
  await db.transaction(async (tx) => {
    await tx.update(user).set({ role: "participant" }).where(eq(user.id, created.id));
    await tx.insert(participant).values({
      userId: created.id,
      balance: c.startingBalance,
      preferredLanguage: input.preferredLanguage ?? null,
    });
    await tx.insert(ledger).values({
      participantId: created.id,
      delta: c.startingBalance,
      balanceAfter: c.startingBalance,
      reason: "starting_balance",
    });
  });
  return created.id;
}

/** An administrator creating an evaluator or another administrator. */
export async function createStaff(
  actorId: string,
  input: { username: string; password: string; role: Exclude<Role, "participant">; reason: string },
): Promise<string> {
  const created = await createUser(input.username, input.password);
  await db.transaction(async (tx) => {
    await tx.update(user).set({ role: input.role }).where(eq(user.id, created.id));
    await audit({ actorId, action: "staff.create", target: created.id, reason: input.reason, detail: { role: input.role, username: input.username } }, tx);
  });
  return created.id;
}

/**
 * First start: if no administrator exists and ADMIN_PASSWORD is set, create
 * one. Never a seeded default password -- an unset variable means no admin.
 */
export async function ensureAdmin(): Promise<void> {
  const [{ admins }] = await db.select({ admins: count() }).from(user).where(eq(user.role, "admin"));
  if (admins > 0) return;
  const username = process.env.ADMIN_USERNAME ?? "admin";
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    console.warn("[contest] no administrator exists and ADMIN_PASSWORD is not set; set it and restart");
    return;
  }
  try {
    const created = await createUser(username, password);
    await db.update(user).set({ role: "admin" }).where(eq(user.id, created.id));
    console.log(`[contest] created administrator '${username}'`);
  } catch (err) {
    if (err instanceof ApiError) console.warn(`[contest] could not create administrator: ${err.message}`);
    else throw err;
  }
}
