# `subscription.orderId` index decision — REPORT

Branch: `data/subscription-orderid-index` · Mode: data (with qa)

## The backlog item

> Add an index on `subscription.orderId` if webhook idempotency lookups grow; confirm with
> `EXPLAIN` before adding it.

The instruction was explicitly evidence-first: do not add the index until `EXPLAIN` says it
is needed.

## What the evidence says

`orderId` is declared `.unique()` in `src/server/db/schema/billing.ts`, so PostgreSQL
already maintains a unique btree on the column. On a migrated database:

```
subscription_order_id_unique | CREATE UNIQUE INDEX ... ON subscription USING btree (order_id)
```

The webhook idempotency path resolves an existing subscription with
`WHERE subscription.order_id = <orderId>` (`BillingService`). On 20,000 seeded rows:

```
EXPLAIN (ANALYZE, BUFFERS) SELECT id, status FROM subscription WHERE order_id = 'ORD-12345';
  Index Scan using subscription_order_id_unique  (actual time=0.037..0.037 rows=1)
    Buffers: shared hit=3
  Execution Time: 0.073 ms

-- control: same query with index scans disabled
  Seq Scan on subscription  (actual time=1.445..2.340 rows=1)
    Rows Removed by Filter: 19999
  Execution Time: 2.373 ms
```

Roughly 32x slower without the index, and the index already exists. Adding a second index on
the same column would buy nothing and cost write amplification.

## Decision

Add no index (D-10). Keep the unique constraint — uniqueness is what makes webhook
idempotency safe, so it is not "just an index".

## Guard

Integration scenario K, "the webhook idempotency lookup on subscription.order_id is
index-backed" (`tests/integration/postgres-webhook-concurrency.test.ts`):

1. asserts a unique index on `subscription(order_id)` exists in `pg_indexes`;
2. seeds 5,000 rows and asserts the planner picks `Index Scan using
   subscription_order_id_unique`.

Negative control — drop the constraint on a disposable database and the scenario fails:

```
✖ Scenario K: ... is index-backed
  AssertionError: expected a unique index on subscription(order_id); found: none
```

Planner note: below ~1,000 rows PostgreSQL prefers a seq scan even with the index present
(measured: seq scan at 200 rows, Index Scan at 1,000), so the scenario seeds 5,000 rows. A
smaller seed would make the EXPLAIN assertion vacuous.

## Verification on this branch

| Command | Result |
| :--- | :--- |
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm test` | 159 pass / 0 fail |
| `pnpm test:integration` (empty DB) | 21 pass / 0 fail / 0 skipped |
| Scenario K negative control | fail 1 (`found: none`) |

## Next

Open a PR for this branch and let CI confirm.
