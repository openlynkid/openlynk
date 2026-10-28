# Onboarding

For a fresh session (or a new agent) starting in this repository. Read this first, then
work. Ten minutes here saves an hour of rediscovery.

## Read, in this order

1. **`AGENTS.md`** (root) — the project rules. Two blocks inside it are tool-managed;
   never edit them.
2. **`.agents/MEMORY.md`** — architecture, the Decision Log, and the traps that are
   expensive to rediscover. This is where the office's memory lives.
3. **`.agents/ROLES.md`** — the modes you can act as, and what each one owns.
4. **`.agents/PROTOCOL.md`** — how to activate a mode, hand off, and verify.
5. **`.agents/TASKS.md`** — what is in flight right now.
6. **`.agents/skills/reui/SKILL.md`** — before touching any UI.

## Get the environment running

```sh
pnpm install                       # pnpm 12.14.0, Node 22.23.1
cp .env.example .env.local         # then fill in the values
pnpm db:migrate                    # migrations are a release step, not part of build
pnpm dev                           # http://localhost:3000
```

`pnpm build` needs `DATABASE_URL`, `BETTER_AUTH_SECRET`, `MIDTRANS_SERVER_KEY`, and
`NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` present or it fails — that is expected, not a bug.

## Verify before you claim anything works

```sh
pnpm typecheck
pnpm lint
pnpm test
```

Integration tests need a **disposable** database and the matching webhook key:

```sh
export INTEGRATION_TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/saas_starterkit_test"
export MIDTRANS_SERVER_KEY="SB-Mid-server-test-integration-key-32chars"
pnpm test:integration
```

Two traps, both of which produce a *green-looking* broken suite:

- `test:integration` reads `INTEGRATION_TEST_DATABASE_URL`, **not** `DATABASE_URL`. The
  default `test:integration` now fails loudly in that case: with no database it reports
  `pass 0 / fail 20 / skipped 0` and exits non-zero, so a broken suite cannot look green.
  Demand `pass 20 / fail 0 / skipped 0`. Use `pnpm test:integration:optional` only when
  you deliberately want to run without a database and accept the skip.
- The webhook tests sign with a hardcoded key while `BillingService` verifies with
  `MIDTRANS_SERVER_KEY`. If they differ, every webhook scenario fails on signature.

The two integration files migrate the same database and used to race on a fresh one
(`Failed query: CREATE TABLE "account"`). They now take a PostgreSQL advisory lock before
migrating (`tests/integration/migrate-safely.ts`), so the first file applies the migration
and the second waits and then no-ops. A plain `pnpm test:integration` on an empty database
works; pre-migrating is no longer needed.

## Your first reply

Open with the coordinator line, state the mode sequence, then switch to the first mode:

```
[mode: coordinator] — <what was asked, and the mode sequence you will use>
```

If the request is one bounded work item, hand it to `autopilot` / `delivery-lead` instead:
the sequence then runs internally and the owner gets a single Delivery Report. Either way,
follow `PROTOCOL.md`. Do not edit files without a mode line; do not mark a task done while
a verification command is red.

## How the office delivers work

Work runs **end to end without stopping to ask**. One item is owned by the `delivery-lead`
mode (sub-agent `.agents/agents/delivery-lead.md`), run under `autopilot`:

```
item → delivery-lead: criteria → planning → (data) → backend/frontend → qa → review → merge → one report
```

The mode sequence is internal. You see it once, in the report — not turn by turn.

**Two outcomes, never a question.** Every decision is either *proceed silently* (edit
inside your mode's `Owns`, run verifications, branch, commit, push, PR, merge on a green
gate) or *abort the item and report* (anything that would weaken the webhook signature,
the cron fail-closed path, or the deletion guard; a destructive DB operation; a secret;
the tool-managed markers; `src/components/reui/**`; a price outside `plans.ts`; weakening
a failing test). If it is on neither list, take the conservative reading, proceed, and note
it under *Decisions taken*. Full lists: `PROTOCOL.md` → autonomy policy.

**Merge gate.** Merge only when `typecheck`, `lint`, `test` (`fail 0`, `skipped 0`),
`test:integration` (real counts), `build` (for config/env/routing), the `code-reviewer`
verdict, and CI on the PR are all green. Otherwise the item is reported `blocked-on-CI`.

**Where the report appears.** One *Delivery Report* per item, in the conversation that ran
it, plus a durable copy at `.agents/rooms/<item>/REPORT.md` and a summary in the PR
description.

**Automation.** A cron run picks the highest-value open item from `.agents/TASKS.md` and
runs the pipeline. The owner starts nothing and reads one report. The registered prompt,
its trigger, the secrets it may receive, and the decisions that must be confirmed before
deploying live in `.agents/automation/autopilot-nightly.md` — edit that file, not the
registered copy.

## Where things live

| You need… | Look in |
| :--- | :--- |
| a page or route | `src/app/**` (`dashboard/{billing,organizations,settings}`) |
| domain logic | `src/modules/**` (`billing`, `account`, `organization`) |
| DB schema / migrations | `src/server/db/schema/**`, `netlify/database/migrations/**` |
| auth config | `src/server/auth/**` |
| API routes | `src/app/api/**` |
| UI primitives | `src/components/ui` (shadcn), `src/components/reui` (ReUI — vendor) |
| tests | `tests/*.test.ts` (unit), `tests/integration/*.test.ts` |
| sub-agents | `.agents/agents/*.md` |
| the cron automation definition | `.agents/automation/autopilot-nightly.md` |

## The five rules most likely to bite you

1. **Never edit inside the tool-managed markers in `AGENTS.md`** (`nextjs-agent-rules`,
   `reui-agent-rules`).
2. **Never edit `src/components/reui/**`** — vendor code, and excluded from ESLint.
3. **Never weaken the webhook signature, the cron fail-closed path, or the deletion
   guard.** If one blocks you, the task is wrong, not the guard.
4. **Never compute a price outside `src/modules/billing/plans.ts`.**
5. **Never hand-roll a UI component ReUI already ships** (tables, filters, kanban,
   modals, toasts) — and never set height/radius/padding/shadow/motion on one.

## When you are unsure

- A doc and the code disagree → **the code wins**, then fix the doc.
- A request would break an invariant → stop, flag it in `coordinator`, and ask.
- You are about to edit outside your mode's `Owns` column → **hand off** instead.
