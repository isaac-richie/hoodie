/**
 * Database Client — Drizzle ORM instance backed by a pg connection pool.
 *
 * Import `db` from here for all database operations. The pool manages
 * up to 20 concurrent connections (configurable). Drizzle provides
 * type-safe queries based on the schema defined in schema.ts.
 *
 * Usage: db.select().from(tokens).where(eq(tokens.id, address))
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "../config/env.js";
import { createDatabasePool } from "./pool.js";
import * as schema from "./schema.js";

const pool = createDatabasePool({
  connectionString: env.databaseUrl,
  rejectUnauthorized: env.databaseSslRejectUnauthorized,
  max: 20,
});

export const db = drizzle(pool, { schema });
