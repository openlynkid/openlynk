# Delivery Report — robots.txt route (issue #15)

Outcome:               done
Item:                  GitHub issue #15 (label `autopilot`) — the App Router served no
                       `robots.txt`, so crawlers defaulted to indexing the whole site,
                       including the authenticated surface.
Acceptance criteria:
  - `src/app/robots.ts` exports the App Router `MetadataRoute.Robots` shape → met
  - `rules` allows `/` → met (`allow: "/"`, wildcard user agent)
  - `rules` disallows `/dashboard`, `/login`, `/register` → met (all three emitted)
  - `sitemap` is set and points at the app's site origin → met
    (`${NEXT_PUBLIC_APP_URL}/sitemap.xml`)
  - the origin is not a literal hostname (env-only, per the `trustedOrigins` rule in
    `AGENTS.md`) → met; guarded by a test that rejects `https?://` in the source
  - the route is registered by the build → met (`○ /robots.txt` in the build route table)
  - non-goals: no `src/app/sitemap.ts` (the issue asked only for the `sitemap` field on
    the robots route), no middleware/`next.config.ts` change, no auth or billing change
Mode sequence run:     planning → backend → qa → review → delivery-lead
Files changed:
  - `src/app/robots.ts` (new) — emits `MetadataRoute.Robots`: wildcard user agent,
    `allow: "/"`, `disallow: ["/dashboard", "/login", "/register"]`, and
    `sitemap: ${siteOrigin}/sitemap.xml` where `siteOrigin` is `env.NEXT_PUBLIC_APP_URL`
    with trailing slashes stripped.
  - `tests/robots-route.test.ts` (new) — source-guard test in the style of
    `tests/root-error-boundaries.test.ts`: asserts the allow/deny split, the env-derived
    sitemap origin with no `//sitemap.xml`, and the absence of a literal hostname.
  - `.agents/MEMORY.md` — D-14 (the origin must come from env, not a literal).
  - `.agents/TASKS.md` — item moved to Done.
  - `.agents/rooms/robots-route/REPORT.md` (this file).
Verification:
  - `pnpm typecheck` → exit 0
  - `pnpm lint` → exit 0, 0 warnings
  - `pnpm test` → tests 171 / pass 171 / fail 0 / cancelled 0 / skipped 0
  - `pnpm test:integration` → tests 21 / pass 21 / fail 0 / cancelled 0 / skipped 0
    (real PostgreSQL 16, `INTEGRATION_TEST_DATABASE_URL` on database
    `saas_starterkit_test`, `MIDTRANS_SERVER_KEY="SB-Mid-server-test-integration-key-32chars"`)
  - `pnpm build` → exit 0; `/robots.txt` present as a static route
  - emitted body verified, not just the route table —
    `.next/server/app/robots.txt.body` contains:
    `User-Agent: *` / `Allow: /` / `Disallow: /dashboard` / `Disallow: /login` /
    `Disallow: /register` / `Sitemap: http://localhost:3000/sitemap.xml`
  - `pnpm check:deploy-env` → passed (DATABASE_URL, BETTER_AUTH_SECRET,
    MIDTRANS_SERVER_KEY, NEXT_PUBLIC_MIDTRANS_CLIENT_KEY, CRON_SECRET)
Review verdict:        Approve with comments — self-review by the delivery-lead, since the
                       `task` tool is not reachable from this sandbox and the run must not
                       delegate. Findings: the test calls the route function directly and
                       does not exercise Next's file-convention wiring, so it is a
                       shape/source guard, not an end-to-end test; the build's route table
                       and the emitted `.body` file cover the wiring. Noted in the test's
                       doc comment. No Critical or Major findings.
PR:                    #16 https://github.com/iwwwan-io/saas-starterkit/pull/16 — merged
Decisions taken:
  - Read the sitemap origin from the existing validated `env.NEXT_PUBLIC_APP_URL` rather
    than adding a new env var or hardcoding a hostname. `AGENTS.md` forbids a literal
    deployment hostname in `trustedOrigins`, and `MEMORY.md` lists `NEXT_PUBLIC_APP_URL`
    as the "client-side absolute URLs" variable, so this is the conservative reading of
    "the app's site origin".
  - Stripped trailing slashes from the origin before appending `/sitemap.xml`. A
    configured value like `https://app.example.com/` would otherwise emit
    `//sitemap.xml`. Not requested by the issue; conservative, and covered by a test.
  - Added a regression test although the issue asked only for the route file. The repo's
    convention is that a UI/route invariant that still typechecks, lints and builds needs
    a source guard (D-11, `tests/root-error-boundaries.test.ts`), and dropping a
    disallowed route would otherwise fail silently.
  - Did not add `src/app/sitemap.ts`. The issue specified the `sitemap` field pointing at
    `/sitemap.xml`; creating the sitemap itself is a separate, larger item (which public
    routes to enumerate) and is out of this item's scope. Filed as a follow-up.
  - The `robots.txt` sitemap will 404 until that follow-up lands. Accepted: the field is
    what the issue asked for, and a missing sitemap is a no-op for crawlers, not an error.
  - Treated the required review as a self-review and labelled it as such rather than
    claiming an independent `code-reviewer` pass the sandbox cannot run. Honest reporting
    over the appearance of a full pipeline.
Aborted because:       n/a — no abort-list condition was triggered. The change touches no
                       webhook signature, no cron fail-closed path, no deletion guard, no
                       secret, no migration, no `src/components/reui/**`, no price, and no
                       existing test.
Follow-ups filed:      `src/app/sitemap.ts` — enumerate the public routes (`/`, and any
                       future marketing pages) so `/sitemap.xml` resolves. Left in the
                       Backlog of `.agents/TASKS.md`.
