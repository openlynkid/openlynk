# Deploy environment contract — REPORT

Branch: `fix/deploy-env-contract` · PR #7 (base `main`) · Mode: devops

## The hole

`CRON_SECRET` was read straight from `process.env` in
`src/app/api/billing/cron/sync-expired/route.ts` and was the only app key not validated
by `src/env.ts`. An audit of every `process.env.X` read in `src/` confirmed it:

```
process.env.CRON_SECRET      ← read by src/, validated nowhere
process.env.VERCEL_URL       ← platform-provided, optional
process.env.VERCEL_PROJECT_PRODUCTION_URL  ← platform-provided, optional
```

Reproduced before the fix, on the real validator:

```
$ validateEnv with CRON_SECRET unset  → PASSED (no complaint)
$ pnpm build with CRON_SECRET="weak"  → exit 0
```

So a deployment could ship with the expiry endpoint unauthenticated and only find out at
the first trigger (HTTP 500 — it fails closed, but in production rather than in CI).

## The fix

`scripts/check-deploy-env.mjs` (`pnpm check:deploy-env`) states the deploy contract and CI
runs it before `next build`:

- required and well-formed: `DATABASE_URL` (postgres URL), `BETTER_AUTH_SECRET` (≥32),
  `MIDTRANS_SERVER_KEY`, `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`;
- the two gateway flags must agree;
- `CRON_SECRET`, when set, must be ≥32; `REQUIRE_CRON_SECRET=true` demands it outright.

`src/env.ts` now validates `CRON_SECRET` too, so a weak secret fails the build. It stays
optional and empty counts as absent, so a deployment that never schedules the sweep still
builds — the route keeps failing closed (D-5).

## Evidence

| Command | Result |
| :--- | :--- |
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm test` | 156 pass / 0 fail / 0 skip |
| `pnpm check:deploy-env` (valid CI env) | exit 0 |
| `pnpm check:deploy-env` (no env) | exit 1, names each missing key |
| `pnpm test:integration` (emulating main's CI) | 19 pass / 0 fail / 0 skip |
| `pnpm build` with `CRON_SECRET` | exit 0 |
| `pnpm build` with `CRON_SECRET="weak"` | **exit 1** — `CRON_SECRET must be at least 32 characters` |
| `pnpm build` without `CRON_SECRET` | exit 0 |
| CI `Verify deploy environment contract` step | ran, success |

Negative control for the anti-drift guard: a probe file reading
`process.env.SOME_NEW_DEPLOY_KEY` made exactly that test fail and name the key; deleting
the probe returned the suite to green.

## Known limitation

Both layers compare the raw value length, so a 32-character all-whitespace secret would
pass. Left as-is deliberately: `src/env.ts` (zod `.min(32)`) does not trim either, and
divergent trimming rules between the two would be worse than the edge case. Not a
realistic misconfiguration.

## Next

#5 and #6 are merged into `main`; this branch was rebased onto `1c0244a` and D-9 now sits
after D-7/D-8. All gates re-run green on the rebased head (typecheck 0, lint 0, unit
159/159, integration 20/20 on an empty database, build 0, weak-`CRON_SECRET` build exit 1).
