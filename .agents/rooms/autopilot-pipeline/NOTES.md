# Room: autopilot delivery pipeline

**Owner mode:** `delivery-lead` · **Opened:** 2026-10-26 · **Status:** in progress

Tracks the work that made the office run without stopping to ask (D-6).

## Goal

One work item goes from planning to merged code with no mid-flight confirmation, and the
owner reads exactly one Delivery Report.

## Findings

- The brake was in three places, not one: the `[mode: x]` + one-mode-per-reply rule in
  `PROTOCOL.md`, `permission_mode: confirm_risky` on the four writing sub-agents, and the
  absence of any mode that owned the whole sequence.
- Valid `permission_mode` values are exactly `always_confirm`, `never_confirm`,
  `confirm_risky` (SDK agent-file guide). `confirm_risky` needs a security analyzer.
- Agent files are scanned at conversation start, so a `permission_mode` change needs a new
  conversation before it takes effect.
- The cloud automation API (`https://app.all-hands.dev/api/automation/v1`) is reachable
  with `OPENHANDS_API_KEY`; this sandbox has **no** local Agent Canvas backend
  (`localhost:8001` refuses connections), so Step 9 can only be deployed against cloud.
- `RUNTIME_URL` is public here, so event triggers are technically possible — but cron
  polling is the portable choice and is what the plan specifies.

## Decisions made in-room

- Keep the mode boundaries; remove only the stops (consistent with D-1).
- The guardrail is the **abort list**, not a confirmation prompt — a rail the pipeline
  never crosses needs no prompt.
- Autonomy is raised on the writing agents only after the policy and merge gate exist, so
  the blast radius is bounded by the gate.

## Dead ends

- Considered deleting the mode system for one monolithic agent. Rejected: the boundaries
  are what keep the template from rotting; the stop was the problem, not the roles.

## Next

- Deploy the cron automation (Step 9) after the owner confirms cadence and work source.
- Step 10 (GitHub event triggers) is optional and left undeployed.
