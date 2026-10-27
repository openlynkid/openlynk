# Delivery Report — integration suites migrate under an advisory lock

**Item:** `[qa + devops]` The two integration files race when migrating a fresh database
(`.agents/TASKS.md`) · **Branch:** `fix/integration-migration-race`
**Outcome:** delivered (in-repo) · **Date:** 2026-10-26

## Acceptance criteria

| Criterion | Result |
| :--- | :--- |
| Plain `pnpm test:integration` on an empty disposable DB exits 0 | met — 3/3 runs, `pass 19 / fail 0 / skipped 0` |
| Re-running on an already-migrated DB still passes | met — `pass 19 / fail 0 / skipped 0` |
| The fail-loud behaviour is preserved | met — no DB → `pass 0 / fail 19 / skipped 0`, exit 1 |
| No production code changed | met — zero diff under `src/` |
| The fix cannot regress unnoticed | met — CI now runs the suites against a never-migrated database |

## Mode sequence

`coordinator` → `delivery-lead` (autopilot) → `planning` → `qa` → `docs` → `devops` → `review` → `delivery-lead`

## Files changed

- `tests/integration/migrate-safely.ts` — new `migrateUnderLock()`: takes
  `pg_advisory_lock` on a dedicated single-connection client, applies Drizzle migrations,
  releases the lock. Session-scoped, so a crash drops it with the connection.
- `tests/integration/postgres-webhook-concurrency.test.ts`,
  `tests/integration/account-deletion-guard.test.ts` — call `migrateUnderLock()` instead of
  an unguarded `migrate()`; dropped the now-unused `path` / `url` imports.
- `.github/workflows/ci.yml` — the integration job now leaves `saas_starterkit_test`
  pristine and runs the `db:migrate` CLI check on a separate database, so CI exercises the
  concurrent-migration path.
- `AGENTS.md`, `.agents/ONBOARDING.md`, `.agents/MEMORY.md` (D-7), `.agents/TASKS.md` —
  the stale "pre-migrate first" guidance replaced with the new behaviour.

## Verification (real counts)

| Command | Result |
| :--- | :--- |
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0, 0 warnings |
| `pnpm test` | `tests 140 · pass 140 · fail 0 · skipped 0` |
| `pnpm test:integration` (empty DB, ×3) | exit 0 · `pass 19 / fail 0 / skipped 0` each run |
| `pnpm test:integration` (pre-migrated DB) | exit 0 · `pass 19 / fail 0 / skipped 0` |
| `pnpm test:integration` (no DB) | exit 1 · `pass 0 / fail 19 / skipped 0` (fail-loud intact) |
| `pnpm build` | exit 0 |
| CI flow simulation | `db:migrate` on the check DB exit 0; suites on the pristine DB `pass 19 / fail 0 / skipped 0` |

Reproduction before the fix: on a freshly created empty database the unguarded run failed
with `[CI FAILURE] Incomplete integration run: expected 10 scenarios ... only 0 completed`,
the loser of the migration race reporting "PostgreSQL not available".

## Review verdict

**Approve.** Independent read of the diff: no app-level advisory locks exist in `src/`, so
the key cannot collide; no other unguarded `migrate()` remains; `src/**` and
`src/components/reui/**` are untouched; the `AGENTS.md` tool-managed markers are unchanged.

## Decisions taken without asking

- Fixed by serializing with an advisory lock rather than by `--test-concurrency=1`, which
  would change runner behaviour for the whole suite and leave the documented command
  fragile.
- Moved (did not drop) the CI `db:migrate` CLI check to its own database, preserving the
  release-path check while letting CI prove the concurrent path.
- Recorded the decision as D-7 with its guard, per the "a decision with no guard is a hope"
  rule.

## Blocker

None for the change itself. The repository-wide Vercel commit-author constraint from the
pipeline report still applies to deployment, not to this branch's CI.
