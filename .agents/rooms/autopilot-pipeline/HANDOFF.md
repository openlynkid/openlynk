## Handoff → devops
Context:   Autopilot pipeline landed in-repo (D-6): delivery-lead mode + sub-agent,
           autonomy policy, merge gate, never_confirm on the writing agents.
Artifacts: .agents/PROTOCOL.md, .agents/ROLES.md, .agents/agents/delivery-lead.md,
           .agents/agents/*.md (permission_mode), .agents/MEMORY.md (D-6)
Needed:    Deploy the cron automation (Step 9) once the owner confirms cadence and work
           source. Nothing is deployed yet; no secret has been forwarded.
Risk:      This sandbox has no local Agent Canvas backend — deploy targets
           https://app.all-hands.dev/api/automation/v1. Requires explicit owner consent.
