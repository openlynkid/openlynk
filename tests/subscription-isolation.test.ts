import "./test-env.ts";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BillingService } from "../src/modules/billing/service.ts";
import { subscription } from "../src/server/db/schema/billing.ts";

describe("Subscription Ownership & Tenant Isolation (Production Service)", () => {
  interface SubscriptionRecord {
    id: string;
    orderId: string | null;
    userId: string;
    organizationId: string | null;
    planId: string;
    status: string;
    billingPeriod: string;
    currentPeriodEnd: Date;
    createdAt: Date;
  }

  const subscriptions: SubscriptionRecord[] = [
    {
      id: "sub_user_alice_personal",
      orderId: "ord_alice",
      userId: "user_alice",
      organizationId: null, // Personal subscription
      planId: "starter",
      status: "active",
      billingPeriod: "monthly",
      currentPeriodEnd: new Date("2099-01-01"),
      createdAt: new Date("2026-01-01"),
    },
    {
      id: "sub_acme_org",
      orderId: "ord_acme",
      userId: "user_alice", // Alice paid for Acme
      organizationId: "org_acme",
      planId: "pro",
      status: "active",
      billingPeriod: "monthly",
      currentPeriodEnd: new Date("2099-01-01"),
      createdAt: new Date("2026-02-01"),
    },
    {
      id: "sub_globex_org",
      orderId: "ord_globex",
      userId: "user_david",
      organizationId: "org_globex",
      planId: "lifetime",
      status: "active",
      billingPeriod: "lifetime",
      currentPeriodEnd: new Date("2126-01-01"),
      createdAt: new Date("2026-03-01"),
    },
  ];

  function extractInfo(node: unknown): { params: string[]; isNullOrg: boolean } {
    const params: string[] = [];
    let isNullOrg = false;
    function walk(curr: unknown, d = 0) {
      if (!curr || typeof curr !== "object" || d > 10) return;
      const obj = curr as Record<string, unknown>;
      if (typeof obj.value === "string") {
        params.push(obj.value);
        if (obj.value.includes("is null")) isNullOrg = true;
      }
      if (Array.isArray(obj.value)) {
        for (const item of obj.value) {
          if (typeof item === "string" && item.includes("is null")) isNullOrg = true;
        }
      }
      if (Array.isArray(obj.queryChunks)) {
        for (const ch of obj.queryChunks) walk(ch, d + 1);
      }
      if (Array.isArray(obj.conditions)) {
        for (const cond of obj.conditions) walk(cond, d + 1);
      }
    }
    walk(node);
    return { params, isNullOrg };
  }

  const mockDbClient = {
    select: () => ({
      from: (table: unknown) => ({
        where: (condition: unknown) => ({
          orderBy: () => ({
            limit: async () => {
              if (table === subscription) {
                const { params, isNullOrg } = extractInfo(condition);

                // If user subscription is queried (isNull organizationId)
                if (isNullOrg) {
                  const found = subscriptions
                    .filter(
                      (s) =>
                        s.status === "active" &&
                        s.organizationId === null &&
                        params.includes(s.userId)
                    )
                    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
                  return found[0] ? [found[0]] : [];
                }

                // If organizationId is queried
                const found = subscriptions
                  .filter(
                    (s) =>
                      s.status === "active" &&
                      s.organizationId !== null &&
                      params.includes(s.organizationId)
                  )
                  .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
                return found[0] ? [found[0]] : [];
              }
              return [];
            },
          }),
        }),
      }),
    }),
  } as unknown as ConstructorParameters<typeof BillingService>[0];

  const service = new BillingService(mockDbClient);

  it("should return personal subscription for user without returning org subscription", async () => {
    const sub = await service.getActiveSubscription({ userId: "user_alice" });
    assert.ok(sub);
    assert.equal(sub.id, "sub_user_alice_personal");
    assert.equal(sub.organizationId, null);
    assert.equal(sub.planId, "starter");
  });

  it("should return null for personal user who has no personal subscription even if they created an org sub", async () => {
    const sub = await service.getActiveSubscription({ userId: "user_david" });
    assert.equal(sub, null); // David only has an org subscription, not personal
  });

  it("should return organization subscription when organizationId is requested", async () => {
    const sub = await service.getActiveSubscription({ organizationId: "org_acme" });
    assert.ok(sub);
    assert.equal(sub.id, "sub_acme_org");
    assert.equal(sub.organizationId, "org_acme");
    assert.equal(sub.planId, "pro");
  });

  it("should return null for organization without subscription and NOT leak user personal sub", async () => {
    const sub = await service.getActiveSubscription({ organizationId: "org_unknown" });
    assert.equal(sub, null);
  });
});
