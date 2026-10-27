import "./test-env.ts";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canManageInvitations,
  getMemberCapabilities,
  type MemberManagementContext,
  type MemberSummary,
} from "../src/modules/organization/member-management.ts";

function member(id: string, role: MemberSummary["role"]): MemberSummary {
  return { id, role };
}

function context(overrides: Partial<MemberManagementContext> = {}): MemberManagementContext {
  return {
    viewerRole: "owner",
    viewerMemberId: "mem_viewer",
    members: [member("mem_viewer", "owner"), member("mem_other", "member")],
    ...overrides,
  };
}

describe("Member management rules (mirror better-auth guards)", () => {
  it("lets an owner promote a member to owner, the escape route out of a sole-owner block", () => {
    const { assignableRoles, canRemove } = getMemberCapabilities(
      member("mem_other", "member"),
      context()
    );
    assert.deepEqual(assignableRoles, ["owner", "admin"]);
    assert.equal(canRemove, true);
  });

  it("never offers the role a member already holds", () => {
    const { assignableRoles } = getMemberCapabilities(
      member("mem_other", "admin"),
      context()
    );
    assert.deepEqual(assignableRoles, ["owner", "member"]);
  });

  it("hides every action on the last remaining owner", () => {
    const { assignableRoles, canRemove } = getMemberCapabilities(
      member("mem_viewer", "owner"),
      context()
    );
    assert.deepEqual(assignableRoles, []);
    assert.equal(canRemove, false);
  });

  it("allows demoting an owner once a second owner exists", () => {
    const { assignableRoles, canRemove } = getMemberCapabilities(
      member("mem_other", "owner"),
      context({
        members: [
          member("mem_viewer", "owner"),
          member("mem_other", "owner"),
          member("mem_third", "member"),
        ],
      })
    );
    assert.deepEqual(assignableRoles, ["admin", "member"]);
    assert.equal(canRemove, true);
  });

  it("stops an admin from touching an owner", () => {
    const { assignableRoles, canRemove } = getMemberCapabilities(
      member("mem_other", "owner"),
      context({ viewerRole: "admin", members: [member("mem_other", "owner")] })
    );
    assert.deepEqual(assignableRoles, []);
    assert.equal(canRemove, false);
  });

  it("lets an admin move a member, but never mint a new owner", () => {
    const { assignableRoles, canRemove } = getMemberCapabilities(
      member("mem_other", "member"),
      context({
        viewerRole: "admin",
        members: [member("mem_boss", "owner"), member("mem_other", "member")],
      })
    );
    assert.deepEqual(assignableRoles, ["admin"]);
    assert.equal(canRemove, true);
  });

  it("gives a plain member no control over the roster", () => {
    const { assignableRoles, canRemove } = getMemberCapabilities(
      member("mem_other", "member"),
      context({
        viewerRole: "member",
        members: [member("mem_boss", "owner"), member("mem_other", "member")],
      })
    );
    assert.deepEqual(assignableRoles, []);
    assert.equal(canRemove, false);
  });

  it("never offers removal of the viewer's own membership row", () => {
    const { canRemove } = getMemberCapabilities(
      member("mem_viewer", "admin"),
      context({
        viewerRole: "owner",
        members: [member("mem_viewer", "admin"), member("mem_boss", "owner")],
      })
    );
    assert.equal(canRemove, false);
  });

  it("reserves invitation management for owners and admins", () => {
    assert.equal(canManageInvitations("owner"), true);
    assert.equal(canManageInvitations("admin"), true);
    assert.equal(canManageInvitations("member"), false);
  });
});
