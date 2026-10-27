import "./test-env.ts";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  describeDeletionBlockers,
  evaluateDeletionBlockers,
  type OrgMembershipFacts,
} from "../src/modules/account/deletion-guard.ts";

function facts(overrides: Partial<OrgMembershipFacts> = {}): OrgMembershipFacts {
  return {
    organizationId: "org_acme",
    organizationName: "Acme",
    role: "member",
    memberCount: 2,
    ownerCount: 1,
    hasActivePaidPlan: false,
    isMember: true,
    ...overrides,
  };
}

describe("Account deletion guard (shared-workspace protection)", () => {
  it("allows deletion when the user belongs to no organization", () => {
    assert.deepEqual(evaluateDeletionBlockers([]), []);
  });

  it("allows deletion when the user is the only member of the organization", () => {
    const blockers = evaluateDeletionBlockers([
      facts({ role: "owner", memberCount: 1, ownerCount: 1, hasActivePaidPlan: true }),
    ]);
    assert.deepEqual(blockers, []);
  });

  it("blocks a sole owner of an organization that still has other members", () => {
    const blockers = evaluateDeletionBlockers([
      facts({ role: "owner", memberCount: 2, ownerCount: 1 }),
    ]);
    assert.equal(blockers.length, 1);
    assert.equal(blockers[0].reason, "sole_owner");
    assert.equal(blockers[0].organizationId, "org_acme");
  });

  it("blocks the payer of a shared organization's plan even when not the owner", () => {
    const blockers = evaluateDeletionBlockers([
      facts({ role: "admin", memberCount: 3, ownerCount: 1, hasActivePaidPlan: true }),
    ]);
    assert.equal(blockers.length, 1);
    assert.equal(blockers[0].reason, "organization_payer");
  });

  it("allows a plain member of a shared organization who is not the payer", () => {
    const blockers = evaluateDeletionBlockers([
      facts({ role: "member", memberCount: 4, ownerCount: 1, hasActivePaidPlan: false }),
    ]);
    assert.deepEqual(blockers, []);
  });

  it("allows an owner when another owner remains and they are not the payer", () => {
    const blockers = evaluateDeletionBlockers([
      facts({ role: "owner", memberCount: 3, ownerCount: 2, hasActivePaidPlan: false }),
    ]);
    assert.deepEqual(blockers, []);
  });

  it("reports one blocker per affected organization", () => {
    const blockers = evaluateDeletionBlockers([
      facts({ organizationId: "org_a", organizationName: "A", role: "owner", ownerCount: 1 }),
      facts({ organizationId: "org_b", organizationName: "B", hasActivePaidPlan: true }),
      facts({ organizationId: "org_c", organizationName: "C" }),
    ]);
    assert.equal(blockers.length, 2);
    assert.deepEqual(
      blockers.map((b) => b.organizationId),
      ["org_a", "org_b"]
    );
  });

  it("does not report a sole owner twice when they are also the payer", () => {
    const blockers = evaluateDeletionBlockers([
      facts({ role: "owner", ownerCount: 1, hasActivePaidPlan: true }),
    ]);
    assert.equal(blockers.length, 1);
    assert.equal(blockers[0].reason, "sole_owner");
  });

  it("names each organization in the message a user will read", () => {
    const message = describeDeletionBlockers([
      { reason: "sole_owner", organizationId: "org_a", organizationName: "Acme" },
      { reason: "organization_payer", organizationId: "org_b", organizationName: "Globex" },
    ]);
    assert.match(message, /only owner of "Acme"/);
    assert.match(message, /pay for "Globex"/);
  });

  it("tells the user how to clear a sole-owner block", () => {
    const message = describeDeletionBlockers([
      { reason: "sole_owner", organizationId: "org_a", organizationName: "Acme" },
    ]);
    assert.match(message, /promote another member to owner/i);
  });

  it("does not block a payer whose organization plan has lapsed", () => {
    // `hasActivePaidPlan` already encodes entitlement: a lapsed subscription sets it
    // false, so the user can delete without waiting on support.
    const blockers = evaluateDeletionBlockers([
      facts({ role: "admin", memberCount: 3, ownerCount: 1, hasActivePaidPlan: false }),
    ]);
    assert.deepEqual(blockers, []);
  });

  it("treats a workspace the user alone belongs to as removable, not shared", () => {
    // Same organization, two shapes: alone is deletable, shared with others is not.
    const alone = evaluateDeletionBlockers([
      facts({ role: "owner", memberCount: 1, ownerCount: 1, hasActivePaidPlan: true }),
    ]);
    const shared = evaluateDeletionBlockers([
      facts({ role: "owner", memberCount: 2, ownerCount: 1, hasActivePaidPlan: true }),
    ]);
    assert.deepEqual(alone, []);
    assert.equal(shared.length, 1);
  });

  it("blocks a payer who is no longer a member of the organization they fund", () => {
    // The cascade follows `userId`, not membership: an owner can remove the payer, but
    // the payer's deletion still destroys the organization's live plan.
    const blockers = evaluateDeletionBlockers([
      facts({ isMember: false, memberCount: 3, ownerCount: 1, hasActivePaidPlan: true }),
    ]);
    assert.equal(blockers.length, 1);
    assert.equal(blockers[0].reason, "organization_payer");
  });

  it("allows a former member who no longer funds a live plan", () => {
    const blockers = evaluateDeletionBlockers([
      facts({ isMember: false, memberCount: 3, ownerCount: 1, hasActivePaidPlan: false }),
    ]);
    assert.deepEqual(blockers, []);
  });

  it("does not apply the sole-owner rule to a former member", () => {
    // A non-member cannot be the last owner, so a stale role must not block deletion.
    const blockers = evaluateDeletionBlockers([
      facts({
        isMember: false,
        role: "owner",
        memberCount: 2,
        ownerCount: 1,
        hasActivePaidPlan: false,
      }),
    ]);
    assert.deepEqual(blockers, []);
  });
});
