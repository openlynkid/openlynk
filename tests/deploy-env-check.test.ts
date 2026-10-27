import "./test-env.ts";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkDeployEnv,
  REQUIRED_KEYS,
  CONDITIONAL_KEYS,
  GATEWAY_FLAG_KEYS,
  EXCLUDED_KEYS,
} from "../scripts/check-deploy-env.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scriptPath = path.join(repoRoot, "scripts", "check-deploy-env.mjs");

/** A complete, valid deploy environment used as the base for negative cases. */
const validEnv: Record<string, string | undefined> = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  BETTER_AUTH_SECRET: "a".repeat(32),
  MIDTRANS_SERVER_KEY: "SB-Mid-server-valid",
  NEXT_PUBLIC_MIDTRANS_CLIENT_KEY: "SB-Mid-client-valid",
  MIDTRANS_IS_PRODUCTION: "false",
  NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION: "false",
};

/**
 * `checkDeployEnv` is plain JS, so its default parameter widens to Node's `ProcessEnv`,
 * which demands NODE_ENV. Crafted environments are deliberately partial, so go through a
 * typed wrapper rather than casting at every call site.
 */
const check = (env: Record<string, string | undefined>) =>
  checkDeployEnv(env as NodeJS.ProcessEnv);

describe("Deploy environment contract", () => {
  it("accepts a complete environment without CRON_SECRET (unscheduled deployment)", () => {
    assert.deepEqual(check({ ...validEnv }), []);
  });

  it("accepts a complete environment with CRON_SECRET", () => {
    assert.deepEqual(check({ ...validEnv, CRON_SECRET: "c".repeat(32) }), []);
  });

  it("requires every MIDTRANS key so a webhook cannot fail in production", () => {
    for (const key of ["MIDTRANS_SERVER_KEY", "NEXT_PUBLIC_MIDTRANS_CLIENT_KEY"]) {
      const env = { ...validEnv };
      delete env[key];
      const problems = check(env);
      assert.equal(problems.length, 1, `${key} should be the only problem`);
      assert.match(problems[0], new RegExp(`^${key} is required`));
    }
  });

  it("rejects a non-postgres DATABASE_URL", () => {
    const problems = check({ ...validEnv, DATABASE_URL: "mysql://localhost/db" });
    assert.equal(problems.length, 1);
    assert.match(problems[0], /^DATABASE_URL is set but invalid/);
  });

  it("rejects a BETTER_AUTH_SECRET shorter than 32 characters", () => {
    const problems = check({ ...validEnv, BETTER_AUTH_SECRET: "short" });
    assert.equal(problems.length, 1);
    assert.match(problems[0], /^BETTER_AUTH_SECRET is set but invalid/);
  });

  it("rejects a CRON_SECRET that is set but too short", () => {
    const problems = check({ ...validEnv, CRON_SECRET: "short" });
    assert.equal(problems.length, 1);
    assert.match(problems[0], /^CRON_SECRET is set but invalid/);
  });

  it("treats a blank CRON_SECRET as absent, not as an error", () => {
    assert.deepEqual(check({ ...validEnv, CRON_SECRET: "" }), []);
    assert.deepEqual(check({ ...validEnv, CRON_SECRET: "   " }), []);
  });

  it("demands CRON_SECRET when REQUIRE_CRON_SECRET=true", () => {
    const problems = check({ ...validEnv, REQUIRE_CRON_SECRET: "true" });
    assert.equal(problems.length, 1);
    assert.match(problems[0], /^CRON_SECRET is required when REQUIRE_CRON_SECRET=true/);
  });

  it("still validates a present CRON_SECRET when REQUIRE_CRON_SECRET=true", () => {
    const problems = check({
      ...validEnv,
      REQUIRE_CRON_SECRET: "true",
      CRON_SECRET: "short",
    });
    assert.equal(problems.length, 1);
    assert.match(problems[0], /^CRON_SECRET is set but invalid/);
  });

  it("rejects server and client gateway flags that disagree", () => {
    const problems = check({
      ...validEnv,
      MIDTRANS_IS_PRODUCTION: "true",
      NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION: "false",
    });
    assert.equal(problems.length, 1);
    assert.match(problems[0], /must agree/);
  });

  it("accepts omitted gateway flags (sandbox default)", () => {
    const env = { ...validEnv };
    delete env.MIDTRANS_IS_PRODUCTION;
    delete env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION;
    assert.deepEqual(check(env), []);
  });
});

describe("Deploy environment check — real process behaviour", () => {
  function run(env: Record<string, string | undefined>) {
    try {
      const stdout = execFileSync(process.execPath, [scriptPath], {
        // Only PATH is inherited, so the child sees exactly the environment under test.
        env: { PATH: process.env.PATH ?? "", ...env } as unknown as NodeJS.ProcessEnv,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      return { status: 0, stdout };
    } catch (error) {
      const err = error as { status?: number; stdout?: string; stderr?: string };
      return { status: err.status ?? 1, stdout: `${err.stdout ?? ""}${err.stderr ?? ""}` };
    }
  }

  it("exits 0 on a valid environment", () => {
    const result = run(validEnv);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /check passed/);
  });

  it("exits 1 and names the missing key without printing any value", () => {
    const env = { ...validEnv, BETTER_AUTH_SECRET: "" };
    const result = run(env);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /BETTER_AUTH_SECRET is required/);
    assert.doesNotMatch(result.stdout, /SB-Mid-server-valid/);
  });

  it("exits 1 when a real CI run forgets the cron secret", () => {
    const result = run({ ...validEnv, REQUIRE_CRON_SECRET: "true" });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /CRON_SECRET is required when REQUIRE_CRON_SECRET=true/);
  });
});

/**
 * Anti-drift guard. The script duplicates a few key names so it can run without loading
 * the app; this test fails the moment the two disagree, so the duplication cannot rot.
 */
describe("Deploy environment contract stays in sync with the app", () => {
  const knownKeys = new Set([
    ...REQUIRED_KEYS,
    ...CONDITIONAL_KEYS,
    ...GATEWAY_FLAG_KEYS,
    ...EXCLUDED_KEYS,
  ]);

  function collectSourceFiles(dir: string): string[] {
    const entries = readdirSync(dir);
    const files: string[] = [];
    for (const entry of entries) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        files.push(...collectSourceFiles(full));
      } else if (/\.(ts|tsx)$/.test(entry)) {
        files.push(full);
      }
    }
    return files;
  }

  it("accounts for every env var read anywhere in src/", () => {
    const srcDir = path.join(repoRoot, "src");
    const reads = new Set<string>();

    for (const file of collectSourceFiles(srcDir)) {
      const content = readFileSync(file, "utf8");
      for (const match of content.matchAll(/process\.env\.([A-Z_][A-Z0-9_]*)/g)) {
        reads.add(match[1]);
      }
      // Also catch dynamic access, e.g. process.env[key] inside a loop.
      for (const match of content.matchAll(/process\.env\[([^\]]+)\]/g)) {
        const inner = match[1].replace(/["'`]/g, "").trim();
        if (/^[A-Z_][A-Z0-9_]*$/.test(inner)) reads.add(inner);
      }
    }

    assert.ok(reads.size > 0, "the scan should find env reads; otherwise it proves nothing");

    const unaccounted = [...reads].filter((key) => !knownKeys.has(key)).sort();
    assert.deepEqual(
      unaccounted,
      [],
      `These env vars are read by src/ but missing from the deploy contract. Add each to ` +
        `REQUIRED_KEYS, CONDITIONAL_KEYS, GATEWAY_FLAG_KEYS, or EXCLUDED_KEYS in scripts/check-deploy-env.mjs: ${unaccounted.join(", ")}`
    );
  });

  it("validates CRON_SECRET, the one env var that previously escaped the build", () => {
    const envSource = readFileSync(path.join(repoRoot, "src", "env.ts"), "utf8");
    assert.match(envSource, /CRON_SECRET/);
    assert.ok(CONDITIONAL_KEYS.includes("CRON_SECRET"));
  });
});
