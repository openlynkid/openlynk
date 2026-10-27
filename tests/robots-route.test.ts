import "./test-env.ts";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import robots from "../src/app/robots.ts";
import { env } from "../src/env.ts";

/**
 * `src/app/robots.ts` has no other guard: delete it or drop a disallowed route and the
 * app still typechecks, lints and builds, while the default "index everything" quietly
 * exposes the authenticated surface. This asserts the emitted Robots object keeps the
 * allow/deny split, and that the sitemap origin is derived from env rather than a
 * literal hostname.
 *
 * Scope note: source-presence plus a direct call of the route function — the Node test
 * runner here has no JSX transform and no DOM harness, so this proves the shape is still
 * written, not that Next serves it. The route is exercised end to end by `pnpm build`.
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(path.join(repoRoot, "src/app/robots.ts"), "utf8");

const AUTHENTICATED_ROUTES = ["/dashboard", "/login", "/register"];

describe("robots.txt route (src/app/robots.ts)", () => {
  it("returns a single wildcard rule that allows the public site", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;

    assert.equal(rules.userAgent, "*");
    assert.equal(rules.allow, "/");
  });

  it("disallows every authenticated route", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    const disallow = Array.isArray(rules.disallow) ? rules.disallow : [rules.disallow];

    for (const route of AUTHENTICATED_ROUTES) {
      assert.ok(
        disallow.includes(route),
        `disallow list is missing ${route} (got ${JSON.stringify(disallow)})`
      );
    }
  });

  it("points the sitemap at the env-derived origin, with no double slash", () => {
    const result = robots();
    const expectedOrigin = env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");

    assert.equal(result.sitemap, `${expectedOrigin}/sitemap.xml`);
    assert.ok(!/\/\/sitemap\.xml/.test(result.sitemap ?? ""), "sitemap URL has a double slash");
  });

  it("does not hardcode a deployment hostname", () => {
    assert.ok(
      !/https?:\/\//.test(source),
      "robots.ts must derive its origin from env, not a literal hostname"
    );
  });
});
