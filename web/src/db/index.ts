/**
 * The one database connection. Everything server-side imports `db` from here.
 *
 * postgres-js keeps a small pool; one Next.js server process is the whole
 * backend, so this is also the whole pool.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as authSchema from "./auth-schema";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? "postgres://contest:contest@localhost:5432/contest";

// In dev, Next reloads modules; keep one client across reloads.
const globalForDb = globalThis as unknown as { __sql?: ReturnType<typeof postgres> };
const sql = globalForDb.__sql ?? postgres(url, { max: 10 });
if (process.env.NODE_ENV !== "production") globalForDb.__sql = sql;

export const db = drizzle(sql, { schema: { ...schema, ...authSchema } });
export type Db = typeof db;
export { sql };
