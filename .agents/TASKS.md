# Task Board

The office's working state. `coordinator` owns this file; under autopilot,
`delivery-lead` may also move items here as part of a run. Keep it honest: a task in
**Done** must have met the verification contract in `PROTOCOL.md`.

Legend: `[ ]` open · `[~]` in progress · `[x]` done. Tag the owning mode in brackets.

## Serah-terima: lanjutkan deploy Netlify (percakapan baru) — SELESAI

Serah-terima ini sudah dijalankan. Ringkasan ada di D-17 (`MEMORY.md`); hasilnya:

- `https://openlynk.netlify.app` **hidup (HTTP 200)** dan sudah publish
  (`published_deploy` terisi untuk pertama kali, `database_branch_id=production`).
- Akar masalah build produksi yang ter-skip ditemukan: **kredit akun habis**
  (`error_message="Skipped due to account credit usage exceeded"`), bukan kode/config.
  Deploy produksi dari git tetap ter-skip sampai owner top-up/upgrade.
- Jalan deploy yang bekerja: build draft (`POST /sites/<id>/builds?draft=true`) lalu
  publish (`POST /sites/<id>/deploys/<id>/restore`).
- 8 env vars sudah diisi di site (non-secret; Free plan menolak `scopes` dan
  `is_secret`). `DATABASE_URL` memang tidak perlu — Netlify Database menyediakan
  `NETLIFY_DB_URL`.
- Dua blocker lain ikut dibersihkan: proteksi SSO situs (`sso_login` → 401) dan build
  lama yang memakai `http://localhost:3000`.
- **Sisa untuk owner:** ganti placeholder sandbox `MIDTRANS_SERVER_KEY` /
  `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` dengan kunci asli (berpasangan), dan selesaikan
  blokir kredit akun agar build produksi dari git jalan sendiri.

Jangan ulangi eksperimen isolasi `exp-*` — kesimpulannya sudah final di D-16 dan tidak perlu
dibuktikan lagi.

- `[x]` **[devops]** Deploy OpenLynk to Netlify. Situs produksi **live** dan terverifikasi
  end to end, bukan cuma `ready`: `GET /api/auth/ok` → `{"ok":true}` (DB terjangkau),
  sign-up menulis user ke DB, sign-in membacanya, dan cron `sync-expired` mengembalikan
  `{"success":true}` dengan `CRON_SECRET` serta 401 tanpa secret (fail closed). Empat
  defect ditutup: (1) `publish` + `@netlify/database` (PR #2, D-16), (2) proteksi SSO
  situs yang membuat URL publik mengembalikan 401, (3) env vars kosong, (4) build yang
  masih memakai `http://localhost:3000`. **Blokir yang tersisa bersifat akun, bukan kode:**
  build produksi dari git masih `skipped: true` dengan "Skipped due to account credit usage
  exceeded", jadi sampai owner top-up/upgrade rilis baru harus lewat jalur draft+restore
  (D-17). Lihat D-17 untuk perintah lengkapnya.

- `[x]` **[devops + docs]** Register the nightly autopilot automation (Step 9 of the
  pipeline in D-6). Registered as `aa313395-f5e0-40f2-be98-960ada83908e` on the three
  owner decisions: daily `0 2 * * *` UTC, GitHub issues labelled `autopilot` as the work
  source, and `Iwan Kurniawan <139456364+iwwwan-io@users.noreply.github.com>` as the
  commit author. The prompt lists labelled issues with `gh`, comments on the one it
  starts, and opens a PR with `Closes #<n>`; it does the work in one conversation rather
  than delegating, because the `task` tool is unreachable from the automation sandbox.
  Verified end to end, not by reading config: issue #15 (label `autopilot`) produced PR #16,
  which passed CI, merged, and closed the issue via `Closes #15`. `timeout` is 1800s, the
  service maximum. The first registration used the `openhands` label, which collided with
  the OpenHands GitHub App — see D-13.

## Backlog

- `[x]` **[frontend + backend + qa]** Bento Studio: a grid builder where a creator
  arranges their page as tiles. One `layout` jsonb column on `creator_link` (default
  `'{}'`) rather than a new table, so every existing row still renders full-width through
  `resolveTileLayout`. Delivered: `/dashboard/studio` (canvas + inspector, drag and
  keyboard reorder, size presets, show/hide), `GET`/`PUT /api/creator/studio`,
  `creatorService.saveStudioLayout` (order + footprint + visibility in one transaction,
  invalidates the storefront cache), and a bento renderer for the public page. Guarded by
  `tests/bento-layout.test.ts` — including a literal-class assertion, because
  `col-span-${w}` would build and then collapse every tile in production. See D-18.

- `[x]` **[backend + qa]** Add `src/app/sitemap.ts` so the `Sitemap:` line in `robots.txt`
  resolves. Scope decided: only `/` is public (`/login` and `/register` are `Disallow`ed
  by robots, so listing them would contradict it), and `lastModified` is omitted rather
  than faked from the build clock or an unavailable git date. `src/lib/seo.ts` now holds
  the route lists and origin helpers, and `robots.ts` was refactored onto it. Guarded by
  `tests/sitemap-route.test.ts`, including a partition check that fails on any unclassified
  page. See D-15 and `.agents/rooms/sitemap-route/REPORT.md`. Delivered in PR #18.
- `[x]` **[backend + qa]** Issue #15: serve `robots.txt` so the marketing site is
  indexable and the app surface is not. `src/app/robots.ts` emits
  `MetadataRoute.Robots` — wildcard user agent, `allow: "/"`, `disallow:`
  `/dashboard`, `/login`, `/register` — with the sitemap origin from
  `env.NEXT_PUBLIC_APP_URL`. Guarded by `tests/robots-route.test.ts`. See D-14 and
  `.agents/rooms/robots-route/REPORT.md`. Delivered in PR #16.
- `[x]` **[devops]** Add a `CRON_SECRET` and `MIDTRANS_*` presence check to CI so a
  misconfigured deploy fails at build time rather than at the first webhook. Delivered:
  `pnpm check:deploy-env` runs before `next build`, and `src/env.ts` now validates
  `CRON_SECRET`. See D-9. Delivered in PR #7.
- `[x]` **[qa + devops]** Both integration files migrated the same database in `before()`
  and raced on a fresh one (`Failed query: CREATE TABLE "account"`). Fixed: they now
  migrate under a PostgreSQL advisory lock (`tests/integration/migrate-safely.ts`), and CI
  runs the suites against a never-migrated database. See D-7. Delivered in PR #5.
- `[x]` **[security]** Audit every `onDelete` on billing foreign keys against the
  deletion-guard invariant (D-3). Audited all 12 FKs, confirmed against `pg_constraint` on
  a migrated database. Found and fixed one hole: the guard only saw organizations reached
  through `member` rows, so a payer removed from the organization could still cascade its
  plan away. See D-8. Delivered in PR #6.
- `[x]` **[data]** Add an index on `subscription.orderId` if webhook idempotency lookups
  grow; confirm with `EXPLAIN` before adding it. Confirmed with `EXPLAIN (ANALYZE, BUFFERS)`:
  the column is `.unique()`, so `subscription_order_id_unique` already serves the lookup
  (Index Scan, 0.07 ms vs 2.37 ms seq scan on 20k rows). No new index added. See D-10;
  guarded by integration scenario K.
- `[x]` **[frontend]** Audit each data region for the three required states (empty with
  action, `Skeleton` loading, error with Retry) — required by the ReUI rules. Five regions
  audited; the Organizations workspaces list was missing an error state and loaded behind
  a bare spinner, and both its empty state and the members-grid no-results state lacked an
  action. Fixed, and locked by `tests/data-region-states.test.ts` (verified against three
  negative controls). See D-11.

## Done

- `[x]` **[docs + architecture + security]** Autopilot delivery pipeline: `delivery-lead`
  mode + sub-agent, the autonomy policy (proceed / abort, no third category), the merge
  gate, and `permission_mode: never_confirm` on the writing sub-agents. See D-6. Merged in
  PR #4; the commit-author/Vercel blocker was resolved by authoring commits as a team
  member (see `AGENTS.md`).
- `[x]` **[qa]** Integration suite fails loudly when scenarios are skipped. A missing
  database used to produce `skipped 19` and exit 0, so a broken suite looked green.
  `pnpm test:integration` now asserts the executed-scenario count and exits non-zero;
  verified `pass 0 / fail 19 / skipped 0` with no database, and `pass 19 / fail 0 /
  skipped 0` against a real PostgreSQL. `pnpm test:integration:optional` keeps the
  skip-only behaviour. Spawned a follow-up for the migration race found while verifying.
- `[x]` **[devops]** Record the Vercel commit-author constraint in the root `AGENTS.md`
  (and correct the stale `pass 10` integration figure to `pass 19`).
- `[x]` **[docs + architecture + security]** Autopilot delivery pipeline (D-6):
  `delivery-lead` mode and sub-agent, the autonomy policy, the merge gate, and
  `permission_mode: never_confirm` on the writing sub-agents. Supersedes the old
  "choosing a mode example" backlog item — the flow is documented in `ONBOARDING.md`
  under *How the office delivers work*.
- `[x]` **[docs]** Virtual office rollout: `ROLES.md`, `PROTOCOL.md`, `MEMORY.md`,
  `TASKS.md`, `ONBOARDING.md`, `rooms/`, and the `AGENTS.md` pointer (`e19437a`).
- `[x]` **[backend + frontend + security]** Self-serve account deletion with a
  shared-workspace guard, plus the escape route: owners can change roles and remove
  members on the Organizations page so a blocked sole owner can unblock themselves.
  Merged in PR #3 (`cbfe560`). Guarded by `tests/account-deletion-guard.test.ts`,
  `tests/integration/account-deletion-guard.test.ts`, and
  `tests/organization-member-management.test.ts`.
- `[x]` **[backend]** Reject unsupported plan/interval pairs at checkout and centralise
  pricing in `plans.ts` (D-2).
- `[x]` **[security]** Cron endpoint fails closed without `CRON_SECRET` (D-5).
- `[x]` **[docs]** Developer sub-agent team under `.agents/agents/` (PR #2).
