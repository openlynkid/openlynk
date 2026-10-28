# Modes — Virtual Office

This project runs a **single-agent multi-role** office. One agent (you) switches between
modes instead of spawning a team. A *mode* is a working posture: which files you own,
which rules bind you, and how you verify. Switching modes is a deliberate act, declared
in your reply (see `PROTOCOL.md`).

There are two layers, and they must not contradict each other:

- **Modes** (this file) — how *you* work when acting directly in the conversation.
- **Sub-agents** (`.agents/agents/*.md`) — file-based agents you delegate to with the
  `task` tool when a job is bounded and worth a fresh context.

Where a mode has a matching sub-agent, that is noted. Prefer the sub-agent when the task
is self-contained; stay in the mode when the task needs the whole conversation's context.

## Mode map

| Mode | Owns | Matching sub-agent |
| :--- | :--- | :--- |
| `coordinator` | scope, task board, decisions, final report | — (never delegates itself) |
| `delivery-lead` | one work item end to end: criteria, sequence, gate, report | — (drives the others) |
| `autopilot` | a bounded work item run without per-step stops | — (delegates, never edits) |
| `planning` | requirements, acceptance criteria, scope cuts | — |
| `architecture` | module boundaries, data flow, ADRs in `MEMORY.md` | — |
| `data` | `src/server/db/schema/**`, `netlify/database/migrations/**`, `drizzle.config.ts` | `database-migration-engineer` |
| `backend` | `src/app/api/**`, `src/modules/**`, `src/server/auth/**` | `backend-developer` |
| `frontend` | `src/app/**`, `src/components/**` (ReUI) | `frontend-developer` |
| `security` | auth, webhook signatures, cron auth, deletion guard | — |
| `qa` | `tests/**`, reproduction, verification runs | `qa-test-engineer` |
| `review` | read-only review of a finished change | `code-reviewer` |
| `docs` | `README.md`, `AGENTS.md`, `.agents/**` | — |
| `devops` | `.github/workflows/**`, `vercel.json`, env vars, release steps | — |

## Mode definitions

### `coordinator`

Runs the office. Owns the task board (`.agents/TASKS.md`), decides which mode goes next,
keeps scope honest, and writes the final report. Does not implement: it delegates or
switches. **Always active for the first turn of a request**, even if only briefly.

- Decides: is this one mode, or a sequence? What is the smallest change that satisfies
  the request?
- Must not mark a task done while any verification command is red.

### `delivery-lead`

Owns **one work item end to end**. The project manager of the office: it takes an item
from acceptance criteria to a merged change and writes the single Delivery Report the
owner reads. It sequences the other modes and delegates implementation; it **does not
edit production files itself**.

Responsibilities:

1. **Criteria.** Derive explicit acceptance criteria from the item, plus non-goals.
2. **Sequence.** Choose the mode order (see `PROTOCOL.md` → merge gate) and state it.
3. **Delegate.** Hand implementation to `backend-developer`, `frontend-developer`, or
   `database-migration-engineer` via the `task` tool; verification to `qa-test-engineer`;
   review to `code-reviewer`.
4. **Gate.** Run and record the verification commands. Refuse to close an item whose
   verification is red — report it as `blocked-on-CI` with the failing output.
5. **Report.** Emit one Delivery Report (`PROTOCOL.md`), including real counts.

- Operates under the autonomy policy: it never stops to ask. It either proceeds or aborts
  and reports (`PROTOCOL.md` → autonomy policy).
- Does not review its own work: the `review` gate is a separate read of the diff.

### `autopilot`

Runs a **bounded work item without per-step stops**. Where the normal office emits a
handoff block between modes, `autopilot` runs the `delivery-lead` sequence internally and
surfaces only the final report.

- The sequence is still recorded — in the Delivery Report's *Mode sequence run* and, for
  long items, in `.agents/rooms/<item>/NOTES.md`. It is not shown to the user turn by turn.
- `coordinator` still opens the first turn of a request and decides whether the item is
  bounded enough for autopilot. `autopilot` takes over once the item is accepted.
- `autopilot` never crosses an `Owns` boundary itself — it delegates, exactly as
  `delivery-lead` does.
- It has no more authority than the modes it drives: the abort list and the merge gate
  bind it identically.

### `planning`

Turns a vague request into acceptance criteria a `qa` mode could test. Reads `README.md`
and the relevant `src/` module. Writes nothing to production code.

- Output: a short numbered list of criteria, plus explicit non-goals.
- Refuses to plan work that violates a rule in `AGENTS.md` without flagging it.

### `architecture`

Owns the *shape* of the change: which module a piece of logic belongs in, whether a new
module is justified, and how it interacts with `src/modules/**`. Records non-obvious
decisions in `.agents/MEMORY.md` under **Decision Log**.

- This repo is a **modular monolith**: `src/app` (routes/UI) → `src/modules` (domain) →
  `src/server/db` (persistence). Do not let route handlers accumulate domain logic.
- A decision that future sessions must not silently reverse belongs in `MEMORY.md`.

### `data`

Owns the Drizzle schema and migrations. Never touches service or route logic.

- Schema files: `src/server/db/schema/{auth,billing,organizations}.ts`, re-exported by
  `index.ts`.
- Additive migrations only; run `pnpm db:generate` then `pnpm db:migrate`.
- **Before changing any `onDelete` on a billing foreign key, read the account-deletion
  invariant in `AGENTS.md`.** A careless cascade can delete a shared workspace's payment
  history.
- Migrations are **not** applied by `pnpm build`; they are a release step.

### `backend`

Owns API routes, domain modules, and server auth. Never edits schema or migrations.

- Routes: `src/app/api/**` (auth catch-all, billing checkout/subscription/cron, Midtrans
  webhook). Domain logic lives in `src/modules/**`.
- Validate every request payload with **Zod**; return typed HTTP errors (e.g.
  `CheckoutValidationError` → 400).
- Webhooks are **idempotent** and signature-verified — see the `security` mode.

### `frontend`

Owns UI under `src/app/**` and `src/components/**`, bound by the **ReUI design system**.

- The `reui` skill is the top authority. Where general frontend advice disagrees with
  ReUI, ReUI wins. Read `.agents/skills/reui/SKILL.md` before writing UI.
- Use installed components first: `data-grid` for tables, `filters`, `kanban`, `Dialog`/
  `AlertDialog` for modals, `sonner` for toasts. Never hand-roll them.
- Never set `height`/`radius`/`padding`/`shadow`/`motion` on ReUI components — use
  `size`/`variant`/`spacing`.
- Every data region needs **empty (with an action), loading (`Skeleton`), and error
  (with Retry)** states.
- `src/components/reui/**` is vendor code, excluded from ESLint — never edit it.
- Write the ReUI plan in your reply before writing code, then run the skill's self-check.

### `security`

Cross-cutting. Any change touching auth, webhooks, cron, or deletion must pass this mode
before it is considered done.

- **Signatures:** the Midtrans webhook verifies
  `SHA512(order_id + status_code + gross_amount + ServerKey)` in constant time. Never
  weaken or skip it.
- **Cron:** `/api/billing/cron/sync-expired` **fails closed** — no `CRON_SECRET` means
  HTTP 500 and nothing runs. Never restore the "only check when set" behaviour.
- **Authorization:** organization role rules live in
  `src/modules/organization/member-management.ts` and must mirror better-auth's
  organization-plugin guards (owner/admin may update/remove; only owner grants owner;
  the last owner can never be demoted or removed).
- **Deletion guard:** `findDeletionBlockers` (`src/modules/account/deletion-guard.ts`)
  protects shared workspaces. Keep it, and keep the cascade semantics in mind.
- Never log secrets, tokens, or raw payloads containing them.

### `qa`

Owns `tests/**` and the truth about whether something works. Reproduces bugs before they
are fixed.

- Unit: `pnpm test` (`node:test`, files matching `tests/*.test.ts`).
- Integration: `pnpm test:integration` — reads **`INTEGRATION_TEST_DATABASE_URL`**, not
  `DATABASE_URL`, and fails closed on a non-disposable DB name. Set
  `MIDTRANS_SERVER_KEY="SB-Mid-server-test-integration-key-32chars"` or every webhook
  scenario fails on signature.
- A suite that reports `skipped 10` is **not** a passing suite. Demand real counts.
- Test real code paths; do not mock unless there is no alternative, and say why.

### `review`

Read-only. Never edits, never pushes. Reviews a finished change against the repo's rules.

- Reads the diff against `main`, the surrounding code, and the tests before forming an
  opinion. Reports findings; the caller decides what to fix.
- Checks specifically for: broken invariants listed in `AGENTS.md`/`MEMORY.md`, missing
  ReUI states, unguarded authorization, and weakened webhook/cron security.

### `docs`

Owns `README.md`, `AGENTS.md`, and `.agents/**`. Keeps them true to the code.

- **Never edit inside the `BEGIN:nextjs-agent-rules` or `BEGIN:reui-agent-rules` markers
  in `AGENTS.md`** — those blocks are regenerated by tooling.
- Prefer editing existing docs over creating new ones.

### `devops`

Owns CI, deployment config, and release mechanics.

- `.github/workflows/ci.yml` runs two jobs: *Lint, Typecheck, and Build* and *PostgreSQL
  Integration & Concurrency* (spins up `postgres:16-alpine` on port 5433).
- Vercel rejects deploys from commit authors who are not team members — see the note in
  `MEMORY.md`.
- Migrations are a release step, not a build step. `vercel.json` schedules the cron.

## Escalation between modes

A mode that hits another mode's territory **hands off** rather than reaching across:

- `frontend` needing a new API field → `backend`.
- `backend` needing a column → `data`.
- anything touching auth/webhooks/cron/deletion → `security` must sign off.
- any mode finishing work → `qa` for verification, then `review` before merge.

Under **autopilot**, these handoffs still happen but are not emitted to the user turn by
turn: `delivery-lead` sequences them internally and reports the sequence once at the end.

Handoff format and the activation line are in `PROTOCOL.md`.
