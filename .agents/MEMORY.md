# Shared Memory

Durable knowledge for every mode. This is the office's long-term memory: architecture,
decisions, and the traps that are expensive to rediscover. Keep it short and true — a
stale memory is worse than none.

Sources of truth, in order: **the code** → `AGENTS.md` → this file. When they disagree,
fix this file.

## Core architecture

**What this is.** A reusable SaaS starter kit: a production-ready GitHub template for
launching multi-tenant SaaS on Next.js 16, Better Auth, Drizzle, and Midtrans (Indonesian
payments). It is a **modular monolith** — one deployable, but with enforced domain
boundaries so the domains do not tangle.

**Stack.** Next.js 16.4.2 (App Router, RSC, Server Actions, Route Handlers) · TypeScript 5
strict · React 19 · Tailwind CSS v4 · shadcn/ui + ReUI · PostgreSQL + Drizzle ORM/Kit ·
Better Auth 1.7 (email+password, session cookies, organizations plugin) · Midtrans (Snap +
SHA-512 webhooks) · Zod 4 · pnpm 12.14.0 · Node 22.23.1.

**Layering.** Data flows in one direction:

```text
src/app/**        routes, layouts, client components  (no domain logic)
   ↓
src/modules/**    domain logic: billing, account, organization
   ↓
src/server/db/**  Drizzle schema + client + migrations
```

Cross-cutting: `src/env.ts` (Zod-validated env), `src/lib/**` (client auth hooks, `cn`),
`src/server/auth/**` (Better Auth config + org auth helpers).

**Domain modules.**

| Module | Files | Responsibility |
| :--- | :--- | :--- |
| billing | `midtrans-client.ts`, `plans.ts`, `service.ts`, `date-utils.ts`, `types.ts` | pricing, checkout, webhook processing |
| account | `deletion-guard.ts` | blocks unsafe self-serve account deletion |
| organization | `member-management.ts` | role/removal rules mirroring the org plugin |

**Tenancy model.** Every user gets a personal workspace by default; organizations are
optional and multi-tenant. A subscription can belong to **either** a user or an
organization — this is why the deletion guard exists (see invariants below).

## Decision Log

Decisions a future session must not silently reverse. Append new entries; never rewrite
an old one to hide a change.

### D-1: Modular monolith with `src/modules/**` as the domain layer
- Date: 2026-10-26
- Mode: architecture
- Decision: Keep one deployable, but put domain logic in `src/modules/**`, never in route
  handlers or components.
- Why: The repo is a *template* others will build on; boundary drift is the main way such
  templates rot. Route handlers stay thin so the billing/account/org logic stays testable
  without HTTP.
- Rejected: A full monorepo with separate packages — too much ceremony for a starter kit.
- Guard: Unit tests target `src/modules/**` directly (e.g. `tests/billing-lifecycle.test.ts`).

### D-2: `plans.ts` is the single source of truth for price and interval
- Date: 2026-10-26
- Mode: architecture
- Decision: `getPlanAmount` / `isSupportedInterval` / `getPlanDisplay` in
  `src/modules/billing/plans.ts` are the only place a charge is computed.
- Why: A lifetime period sold at the monthly price was a real escalation bug. Pricing UI
  and the charged amount had drifted apart.
- Rejected: Computing the amount inline in the checkout route or the pricing component.
- Guard: `tests/plan-interval-validation.test.ts`, `tests/gross-amount-validation.test.ts`;
  `createCheckoutSession` also validates, covering non-HTTP callers.

### D-3: Account deletion is guarded, and a sole-member org cascades
- Date: 2026-10-26
- Mode: security
- Decision: `beforeDelete` calls `findDeletionBlockers`. Deletion is blocked only while
  the user is a **sole owner with other members remaining**, or the **payer of a live
  plan**. An org whose only member is the deleting user is deleted explicitly and allowed
  to cascade away.
- Why: `order.userId` and `subscription.userId` cascade on user delete, so an unguarded
  delete by a paying member would silently destroy a shared workspace's plan and payment
  history. But no FK links `user` to `organization` (only `member.userId` cascades), so
  without the explicit delete a sole member would strand an org row holding a unique slug.
- Rejected: (a) no guard — data loss; (b) blocking all deletions by owners — traps users
  with no self-serve way out.
- Guard: `tests/account-deletion-guard.test.ts`,
  `tests/integration/account-deletion-guard.test.ts` (cascade safety, 10 scenarios).

### D-4: The deletion guard has a self-serve escape route on the Organizations page
- Date: 2026-10-26
- Mode: backend + frontend
- Decision: A blocked sole owner promotes another member to owner (or removes the others)
  from the members grid, then deletes. `src/modules/organization/member-management.ts`
  mirrors better-auth's organization-plugin guards so the UI only offers actions the
  server accepts.
- Why: The guard's message told users to promote someone, but the page had no role or
  removal actions — a dead end.
- Rejected: UI-only permission rules — they drift from the plugin and offer actions that
  then fail server-side.
- Guard: `tests/organization-member-management.test.ts`,
  `tests/organization-authorization.test.ts`. Keep the module in sync with the plugin.

### D-5: Security-sensitive endpoints fail closed
- Date: 2026-10-26
- Mode: security
- Decision: `/api/billing/cron/sync-expired` returns HTTP 500 and runs nothing when
  `CRON_SECRET` is absent, comparing the bearer token in constant time. `trustedOrigins`
  is built from env only, with no literal hostnames.
- Why: The old "only check when the secret happens to be set" behaviour meant a missing
  env var silently exposed an unauthenticated endpoint.
- Rejected: Warning-and-continue on missing config.
- Guard: `tests/cron-auth.test.ts`.

### D-6: The office runs in autopilot with an abort-and-report policy
- Date: 2026-10-26
- Mode: architecture + security
- Decision: One work item is driven end to end by `delivery-lead` (mode + sub-agent) and
  run under `autopilot`, which collapses the office's per-step handoffs into a single
  Delivery Report. The office never stops to ask: every decision is either *proceed
  silently* (including branch, PR, and merge on a green gate) or *abort the item and
  report*. Autonomy was raised by setting `permission_mode: never_confirm` on the four
  writing sub-agents.
- Why: The roles are what keep this template from rotting (D-1); the problem was the
  per-reply stop and the `confirm_risky` prompt, not the boundaries. Replacing "ask the
  human" with "abort and report" removes the halt without removing the safety property —
  a rail the pipeline never crosses needs no prompt.
- Rejected: (a) a single monolithic agent with no modes — loses the boundaries; (b)
  auto-merge gated on CI alone — CI does not check design-system conformance or invariant
  safety, so the `review` verdict is a second required gate; (c) a third "ask" category —
  it reintroduces the stop this change exists to remove.
- Guard: `.agents/PROTOCOL.md` → autonomy policy (the two lists) and merge gate (the seven
  conditions); `.agents/agents/delivery-lead.md`. The abort list is the only thing standing
  where the confirmation prompt used to be — do not shorten it.

### D-7: Integration suites migrate under an advisory lock, and CI proves it
- Date: 2026-10-26
- Mode: qa + devops
- Decision: Both integration files apply migrations through
  `migrateUnderLock()` (`tests/integration/migrate-safely.ts`), which holds
  `pg_advisory_lock` on a dedicated single-connection client so concurrent files
  serialize. CI runs the suites against a **never-migrated** database and moves the
  `db:migrate` CLI check to a separate database.
- Why: The two files ran `migrate()` concurrently against the same disposable database and
  raced on a fresh one, so the documented `pnpm test:integration` failed for a new
  contributor. CI pre-migrated the database first, which hid the race and would have let
  the fix regress unnoticed.
- Rejected: (a) serializing by `--test-concurrency=1` — it changes runner behaviour for
  the whole suite and still leaves the documented command fragile; (b) dropping the
  `db:migrate` CLI check — it verifies the release path, so it moved rather than went.
- Guard: `pnpm test:integration` green on an empty database (verified 3/3 runs); CI's
  `saas_starterkit_test` is created but never pre-migrated, so the concurrent path runs
  every CI run. The lock is session-scoped and released on connection close, so a crashed
  run cannot deadlock the next.

### D-8: The deletion guard keys on the payer, not on membership
- Date: 2026-10-26
- Mode: security
- Decision: `collectOrgMembershipFacts` also inspects organizations whose live plan the
  user pays for but no longer belongs to, recording them as `isMember: false`. The guard
  blocks such a payer while the plan is entitled. `deleteSoleMemberOrganizations` only
  removes organizations the user is still a member of.
- Why: The guard only looked at organizations reached through `member` rows. An owner can
  remove the payer from the organization, and the cascade follows `userId`, not
  membership — so after removal the payer's account deletion still destroyed the
  organization's order and subscription, the exact loss D-3 exists to prevent. Reproduced
  on a real database: `blockers = []` for a removed payer, then both rows gone.
- Rejected: (a) blocking removal of the payer while their plan is live — a permanent trap,
  since nothing lets the payer move billing; (b) blocking on any historical payment —
  traps users over value already consumed, and D-3 already allows a lapsed plan.
- Guard: `tests/account-deletion-guard.test.ts` (unit, incl. `isMember: false` cases) and
  the integration scenario "blocks a payer who was removed from the organization but still
  funds its plan", which also asserts cleanup leaves the payer-only organization alone.

### D-9: The deploy environment contract is checked before the build
- Date: 2026-10-26
- Mode: devops
- Decision: `scripts/check-deploy-env.mjs` (wired as `pnpm check:deploy-env`) verifies the
  deploy contract — `DATABASE_URL` must be a postgres URL, `BETTER_AUTH_SECRET` and the
  Midtrans keys must be present, the gateway flags must agree, and `CRON_SECRET`, when set,
  must be at least 32 characters. `REQUIRE_CRON_SECRET=true` additionally demands the cron
  secret. CI runs it before `next build`. `src/env.ts` now also validates `CRON_SECRET`
  (optional, min 32), so a weak secret fails the build.
- Why: `CRON_SECRET` was read straight from `process.env` in the cron route and never
  validated, so a build shipped with the endpoint unauthenticated and only discovered it at
  the first trigger (HTTP 500). Proven before the fix: `validateEnv` passed with
  `CRON_SECRET` unset and with a one-character value.
- Rejected: (a) making `CRON_SECRET` required at build — breaks every deployment that never
  schedules the sweep, and the route already fails closed (D-5); (b) adding it only to the
  CI YAML — a workflow edit is invisible to a self-hoster and rots the moment the key list
  changes; (c) a `prebuild` hook — would make a local `pnpm build` fail on a missing key the
  developer does not need yet.
- Guard: `tests/deploy-env-check.test.ts` — 16 cases including real subprocess runs, plus an
  anti-drift test that fails if any `process.env.X` in `src/` is not accounted for in the
  script's key lists.

### D-10: `subscription.orderId` needs no separate index
- Date: 2026-10-26
- Mode: data
- Decision: add no index on `subscription.orderId`. The column is declared `.unique()`, so
  PostgreSQL already maintains `subscription_order_id_unique`; the webhook idempotency
  lookup (`WHERE subscription.order_id = <orderId>`, `BillingService`) is served by that
  index. Confirmed with `EXPLAIN (ANALYZE, BUFFERS)` on a migrated database.
- Why: the backlog item asked for `EXPLAIN` evidence before adding one, and the evidence
  says the index is already there. On 20k rows the lookup is an Index Scan using
  `subscription_order_id_unique` (0.07 ms, 3 shared buffers); forcing a seq scan gives
  2.37 ms and 19999 rows removed by filter — about 32x slower for the same result.
- Rejected: (a) adding a redundant `index(orderId)` — a second btree on the same column
  costs write amplification and disk for zero read benefit; (b) dropping the unique
  constraint and relying on a plain index — uniqueness is what makes webhook idempotency
  safe, so the constraint stays.
- Guard: integration scenario K ("the webhook idempotency lookup on subscription.order_id
  is index-backed") asserts the unique index exists and that the planner picks an Index
  Scan at 5000 rows. Verified it fails (`found: none`) once the constraint is dropped.
- Note: below roughly 1000 rows the planner chooses a seq scan even with the index, so the
  scenario seeds 5000 rows; a smaller seed would make the EXPLAIN assertion vacuous.

### D-11: Every data region owns its three states, and a source guard keeps them there
- Date: 2026-10-26
- Mode: frontend
- Decision: the five dashboard data regions each carry empty (with a primary action),
  loading (a `Skeleton` shaped like the real layout) and error (inline `Alert` + Retry)
  states, and `tests/data-region-states.test.ts` locks the markers in place. The
  Organizations workspaces list was the only region missing two of the three: it loaded
  behind a bare `Loader2` spinner and had no error branch at all, so a failed
  `organization/list` rendered as an empty list. Its empty state also had no action.
- Why: ReUI requires all three per region, and the failure mode is silent — a dropped
  state still typechecks, lints and builds, and only shows up as a blank panel in
  production. The guard is the cheapest thing that makes the claim falsifiable.
- Rejected: (a) a rendered-DOM assertion — the Node test runner here has no JSX transform
  (`ERR_UNKNOWN_FILE_EXTENSION` on `.tsx`) and the repo has no DOM harness, so it would
  have meant adding jsdom + a transform just for this; (b) `max-h`/`h-*` on the loading
  block to size it — ReUI forbids hand-set heights on Card/Frame, and `Skeleton` with a
  width class inside the existing layout is the documented shape.
- Guard: `tests/data-region-states.test.ts` asserts, per region, that its own loading
  branch still renders a `Skeleton`, that the error copy and Retry affordance survive, and
  that empty states keep a message plus an action. It also rejects a loading branch that
  collapsed back to a bare spinner.
- Caveat: this guard reads source, so it proves the states are still written, not that they
  paint. Each loading assertion is anchored on its region's own flag (`isListLoading ? (`)
  — a first version matched any `<Skeleton` in the file and passed while the region's own
  loading branch had been replaced by a spinner. The three negative controls (error copy
  removed, Skeleton swapped for a spinner, empty-state action removed) now all fail.
- Note: `rg` is not installed in this sandbox. The ReUI self-checks and any grep in these
  docs must use `grep -nHE`, because a missing `rg` also prints nothing and reads as clean.
### D-12: The nightly autopilot automation runs off GitHub issues, and its timeout is capped at 1800s
- Date: 2026-10-27
- Mode: devops + docs
- Decision: registered the nightly automation as `704e38b3-9b27-4b83-9bc2-f57ca9779383`
  with `cron 0 2 * * *` UTC, `timeout 1800`, and the repo cloned at `main`. The three
  owner decisions are: daily cadence; **GitHub issues labelled `openhands`** as the work
  source (not `.agents/TASKS.md`); commit author
  `Iwan Kurniawan <139456364+iwwwan-io@users.noreply.github.com>`.
- Why issues, not `TASKS.md`: the board becomes a record of what merged, and the input
  queue moves to a surface anyone can add to without a commit. The prompt lists labelled
  issues with `gh issue list`, comments on the one it starts, and opens a PR carrying
  `Closes #<n>` so the merge closes the issue — the run never closes one by hand.
- Why the author is literal in the prompt: the prompt preset does not guarantee
  `GIT_AUTHOR_NAME` / `GIT_AUTHOR_EMAIL` reach the conversation, and a commit authored
  `openhands <openhands@all-hands.dev>` fails the Vercel author check with no build logs.
  Baking the value into the prompt removes the dependency on those variables.
- **Hard limit: `timeout` may not exceed 1800s.** The service rejected `3600` with
  `timeout must not exceed 1800 seconds (30 minutes)`. The old file claimed 3600. A full
  pipeline run (plan → implement → QA → review → gate) is close to this ceiling, so a run
  that hits 1800s is cut off rather than reported; treat a timeout as `blocked-on-CI` with
  the last phase, not as a silent no-op.
- Trigger label: `openhands` did not exist in the repo. It was created
  (`gh label create openhands`). A run picks the **oldest** labelled issue that has no open
  PR referencing it, and reports `no-work` when there is none.
- Verified by a real dispatch, not by reading the API: the run reached `COMPLETED` with
  `no-work`. It had cloned the repo, read the `.agents/` contract set, and cross-checked
  GitHub via CLI, REST, Search API and GraphQL before concluding the repo has no issues.
  This also proves the `repos` clone config took effect — the top-level `repos` field reads
  back `null`, but `preset_metadata.repos` holds the URL, so judge it there.
- Note: the automation's `GITHUB_TOKEN` is the org secret already registered in OpenHands;
  the run used it successfully for `gh`. No other secret is forwarded.

### D-13: The autopilot trigger label is `autopilot`, and the run must not delegate
- Date: 2026-10-27
- Mode: devops + docs
- Decision: two corrections after the first real end-to-end test of the automation, both
  found by running it rather than reading the config.
- **The trigger label moved from `openhands` to `autopilot`.** `openhands` is already wired
  to the OpenHands GitHub App installed on this repository, which starts its own
  `resolver` conversation on that label. Applying it made two systems race for one issue:
  in the test, the App's conversation was created 21 seconds after the label was applied
  (bot `openhands-ai[bot]`, `performed_via_github_app: openhands-ai`,
  `trigger: "resolver"`, `pr_number: []`) while the cron run had started 13 seconds
  earlier. The issue was closed with **no PR and no branch**. `autopilot` is unique to
  this automation. Verify a label is free of an existing App hook before adopting it.
- **The run no longer delegates to the `.agents/agents/` sub-agents.** The `task` tool is
  not reachable from the automation sandbox. The second test run burned its entire 1800s
  budget on `Test auth to local agent server with session key`,
  `Read task tool impl to understand child launch`, `Inspect parent conversation lease`,
  `Check raw api_key value in settings`, and never wrote a line of the issue's work. It
  ended `FAILED` with `Timed out: command timed out or was killed`. One run is one
  conversation: the prompt now says to do the work directly.
- The prompt also carries an explicit budget line — past 20 minutes with a red gate, stop
  and report rather than be cut off with nothing, because a timeout produces no report.
- Note: the delivery-lead *agent file* keeps its delegation contract for interactive
  sessions; only the automation prompt overrides it. Do not "fix" the agent file to match.
- Failure mode worth remembering: both end-to-end attempts returned a run status, and
  neither produced an artifact. A green run status is not evidence of work; check for the
  PR and the branch. The first attempt failed on an LLM provider outage (`OpenAIError:
  <!DOCTYPE html> ... Service Temporarily Unavailable`), which is infrastructure, not code.

### D-14: `robots.txt` derives its sitemap origin from env, and the guard test is a shape test
- Date: 2026-10-27
- Mode: backend + qa
- Decision: `src/app/robots.ts` builds its sitemap URL from `env.NEXT_PUBLIC_APP_URL`
  (trailing slashes stripped) instead of a literal hostname or a new env var, and
  `tests/robots-route.test.ts` guards the allow/deny split and that env-derived origin.
- Why env, not a literal: `AGENTS.md` already forbids a literal deployment hostname for
  `trustedOrigins`, and `MEMORY.md`'s environment map names `NEXT_PUBLIC_APP_URL` as the
  client-side absolute-URL variable. A hardcoded origin would drift per environment and
  would be the same class of bug the `trustedOrigins` rule exists to prevent.
- Why strip the trailing slash: a configured `https://app.example.com/` would otherwise
  emit `Sitemap: https://app.example.com//sitemap.xml`. Not requested by the issue.
- **The test is a shape guard, not an end-to-end test.** It calls the route function and
  asserts the returned object; the Node test runner here has no JSX transform and no DOM
  harness, so it cannot assert what Next actually serves. What proves the file-convention
  wiring is `pnpm build`: `/robots.txt` appears in the route table and
  `.next/server/app/robots.txt.body` holds the rendered directives. When verifying a
  metadata route, read the `.body` file — the route table alone only proves it was
  compiled.
- `Sitemap:` points at `/sitemap.xml`, which does not exist yet (`src/app/sitemap.ts` is a
  follow-up). A 404 there is a no-op for crawlers, not an error; do not "fix" it by
  removing the field, which the issue explicitly asked for.

### D-15: `sitemap.xml` lists only `/`, omits `lastModified`, and is driven by one shared route list
- Date: 2026-10-27
- Mode: backend + qa
- Decision: `src/app/sitemap.ts` enumerates the public surface from a shared
  `src/lib/seo.ts`, emits a bare `{ url }` per entry, and `src/app/robots.ts` was
  refactored onto the same module so the two routes cannot disagree.
- **Only `/` is in the sitemap.** `/login` and `/register` are `Disallow`ed by
  `robots.txt`; listing a disallowed URL in the sitemap is a contradiction, so they stay
  out even though they are reachable. `/dashboard/**` is private (the `proxy.ts` matcher).
- **`lastModified` is deliberately absent.** Google's contract for the field is when the
  page content last changed. A build-time `new Date()` claims every page changed on every
  deploy, and a git-derived date is not reliably available here — this workspace is a
  shallow clone (`git rev-parse --is-shallow-repository` is true), CI checkouts are often
  shallow, and `next build` can run with no `.git` at all. A wrong date is worse than no
  date. `changeFrequency` and `priority` are omitted too: Google ignores both.
- **`src/lib/seo.ts` is the single source.** It holds `PUBLIC_ROUTES`, `PRIVATE_ROUTES`,
  `getSiteOrigin()` and `absoluteUrl()`. Before this, `robots.ts` carried the origin logic
  and the disallow list inline; adding a second route would have duplicated both and let
  them drift. `robots.ts` is now four lines and cannot disagree with the sitemap.
- **The guard is a partition, not a shape check.** `tests/sitemap-route.test.ts` walks
  `src/app` for every `page.tsx` and fails if a route is classified as neither public nor
  private, so adding `/pricing` fails the suite until someone decides where it belongs.
  It also fails if a public route is `Disallow`ed by robots, if a public route has no page
  on disk, or if `sitemap.ts` hardcodes a hostname. Verified against two negative controls
  (an unclassified page, and `/login` forced into `PUBLIC_ROUTES`); both failed with the
  intended message.
- **The real proof is the build, not the test.** The test calls the route function; it
  cannot prove Next serves the file. `pnpm build` emits `○ /sitemap.xml` in the route
  table and `.next/server/app/sitemap.xml.body` holds the XML — read the `.body` file to
  confirm the rendered output. Same rule as D-14.

## Technical notes that are easy to forget

- **`pnpm test:integration` reads `INTEGRATION_TEST_DATABASE_URL`, not `DATABASE_URL`.**
  With only `DATABASE_URL` set, every scenario silently `t.skip`s and the suite exits 0 —
  a broken suite looks green. Confirm `pass 21` / `fail 0` / `skipped 0`.
- The two integration files migrate the same database; they serialize on a PostgreSQL
  advisory lock (`tests/integration/migrate-safely.ts`), so no pre-migration step is
  needed. CI deliberately leaves its test database unmigrated to exercise this path.
- The DB name must contain `test`, `disposable`, or `scratch`, and the host must be
  local/container — the harness fails closed. Do not point it at a dev database.
- Webhook tests sign with a hardcoded key `SB-Mid-server-test-integration-key-32chars`
  while `BillingService` verifies with `MIDTRANS_SERVER_KEY`. Set both to the same value
  or every webhook scenario fails with `WebhookValidationError: Invalid signature`.
- `pnpm build` needs `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`, `MIDTRANS_SERVER_KEY`,
  `BETTER_AUTH_SECRET`, and `DATABASE_URL` present, or the build fails.
- Migrations are **not** applied by `pnpm build`. Run `pnpm db:migrate` as a release step;
  migrations are additive and tracked in `netlify/database/migrations/meta`.
- `pnpm db:push` is for local prototyping only — it skips migration history and drifts.
- **Vercel rejects deploys whose commit author is not a Vercel team member** ("Git author
  must have access to the project"). Commits authored as `openhands <openhands@all-hands.dev>`
  fail the Vercel check with no build logs; the code is fine. Author commits as a team
  member when the deployment check must pass.
- `src/components/reui/**` is excluded from ESLint. Do not "fix" lint there.
- The dashboard layout is a client component that guards the session; page content arrives
  as children. Mobile has a fixed bottom nav — new UI needs `pb-20` clearance.
- Next.js 16 differs from older versions. Read `node_modules/next/dist/docs/` before
  writing framework code.
- `AGENTS.md` contains two tool-managed blocks (`nextjs-agent-rules`, `reui-agent-rules`).
  Never hand-edit inside those markers.
- **`.agents/agents/*.md` are scanned at conversation start, not hot-reloaded.** Editing an
  agent file (including its `permission_mode`) has no effect until a new conversation
  starts. `name` must equal the filename, and the description needs ≥2 `<example>` tags.
- Valid `permission_mode` values are exactly `always_confirm`, `never_confirm`, and
  `confirm_risky`. All six agents here use `never_confirm`; `confirm_risky` would need a
  security analyzer configured, and it is what used to halt the pipeline.
- The autopilot guardrail is the **abort list** in `PROTOCOL.md`, not a confirmation
  prompt. If you ever add a `permission_mode: always_confirm` agent, you have reintroduced
  the halt that D-6 removed.

## Environment map

| Variable | Needed by |
| :--- | :--- |
| `DATABASE_URL` | runtime, `db:*`, `build` |
| `INTEGRATION_TEST_DATABASE_URL` | `pnpm test:integration` only |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | auth, `build` |
| `MIDTRANS_SERVER_KEY` | webhook verification, Snap, `build` |
| `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` | Snap client, `build` |
| `MIDTRANS_IS_PRODUCTION`, `NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION` | Midtrans mode |
| `CRON_SECRET` | `/api/billing/cron/sync-expired` (fails closed without it; min 32 chars when set) |
| `NEXT_PUBLIC_APP_URL` | client-side absolute URLs |

## Open questions / to be filled later

- _(none yet — add as they appear, with the mode that raised them)_
