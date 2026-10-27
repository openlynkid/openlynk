import "./test-env.ts";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sitemap from "../src/app/sitemap.ts";
import robots from "../src/app/robots.ts";
import {
  PUBLIC_ROUTES,
  PRIVATE_ROUTES,
  INDEXABLE_DYNAMIC_ROUTES,
  getSiteOrigin,
} from "../src/lib/seo.ts";

/**
 * `src/app/sitemap.ts` has no other guard: delete it and the `Sitemap:` line in
 * `robots.txt` points at a 404, and add a public page without listing it and the page is
 * simply never discovered. Both failures are silent — typecheck, lint and build all stay
 * green.
 *
 * Scope note: this is a shape and classification guard, not a render test. It calls the
 * route functions and walks the filesystem; it does not prove Next serves the file. That
 * is covered by `pnpm build` (see the route table and
 * `.next/server/app/sitemap.xml.body`).
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appDir = path.join(repoRoot, "src/app");
const sitemapSource = readFileSync(path.join(repoRoot, "src/app/sitemap.ts"), "utf8");

/** Every route segment that has a `page.tsx`, as an App Router path. */
function pageRoutes(dir: string = appDir, prefix = ""): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      found.push(...pageRoutes(path.join(dir, entry.name), `${prefix}/${entry.name}`));
    } else if (entry.name === "page.tsx") {
      found.push(prefix || "/");
    }
  }
  return found;
}

describe("sitemap.xml route (src/app/sitemap.ts)", () => {
  it("emits one absolute, env-derived URL per public route", () => {
    const origin = getSiteOrigin();
    const entries = sitemap();

    assert.equal(entries.length, PUBLIC_ROUTES.length);
    for (const [i, route] of PUBLIC_ROUTES.entries()) {
      assert.equal(entries[i].url, `${origin}${route}`);
    }
  });

  it("emits no double slash and no literal hostname", () => {
    for (const entry of sitemap()) {
      assert.ok(!/\/\/[^/]/.test(entry.url.replace(/^https?:\/\//, "/")), `double slash in ${entry.url}`);
    }
    assert.ok(
      !/https?:\/\//.test(sitemapSource),
      "sitemap.ts must derive its origin from env, not a literal hostname"
    );
  });

  it("does not list a route that robots.txt disallows", () => {
    const rules = robots().rules;
    const rule = Array.isArray(rules) ? rules[0] : rules;
    const disallow = Array.isArray(rule.disallow) ? rule.disallow : [rule.disallow];

    for (const route of PUBLIC_ROUTES) {
      assert.ok(
        !disallow.includes(route),
        `${route} is in the sitemap but disallowed by robots.txt`
      );
    }
  });

  it("classifies every page in src/app as public, indexable-dynamic or private", () => {
    // The guard that makes this falsifiable: a new page.tsx that is in none of the lists
    // fails here, forcing whoever added it to decide whether it belongs in the sitemap.
    for (const route of pageRoutes()) {
      const isPublic = (PUBLIC_ROUTES as readonly string[]).includes(route);
      const isPrivate = (PRIVATE_ROUTES as readonly string[]).some(
        (prefix) => route === prefix || route.startsWith(`${prefix}/`)
      );
      const isIndexableDynamic = (INDEXABLE_DYNAMIC_ROUTES as readonly string[]).some(
        (prefix) => route === prefix || route.startsWith(`${prefix}/`)
      );
      assert.ok(
        isPublic || isPrivate || isIndexableDynamic,
        `${route} has a page.tsx but is classified as none of public, indexable-dynamic or private in src/lib/seo.ts`
      );
    }
  });

  it("keeps indexable dynamic routes out of the sitemap and out of the disallow list", () => {
    // `/u/<handle>` cannot be enumerated at build time, but must stay crawlable. If one
    // ever lands in PUBLIC_ROUTES the sitemap would list a route with no page.tsx, and
    // if one lands in PRIVATE_ROUTES every creator page would be de-indexed.
    const rules = robots().rules;
    const rule = Array.isArray(rules) ? rules[0] : rules;
    const disallow: string[] = Array.isArray(rule.disallow)
      ? rule.disallow
      : rule.disallow
        ? [rule.disallow]
        : [];

    for (const prefix of INDEXABLE_DYNAMIC_ROUTES) {
      assert.ok(
        !(PUBLIC_ROUTES as readonly string[]).includes(prefix),
        `${prefix} is indexable-dynamic and must not be in PUBLIC_ROUTES`
      );
      assert.ok(
        !disallow.some((entry) => entry === prefix || entry.startsWith(`${prefix}/`)),
        `${prefix} is indexable-dynamic but robots.txt disallows it`
      );
    }
  });

  it("lists only routes that exist on disk", () => {
    const existing = pageRoutes();
    for (const route of PUBLIC_ROUTES) {
      assert.ok(existing.includes(route), `${route} is in PUBLIC_ROUTES but has no page.tsx`);
    }
  });
});
