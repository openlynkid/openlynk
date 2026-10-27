import "./test-env.ts";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { verifyUserOrgMembership } from "../src/server/auth/org-auth.ts";
import { organization, member } from "../src/server/db/schema/organizations.ts";

describe("Organization Authorization & Tenant Isolation (Production Function)", () => {
  type Role = "owner" | "admin" | "member";

  interface MockDbState {
    organizations: Array<{ id: string; name: string; slug: string; logo: string | null; metadata: string | null; createdAt: Date }>;
    members: Array<{ id: string; organizationId: string; userId: string; role: Role; createdAt: Date }>;
  }

  const mockDbState: MockDbState = {
    organizations: [
      { id: "org_acme", name: "Acme Corp", slug: "acme", logo: null, metadata: null, createdAt: new Date() },
      { id: "org_globex", name: "Globex", slug: "globex", logo: null, metadata: null, createdAt: new Date() },
    ],
    members: [
      { id: "m1", organizationId: "org_acme", userId: "user_alice", role: "owner", createdAt: new Date() },
      { id: "m2", organizationId: "org_acme", userId: "user_bob", role: "admin", createdAt: new Date() },
      { id: "m3", organizationId: "org_acme", userId: "user_charlie", role: "member", createdAt: new Date() },
      { id: "m4", organizationId: "org_globex", userId: "user_david", role: "owner", createdAt: new Date() },
    ],
  };

  function extractParams(node: unknown, depth = 0): string[] {
    if (!node || typeof node !== "object" || depth > 10) return [];
    const vals: string[] = [];
    const obj = node as Record<string, unknown>;
    if (typeof obj.value === "string") vals.push(obj.value);
    if (Array.isArray(obj.queryChunks)) {
      for (const ch of obj.queryChunks) vals.push(...extractParams(ch, depth + 1));
    }
    if (Array.isArray(obj.conditions)) {
      for (const cond of obj.conditions) vals.push(...extractParams(cond, depth + 1));
    }
    return vals;
  }

  const mockDbClient = {
    select: () => ({
      from: (table: unknown) => ({
        where: (condition: unknown) => ({
          limit: async () => {
            const params = extractParams(condition);
            if (table === organization) {
              const org = mockDbState.organizations.find((o) => params.includes(o.id));
              return org ? [org] : [];
            }
            if (table === member) {
              const mem = mockDbState.members.find(
                (m) => params.includes(m.organizationId) && params.includes(m.userId)
              );
              return mem ? [mem] : [];
            }
            return [];
          },
        }),
      }),
    }),
  } as unknown as Parameters<typeof verifyUserOrgMembership>[2] extends { dbClient?: infer C } ? C : never;

  describe("Checkout Authorization (requireBillingAccess: true)", () => {
    it("should allow organization owner to checkout", async () => {
      const result = await verifyUserOrgMembership("user_alice", "org_acme", {
        requireBillingAccess: true,
        dbClient: mockDbClient,
      });
      assert.equal(result.success, true);
      if (result.success) {
        assert.equal(result.role, "owner");
        assert.equal(result.organization.id, "org_acme");
      }
    });

    it("should allow organization admin to checkout", async () => {
      const result = await verifyUserOrgMembership("user_bob", "org_acme", {
        requireBillingAccess: true,
        dbClient: mockDbClient,
      });
      assert.equal(result.success, true);
      if (result.success) {
        assert.equal(result.role, "admin");
      }
    });

    it("should reject ordinary member from checking out with 403", async () => {
      const result = await verifyUserOrgMembership("user_charlie", "org_acme", {
        requireBillingAccess: true,
        dbClient: mockDbClient,
      });
      assert.equal(result.success, false);
      if (!result.success) {
        assert.equal(result.status, 403);
        assert.match(result.error, /Only organization owners and admins can manage billing/);
      }
    });

    it("should reject unrelated user from checking out with 403", async () => {
      const result = await verifyUserOrgMembership("user_david", "org_acme", {
        requireBillingAccess: true,
        dbClient: mockDbClient,
      });
      assert.equal(result.success, false);
      if (!result.success) {
        assert.equal(result.status, 403);
        assert.match(result.error, /not a member of this organization/);
      }
    });

    it("should return 404 for nonexistent organization without leaking details", async () => {
      const result = await verifyUserOrgMembership("user_alice", "org_nonexistent", {
        requireBillingAccess: true,
        dbClient: mockDbClient,
      });
      assert.equal(result.success, false);
      if (!result.success) {
        assert.equal(result.status, 404);
        assert.equal(result.error, "Organization not found");
      }
    });

    it("should return 400 for malformed organization ID", async () => {
      const r1 = await verifyUserOrgMembership("user_alice", "", { dbClient: mockDbClient });
      assert.equal(r1.success, false);
      if (!r1.success) assert.equal(r1.status, 400);

      const r2 = await verifyUserOrgMembership("user_alice", "   ", { dbClient: mockDbClient });
      assert.equal(r2.success, false);
      if (!r2.success) assert.equal(r2.status, 400);

      const r3 = await verifyUserOrgMembership("user_alice", "a".repeat(150), { dbClient: mockDbClient });
      assert.equal(r3.success, false);
      if (!r3.success) assert.equal(r3.status, 400);
    });
  });

  describe("Subscription Retrieval Authorization (requireBillingAccess: false)", () => {
    it("should allow ordinary members to view organization subscription", async () => {
      const result = await verifyUserOrgMembership("user_charlie", "org_acme", {
        requireBillingAccess: false,
        dbClient: mockDbClient,
      });
      assert.equal(result.success, true);
    });

    it("should reject non-members from viewing organization subscription with 403", async () => {
      const result = await verifyUserOrgMembership("user_david", "org_acme", {
        requireBillingAccess: false,
        dbClient: mockDbClient,
      });
      assert.equal(result.success, false);
      if (!result.success) assert.equal(result.status, 403);
    });

    it("should return 404 for nonexistent organization", async () => {
      const result = await verifyUserOrgMembership("user_david", "org_ghost", {
        requireBillingAccess: false,
        dbClient: mockDbClient,
      });
      assert.equal(result.success, false);
      if (!result.success) assert.equal(result.status, 404);
    });
  });
});
