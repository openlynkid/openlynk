import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  var __dbClient: postgres.Sql | undefined;
}

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/saas_starterkit";

// Use a singleton pattern for the postgres connection to prevent connection exhaustion in serverless / hot-reload environments
const client =
  globalThis.__dbClient ??
  postgres(connectionString, {
    max: process.env.NODE_ENV === "production" ? 10 : 2,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false, // Required for transaction connection poolers like Supabase PgBouncer or Neon pooling
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__dbClient = client;
}

export const db = drizzle(client, { schema });
export type Database = typeof db;
export * from "./schema";
