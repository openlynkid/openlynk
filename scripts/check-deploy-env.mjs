#!/usr/bin/env node
/**
 * Deploy-time environment contract.
 *
 * Runs before `next build` so a misconfigured deployment fails in CI with a readable
 * message, instead of at the first webhook or cron trigger in production.
 *
 * This is the deploy contract, not a second schema: `src/env.ts` still validates the
 * running app. `tests/deploy-env-check.test.ts` fails if the two drift, so a new env var
 * cannot be read by `src/` without being accounted for here.
 *
 * Never prints a value — only key names — so a secret cannot leak into CI logs.
 */

import { pathToFileURL } from "node:url";

/** Keys a deployment cannot start without. */
export const REQUIRED_KEYS = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "MIDTRANS_SERVER_KEY",
  "NEXT_PUBLIC_MIDTRANS_CLIENT_KEY",
];

/**
 * Validated only when set. `CRON_SECRET` is absent on a deployment that never schedules
 * the expiry sweep; the route fails closed at runtime (D-5), so a missing secret must not
 * block a build. `REQUIRE_CRON_SECRET=true` (set in CI) additionally demands presence, so
 * the scheduled path is proven too.
 */
export const CONDITIONAL_KEYS = ["CRON_SECRET"];

/**
 * Read by `src/` and by this script's gateway-conflict check, but never required: both
 * default to sandbox, and the app validates that the two agree.
 */
export const GATEWAY_FLAG_KEYS = ["MIDTRANS_IS_PRODUCTION", "NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION"];

/** Env vars `src/` reads that are deliberately not part of the deploy contract. */
export const EXCLUDED_KEYS = [
  "NODE_ENV",
  // Injected by Netlify: the managed database URL, the build flag, and the deploy URLs.
  "NETLIFY_DB_URL",
  // Set by Next.js itself; `src/env.ts` only relaxes validation during `next build`.
  "NEXT_PHASE",
  "NETLIFY",
  "URL",
  "DEPLOY_PRIME_URL",
  "BETTER_AUTH_URL",
  "NEXT_PUBLIC_APP_URL",
  "VERCEL_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
];

function isNonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isPostgresUrl(value) {
  if (!isNonEmpty(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "postgres:" || url.protocol === "postgresql:";
  } catch {
    return false;
  }
}

function isLongSecret(value) {
  return isNonEmpty(value) && value.length >= 32;
}

/**
 * Returns a list of human-readable problems. Empty list means the environment is valid.
 * Exported so the test can exercise it directly with crafted environments.
 */
export function checkDeployEnv(env = process.env) {
  const problems = [];

  const validators = {
    DATABASE_URL: { check: isPostgresUrl, hint: "must be a postgres:// or postgresql:// URL" },
    BETTER_AUTH_SECRET: { check: isLongSecret, hint: "must be at least 32 characters" },
    MIDTRANS_SERVER_KEY: { check: isNonEmpty, hint: "must not be empty" },
    NEXT_PUBLIC_MIDTRANS_CLIENT_KEY: { check: isNonEmpty, hint: "must not be empty" },
    CRON_SECRET: { check: isLongSecret, hint: "must be at least 32 characters" },
  };

  for (const key of REQUIRED_KEYS) {
    const { check, hint } = validators[key];
    const value = env[key];
    // Netlify Database supplies the URL itself, so a Netlify deploy needs no DATABASE_URL.
    if (key === "DATABASE_URL" && !isNonEmpty(value) && (isNonEmpty(env.NETLIFY_DB_URL) || env.NETLIFY === "true")) {
      continue;
    }
    if (!isNonEmpty(value)) {
      problems.push(`${key} is required but not set`);
    } else if (!check(value)) {
      problems.push(`${key} is set but invalid (${hint})`);
    }
  }

  const requireCron = env.REQUIRE_CRON_SECRET === "true";
  for (const key of CONDITIONAL_KEYS) {
    const value = env[key];
    if (!isNonEmpty(value)) {
      if (requireCron) problems.push(`${key} is required when REQUIRE_CRON_SECRET=true but not set`);
      continue;
    }
    const { check, hint } = validators[key];
    if (!check(value)) problems.push(`${key} is set but invalid (${hint})`);
  }

  // A server and client that disagree silently route charges to the wrong gateway.
  const serverFlag = env.MIDTRANS_IS_PRODUCTION;
  const clientFlag = env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION;
  const isServerProd = serverFlag === "true";
  const isClientProd = clientFlag === "true";
  if (isServerProd !== isClientProd) {
    problems.push(
      `MIDTRANS_IS_PRODUCTION (${serverFlag ?? "omitted"}) and NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION (${clientFlag ?? "omitted"}) must agree`
    );
  }

  return problems;
}

function main() {
  const problems = checkDeployEnv();

  if (problems.length > 0) {
    console.error("❌ Deploy environment check failed:");
    for (const problem of problems) console.error(`   - ${problem}`);
    console.error(
      "\nSee .env.example for the full list. Set these in the deploy target's environment, not in the repository."
    );
    process.exit(1);
  }

  const checked = [...REQUIRED_KEYS, ...CONDITIONAL_KEYS.filter((key) => isNonEmpty(process.env[key]))];
  console.log(`✅ Deploy environment check passed (${checked.join(", ")}).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
