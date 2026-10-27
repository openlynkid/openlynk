import "./test-env.ts";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The App Router special files `error.tsx` and `global-error.tsx` have no other guard:
 * delete one and the app still typechecks, lints and builds — an uncaught render error
 * on `/`, `/login` or `/register` simply falls back to Next's built-in error screen
 * instead of the app's own on-brand surface.
 *
 * Scope note: this is a source-presence guard, not a render test. The Node test runner
 * here has no JSX transform and the repo has no DOM harness, so it proves the required
 * props, document shell and affordances are still written, not that they paint.
 * Runtime behaviour is verified by hand (throw in a public route and load it).
 */
const ROOT_ERROR = "src/app/error.tsx";
const GLOBAL_ERROR = "src/app/global-error.tsx";

const read = (file: string) => readFileSync(path.join(repoRoot, file), "utf8");

const must = (source: string, pattern: RegExp, file: string, what: string) => {
  assert.ok(pattern.test(source), `${file}: ${what} is missing (expected ${pattern})`);
};

/** Shared rules for both boundaries, mirroring the acceptance criteria. */
const checkCommon = (file: string) => {
  const source = read(file);

  must(source, /^"use client";/m, file, 'client-component directive ("use client")');
  must(source, /error: Error & \{ digest\?: string \}/, file, "typed error prop");
  must(source, /reset: \(\) => void/, file, "reset prop");
  must(source, /onClick=\{\(\) => reset\(\)\}/, file, "Retry action wired to reset()");
  must(source, /console\.error\(/, file, "console.error logging");
  must(source, /useEffect\(/, file, "error logged from an effect");

  // ReUI conventions: no `transition-all`, no raw palette color for a state.
  assert.doesNotMatch(source, /transition-all/, `${file}: uses transition-all`);
  assert.doesNotMatch(
    source,
    /\b(text|bg|border|ring)-(red|rose|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet)-[0-9]{2,3}\b/,
    `${file}: raw palette color used for a state; use semantic tokens`
  );
};

describe("Root error boundaries (App Router special files)", () => {
  it("src/app/error.tsx exists, is a client component and offers Retry + a way home", () => {
    assert.ok(existsSync(path.join(repoRoot, ROOT_ERROR)), `${ROOT_ERROR} is missing`);
    checkCommon(ROOT_ERROR);

    const source = read(ROOT_ERROR);
    must(source, /href="\/"/, ROOT_ERROR, "link back to /");
  });

  it("src/app/global-error.tsx exists, renders its own document and offers Retry", () => {
    assert.ok(existsSync(path.join(repoRoot, GLOBAL_ERROR)), `${GLOBAL_ERROR} is missing`);
    checkCommon(GLOBAL_ERROR);

    const source = read(GLOBAL_ERROR);
    // global-error replaces the root layout, so it must supply the whole document
    // and its own global styles (Next injects only its own defaults otherwise).
    must(source, /<html\b/, GLOBAL_ERROR, "<html> root element");
    must(source, /<body\b/, GLOBAL_ERROR, "<body> element");
    must(source, /import "\.\/globals\.css"/, GLOBAL_ERROR, "global styles import");
  });

  it("leaves the dashboard boundary and not-found page untouched", () => {
    const dashboard = read("src/app/dashboard/error.tsx");
    const notFound = read("src/app/not-found.tsx");
    must(dashboard, /DashboardError/, "src/app/dashboard/error.tsx", "DashboardError component");
    must(notFound, /NotFound/, "src/app/not-found.tsx", "NotFound component");
  });
});
