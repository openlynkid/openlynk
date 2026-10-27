# Delivery Report — integration suite fails loudly when it cannot run

**Item:** `[qa]` Make the integration suite fail loudly when scenarios are skipped
(`.agents/TASKS.md`)
**Branch:** `feat/autopilot-delivery-pipeline` (commit `7182c94`)
**Outcome:** done · **Date:** 2026-10-26

## Acceptance criteria

| Criterion | Result |
| :--- | :--- |
| A run without a database must not exit 0 | met — `pass 0 / fail 19 / skipped 0`, exit 1 |
| A real run must still pass | met — `pass 19 / fail 0 / skipped 0`, exit 0 |
| Behaviour documented at the point of failure | met — `ONBOARDING.md`, `AGENTS.md` |
| No production code changed | met — zero diff under `src/` |

## Mode sequence

`delivery-lead` → `qa` → `delivery-lead` (review)

The authoring mode was `qa`; the review was a separate read of the diff, below.

## Files changed

- `tests/integration/postgres-webhook-concurrency.test.ts` — `REQUIRED_SCENARIO_COUNT`,
  a `requireDatabase(t)` helper, scenario counting, teardown assertion.
- `tests/integration/account-deletion-guard.test.ts` — same pattern; nine inline skip
  guards replaced with the helper plus `assert.ok(sharedDb)` to keep type narrowing.
- `package.json` — `test:integration` sets `EXPECT_INTEGRATION_DB=true`;
  `test:integration:optional` preserves the skip-only run.
- `.agents/ONBOARDING.md`, `AGENTS.md`, `.agents/TASKS.md` — behaviour and follow-up.

## Verification (real counts)

| Command | Result |
| :--- | :--- |
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm test` | `pass 140 / fail 0 / skipped 0` |
| `pnpm test:integration` (no DB) | exit 1 · `pass 0 / fail 19 / skipped 0` |
| `pnpm test:integration` (real PostgreSQL 17) | exit 0 · `pass 19 / fail 0 / skipped 0` |
| `pnpm test:integration:optional` (no DB) | exit 0 · `skipped 19` (unchanged) |
| `pnpm build` | exit 0 |

## Review verdict

**Approve with comments.** One defect was found by the reviewer and fixed before commit:
the first version broke the deletion file's `sharedDb` narrowing, so `tsc` failed. Fixed
with `assert.ok(sharedDb)`. A second review pass found that the concurrency file's teardown
error was reported outside the `fail` counter; the guards were unified so the failure is
attributed to each scenario.

## Decisions taken

- Made the strict behaviour the **default** rather than opt-in. The backlog item's whole
  complaint was that a green-looking broken suite is easy to miss; an opt-in flag would
  have preserved the trap.
- Kept a `test:integration:optional` escape hatch rather than removing the ability to run
  without a database entirely.
- Filed the migration race as a follow-up instead of fixing it here — it is a real but
  separate defect, and folding it in would have widened the item's blast radius.

## Follow-up filed

`[qa]` Both integration files migrate the same database in `before()` and race on a fresh
one (`Failed query: CREATE TABLE "account"`). CI hides this by running `pnpm db:migrate`
first. Make migration idempotent or serialize the two files.

## Not done

Nothing was pushed or merged; the branch is local. The commit-author blocker from the
pipeline report still applies.
