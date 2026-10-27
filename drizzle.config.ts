import { defineConfig } from "drizzle-kit";

// Ensure local env files are loaded for drizzle-kit CLI commands
if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(".env");
  } catch {}
  try {
    process.loadEnvFile(".env.local");
  } catch {}
}

export default defineConfig({
  schema: "./src/server/db/schema/index.ts",
  out: "./src/server/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "",
  },
  verbose: true,
  strict: true,
});
