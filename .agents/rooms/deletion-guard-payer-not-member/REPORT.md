# Delivery Report — onDelete audit vs the deletion-guard invariant

**Item:** `[security]` Audit every `onDelete` on billing foreign keys against D-3
(`.agents/TASKS.md`) · **Branch:** `fix/deletion-guard-payer-not-member`
**Outcome:** delivered — one real hole found and fixed · **Date:** 2026-10-26

## Acceptance criteria

| Criterion | Result |
| :--- | :--- |
| Every foreign key enumerated from the SQL migrations, not just the TS schema | met — 12 FKs read from `src/server/db/migrations/*.sql` |
| Each cascade judged against the D-3 invariant | met — see table below |
| A real hole is reproduced on a real database before being fixed | met — `blockers = []` for a removed payer, then both rows gone |
| The fix strengthens, never weakens, the guard | met — a new block is added; no existing block removed |
| No trap: every new block has a self-serve escape route | met — cancelling the plan or letting it lapse clears it (D-3 already allows a lapsed plan) |

## The audit — 12 foreign keys

| # | Column | Target | onDelete | Verdict |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `account.user_id` | `user` | cascade | correct — auth artefact of the user |
| 2 | `session.user_id` | `user` | cascade | correct |
| 3 | `invitation.organization_id` | `organization` | cascade | correct |
| 4 | `invitation.inviter_id` | `user` | cascade | correct |
| 5 | `member.organization_id` | `organization` | cascade | correct |
| 6 | `member.user_id` | `user` | cascade | correct — the guard's sole-owner rule covers the shared case |
| 7 | `order.user_id` | `user` | cascade | **at risk** — billing history of a shared workspace |
| 8 | `order.organization_id` | `organization` | cascade | correct |
| 9 | `payment_transaction.order_id` | `order` | cascade | correct |
| 10 | `subscription.user_id` | `user` | cascade | **at risk** — the live plan of a shared workspace |
| 11 | `subscription.organization_id` | `organization` | cascade | correct |
| 12 | `subscription.order_id` | `order` | set null | correct — deliberate (Scenario F) |

Rows 7 and 10 are the ones D-3 exists for. The schema choices are right; the guard's
coverage of them was not.

Verified against the migrated database itself, not just the TS schema — exactly 12
foreign keys exist, and each row above matches `pg_constraint.confdeltype`:

```
$ psql -c "SELECT count(*) FROM pg_constraint WHERE contype='f';"
12
```

No other code path can bypass the guard: `organization` in `deleteSoleMemberOrganizations`
is the only explicit `.delete()` in `src/`, and no migration contains a `DELETE FROM`.

## The hole

`collectOrgMembershipFacts` reached organizations only through `member` rows. An owner may
remove a member (and therefore the payer) while the plan is live. The cascade follows
`subscription.user_id` / `order.user_id`, not membership, so the removed payer's account
deletion still destroyed the organization's subscription and order — the exact loss D-3
prevents. Reproduced against real PostgreSQL:

```
BLOCKERS_FOR_NON_MEMBER_PAYER = []
SUBSCRIPTIONS_LEFT_FOR_ORG = 0
ORDERS_LEFT_FOR_ORG = 0
```

## The fix

- `OrgMembershipFacts` gains `isMember`.
- `collectOrgMembershipFacts` now also inspects organizations whose live plan the user pays
  for but does not belong to, marking them `isMember: false`.
- `evaluateDeletionBlockers` blocks such a payer while the plan is entitled, and does not
  apply the sole-owner rule to them (a non-member cannot be the last owner).
- `deleteSoleMemberOrganizations` only removes organizations the user is still a member of,
  so it can never delete a payer-only workspace.

## Verification (real counts)

| Command | Result |
| :--- | :--- |
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm test` | `tests 143 · pass 143 · fail 0 · skipped 0` (was 140; +3 unit cases) |
| `pnpm test:integration` (empty DB, `CI=true`) | exit 0 · `tests 20 / pass 20 / fail 0 / skipped 0` (was 19; +1 scenario) |
| `pnpm test:integration` (no DB) | exit 1 · `pass 0 / fail 20 / skipped 0` — fail-loud intact |
| `pnpm build` | exit 0 |

The new integration scenario is "blocks a payer who was removed from the organization but
still funds its plan"; it also asserts cleanup leaves the payer-only organization alone.

## Review verdict

**Approve.** The diff adds a block and removes none. For a payer-only row, `role` and
`ownerCount` are placeholders and are not read by any rule that applies to non-members;
`deleteSoleMemberOrganizations` skips them. The previously hidden race between the two
integration files is fixed by the parent PR, so this suite is now reliable.

## Decisions taken without asking

- Fixed the guard rather than blocking member removal while a plan is live: the latter is a
  permanent trap, because nothing lets the payer move billing to another owner.
- Only a live plan blocks; a lapsed plan still allows deletion, consistent with D-3.
- Recorded as D-8 with its guard, and refreshed the scenario counts the change invalidated.

## Blocker

None.
