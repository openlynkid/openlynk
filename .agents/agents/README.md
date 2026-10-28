# Developer sub-agents

Project-level OpenHands file-based agents for the SaaS Starter Kit. Each file is a
sub-agent: YAML frontmatter configures it, the Markdown body is its system prompt.

These are scanned when a conversation starts, not hot-reloaded — start a new
conversation after changing or adding a file here.

## The team

| Agent | Owns | Never touches |
| :--- | :--- | :--- |
| `delivery-lead` | One work item end to end: criteria, sequence, gate, report | production source (it delegates) |
| `backend-developer` | `src/app/api/**`, `src/modules/**`, `src/server/auth/**` | db schema/migrations |
| `frontend-developer` | `src/app/**`, `src/components/**` (ReUI design system) | `src/components/reui/**` internals |
| `database-migration-engineer` | `src/server/db/schema/**`, `netlify/database/migrations/**`, `drizzle.config.ts` | service/route logic |
| `code-reviewer` | Read-only review of any change | writes anything |
| `qa-test-engineer` | `tests/**` | production source (except minimal bug fixes) |

## Permission mode

Every agent here runs with `permission_mode: never_confirm`, so no run halts on a
confirmation prompt. The guardrail is therefore the **abort list** in
`.agents/PROTOCOL.md` (autonomy policy), not the prompt: an agent that hits a listed
invariant stops and reports the item as aborted. `code-reviewer` and `delivery-lead` are
also `never_confirm`; `code-reviewer` stays read-only by its `tools` list.

## How to delegate

Use the `task` tool and name the agent. Give it a concrete, bounded request.

```
task: frontend-developer
prompt: Add an empty state with an action to the organizations members grid.
```

```
task: code-reviewer
prompt: Review the changes on this branch against main.
```

## Workflow

A change usually flows through the team like this:

1. `database-migration-engineer` — if the change alters the schema, it lands first.
2. `backend-developer` and/or `frontend-developer` — implement the behavior.
3. `qa-test-engineer` — covers the new behavior and reproduces reported bugs.
4. `code-reviewer` — reviews the finished change before it is merged.

## Verification commands

The agents run these and report the results; keep them green.

| Command | Purpose |
| :--- | :--- |
| `pnpm typecheck` | TypeScript strict check |
| `pnpm lint` | ESLint |
| `pnpm test` | Unit tests (`node:test`) |
| `pnpm test:integration` | PostgreSQL integration tests |

`pnpm test:integration` needs a disposable database in `INTEGRATION_TEST_DATABASE_URL`.
The harness fails closed on any database name that does not contain `test`,
`disposable`, or `scratch`, and on any non-local host. A throwaway instance:

```bash
docker run -d --name saas-pg-test \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgrespassword \
  -e POSTGRES_DB=saas_starterkit_test -p 5433:5432 postgres:16-alpine

INTEGRATION_TEST_DATABASE_URL="postgresql://postgres:postgrespassword@127.0.0.1:5433/saas_starterkit_test" \
  pnpm test:integration
```

## Adding an agent

Create `<name>.md` here with `name` matching the filename exactly, at least two
`<example>` tags in the description, and only the tools the agent needs. Full field
reference: <https://docs.openhands.dev/sdk/guides/agent-file-based>.
