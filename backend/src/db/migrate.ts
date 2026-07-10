/**
 * Migration Runner — run with: npm run migrate
 *
 * Applies all pending SQL migrations from src/db/migrations/ in order.
 * To generate a new migration after changing schema.ts: npm run db:generate
 *
 * Safe to run multiple times — already-applied migrations are tracked
 * in a __drizzle_migrations table and skipped.
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDatabasePool } from "./pool.js";

async function main() {
  const pool = createDatabasePool({
    connectionString: process.env.DATABASE_URL ?? "postgresql://localhost:5432/hood_terminal",
    rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true",
  });

  const db = drizzle(pool);

  console.log("Running migrations...");
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
  console.log("Migrations complete.");

  await pool.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
