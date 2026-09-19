/**
 * Better Auth's database connection -- the only thing in the web app that
 * touches Postgres. It reads and writes the identity tables (user, session,
 * account) to sign people in and out. Everything else belongs to the engine.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as authSchema from "./auth-schema";

const url = process.env.DATABASE_URL ?? "postgres://contest:contest@localhost:5432/contest";

// In dev, Next reloads modules; keep one client across reloads.
const globalForDb = globalThis as unknown as { __sql?: ReturnType<typeof postgres> };
const sql = globalForDb.__sql ?? postgres(url, { max: 5 });
if (process.env.NODE_ENV !== "production") globalForDb.__sql = sql;

export const db = drizzle(sql, { schema: authSchema });
export type Db = typeof db;
export { sql };
