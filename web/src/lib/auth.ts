/**
 * Better Auth configuration (decision 63).
 *
 * Sessions are database-backed, which is what makes them revocable -- the
 * single-session rule for participants (US-B1-03) is a `DELETE`, not a
 * denylist. Works with no internet: nothing here calls out.
 *
 * Three roles, one per account (decision 61j): participant, evaluator, admin.
 */
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { admin, username } from "better-auth/plugins";
import { and, eq, ne } from "drizzle-orm";

import { db } from "@/db";
import * as authSchema from "@/db/auth-schema";

export const ROLES = ["participant", "evaluator", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema: authSchema }),

  // Participants sign in by display name. There is no mail server in the
  // hall, so the required email is synthetic -- see register().
  emailAndPassword: { enabled: true, minPasswordLength: 8, requireEmailVerification: false },
  plugins: [
    username({ minUsernameLength: 2, maxUsernameLength: 32 }),
    admin({ defaultRole: "participant", adminRoles: ["admin"] }),
  ],

  session: {
    expiresIn: 60 * 60 * 24,      // a contest day
    updateAge: 60 * 15,
  },

  // Per-IP. Stops a bored participant guessing a neighbour's password without
  // getting in the way of anyone typing theirs. Every kiosk has its own IP.
  rateLimit: {
    enabled: true,
    window: 10,
    max: 100,
    customRules: {
      "/sign-in/username": { window: 10, max: 10 },
      "/sign-up/email": { window: 60, max: 30 },
    },
  },

  user: {
    additionalFields: {
      // What language they expect to code in, captured at registration so an
      // unsupported one is discovered early (US-B1-01).
      preferredLanguage: { type: "string", required: false, input: true },
    },
  },

  databaseHooks: {
    session: {
      create: {
        after: async (session) => {
          // One active session per PARTICIPANT account (US-B1-03, decision 53c):
          // signing in somewhere new kills the old session. A second window
          // would otherwise double submission throughput on a contest that
          // tie-breaks on who got there first.
          //
          // Evaluators and administrators are exempt (decision 61k) -- an
          // organiser legitimately sits at two machines.
          const [user] = await db
            .select({ role: authSchema.user.role })
            .from(authSchema.user)
            .where(eq(authSchema.user.id, session.userId));
          if (user?.role !== "participant") return;
          await db
            .delete(authSchema.session)
            .where(and(eq(authSchema.session.userId, session.userId), ne(authSchema.session.id, session.id)));
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;

/** The synthetic email a username maps to. Never used for mail. */
export function syntheticEmail(usernameValue: string): string {
  return `${usernameValue.toLowerCase()}@contest.local`;
}
