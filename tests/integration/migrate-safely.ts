import postgres from "postgres";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as schema from "../../src/server/db/schema/index.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_FOLDER = path.resolve(__dirname, "../../src/server/db/migrations");

// Arbitrary, integration-only. Every run of these suites against the same database
// serializes on this key.
const MIGRATION_ADVISORY_LOCK_KEY = 918_273_645;

type Db = PostgresJsDatabase<typeof schema>;

/**
 * Apply Drizzle migrations under a PostgreSQL advisory lock.
 *
 * The two integration files run concurrently against the same disposable database and
 * each used to call `migrate()` unguarded, so on a fresh database they raced to CREATE
 * the same tables and the loser failed with `relation "account" already exists`. The
 * lock makes the second caller wait, then find the migration journal already up to date
 * and apply nothing.
 *
 * The lock is held on a dedicated single-connection client and released before that
 * client closes. If the process dies mid-migration the session ends and PostgreSQL drops
 * the lock automatically, so a crashed run cannot deadlock the next one.
 */
export async function migrateUnderLock(db: Db, connectionString: string): Promise<void> {
  const lockClient = postgres(connectionString, { max: 1, prepare: false });
  try {
    await lockClient`SELECT pg_advisory_lock(${MIGRATION_ADVISORY_LOCK_KEY}::bigint)`;
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await lockClient`SELECT pg_advisory_unlock(${MIGRATION_ADVISORY_LOCK_KEY}::bigint)`.catch(() => {});
    await lockClient.end({ timeout: 1 }).catch(() => {});
  }
}
