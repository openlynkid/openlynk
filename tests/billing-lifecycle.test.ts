import "./test-env.ts";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculatePeriodEnd,
  isLeapYear,
  getDaysInUTCMonth,
} from "../src/modules/billing/date-utils.ts";
import {
  isSubscriptionActive,
  determinePaymentStatus,
  shouldUpdateOrderStatus,
  BillingService,
} from "../src/modules/billing/service.ts";

describe("Phase 2.4.1 Billing Lifecycle & Entitlement Unit Tests", () => {
  describe("1. Date Arithmetic & Calendar Boundary Handling", () => {
    it("should correctly identify leap years", () => {
      assert.equal(isLeapYear(2024), true); // divisible by 4
      assert.equal(isLeapYear(2026), false); // non-leap
      assert.equal(isLeapYear(1900), false); // century non-leap
      assert.equal(isLeapYear(2000), true); // 400-year leap
    });

    it("should return correct days in UTC months", () => {
      assert.equal(getDaysInUTCMonth(2026, 0), 31); // Jan
      assert.equal(getDaysInUTCMonth(2026, 1), 28); // Feb non-leap
      assert.equal(getDaysInUTCMonth(2024, 1), 29); // Feb leap year
      assert.equal(getDaysInUTCMonth(2026, 3), 30); // April
    });

    it("should clamp month-end correctly for monthly intervals (Jan 31 -> Feb 28 in non-leap year)", () => {
      const start = new Date("2026-01-31T15:30:00.000Z");
      const end = calculatePeriodEnd(start, "monthly");

      assert.equal(end.toISOString(), "2026-02-28T15:30:00.000Z");
    });

    it("should clamp month-end correctly for monthly intervals (Jan 31 -> Feb 29 in leap year)", () => {
      const start = new Date("2024-01-31T12:00:00.000Z");
      const end = calculatePeriodEnd(start, "monthly");

      assert.equal(end.toISOString(), "2024-02-29T12:00:00.000Z");
    });

    it("should clamp month-end correctly for 31-day months transitioning to 30-day months (March 31 -> April 30)", () => {
      const start = new Date("2026-03-31T08:00:00.000Z");
      const end = calculatePeriodEnd(start, "monthly");

      assert.equal(end.toISOString(), "2026-04-30T08:00:00.000Z");
    });

    it("should preserve exact date when day exists in next month (Jan 15 -> Feb 15)", () => {
      const start = new Date("2026-01-15T10:20:30.450Z");
      const end = calculatePeriodEnd(start, "monthly");

      assert.equal(end.toISOString(), "2026-02-15T10:20:30.450Z");
    });

    it("should handle year roll-over (Dec 15 -> Jan 15 of next year)", () => {
      const start = new Date("2026-12-15T10:00:00.000Z");
      const end = calculatePeriodEnd(start, "monthly");

      assert.equal(end.toISOString(), "2027-01-15T10:00:00.000Z");
    });

    it("should clamp Feb 29 leap year to Feb 28 for yearly interval", () => {
      const start = new Date("2024-02-29T18:00:00.000Z");
      const end = calculatePeriodEnd(start, "yearly");

      assert.equal(end.toISOString(), "2025-02-28T18:00:00.000Z");
    });

    it("should calculate standard 1-year addition for yearly intervals", () => {
      const start = new Date("2026-06-15T00:00:00.000Z");
      const end = calculatePeriodEnd(start, "yearly");

      assert.equal(end.toISOString(), "2027-06-15T00:00:00.000Z");
    });

    it("should calculate 100-year perpetual addition for lifetime interval", () => {
      const start = new Date("2026-10-18T12:00:00.000Z");
      const end = calculatePeriodEnd(start, "lifetime");

      assert.equal(end.toISOString(), "2126-10-18T12:00:00.000Z");
    });
  });

  describe("2. Centralized isSubscriptionActive & Boundary Conditions", () => {
    const fixedNow = new Date("2026-10-18T12:00:00.000Z");

    it("should return true for active subscription with future currentPeriodEnd", () => {
      const sub = {
        status: "active",
        billingPeriod: "monthly",
        currentPeriodEnd: new Date("2026-10-18T12:00:01.000Z"), // 1 second in future
      };
      assert.equal(isSubscriptionActive(sub, fixedNow), true);
    });

    it("should return false for exact boundary currentPeriodEnd === now (expired)", () => {
      const sub = {
        status: "active",
        billingPeriod: "monthly",
        currentPeriodEnd: new Date("2026-10-18T12:00:00.000Z"), // exactly now
      };
      assert.equal(isSubscriptionActive(sub, fixedNow), false);
    });

    it("should return false for past currentPeriodEnd even if status is 'active'", () => {
      const sub = {
        status: "active",
        billingPeriod: "monthly",
        currentPeriodEnd: new Date("2026-10-18T11:59:59.000Z"), // past
      };
      assert.equal(isSubscriptionActive(sub, fixedNow), false);
    });

    it("should return false if status is not 'active' even if currentPeriodEnd is in future", () => {
      const subRefunded = {
        status: "refunded",
        billingPeriod: "monthly",
        currentPeriodEnd: new Date("2026-12-01T00:00:00.000Z"),
      };
      assert.equal(isSubscriptionActive(subRefunded, fixedNow), false);

      const subCanceled = {
        status: "canceled",
        billingPeriod: "monthly",
        currentPeriodEnd: new Date("2026-12-01T00:00:00.000Z"),
      };
      assert.equal(isSubscriptionActive(subCanceled, fixedNow), false);

      const subExpired = {
        status: "expired",
        billingPeriod: "monthly",
        currentPeriodEnd: new Date("2026-12-01T00:00:00.000Z"),
      };
      assert.equal(isSubscriptionActive(subExpired, fixedNow), false);
    });

    it("should return true for lifetime subscriptions regardless of date as long as status is 'active'", () => {
      const subLifetimePastDate = {
        status: "active",
        billingPeriod: "lifetime",
        currentPeriodEnd: new Date("2020-01-01T00:00:00.000Z"), // past date
      };
      assert.equal(isSubscriptionActive(subLifetimePastDate, fixedNow), true);
    });

    it("should return false for lifetime subscription if status is 'refunded'", () => {
      const subLifetimeRefunded = {
        status: "refunded",
        billingPeriod: "lifetime",
        currentPeriodEnd: new Date("2126-01-01T00:00:00.000Z"),
      };
      assert.equal(isSubscriptionActive(subLifetimeRefunded, fixedNow), false);
    });

    it("should return false for null or undefined subscription", () => {
      assert.equal(isSubscriptionActive(null, fixedNow), false);
      assert.equal(isSubscriptionActive(undefined, fixedNow), false);
    });
  });

  describe("3. Payment State Transitions & Refund Semantics", () => {
    it("should correctly classify both 'refund' and 'partial_refund' to order status 'refund'", () => {
      const statusFull = determinePaymentStatus("refund");
      assert.equal(statusFull.finalStatus, "refund");
      assert.equal(statusFull.isSuccess, false);

      const statusPartial = determinePaymentStatus("partial_refund");
      assert.equal(statusPartial.finalStatus, "refund");
      assert.equal(statusPartial.isSuccess, false);
    });

    it("should permit transition from settlement to refund", () => {
      assert.equal(shouldUpdateOrderStatus("settlement", "refund"), true);
      assert.equal(shouldUpdateOrderStatus("settlement", "settlement"), true); // idempotent
      assert.equal(shouldUpdateOrderStatus("settlement", "pending"), false); // delayed event ignored
      assert.equal(shouldUpdateOrderStatus("settlement", "expire"), false); // delayed event ignored
    });

    it("should lock order status once in 'refund' against delayed settlement or capture", () => {
      // Once refunded, late settlement or capture CANNOT reactivate the order
      assert.equal(shouldUpdateOrderStatus("refund", "settlement"), false);
      assert.equal(shouldUpdateOrderStatus("refund", "capture"), false);
      assert.equal(shouldUpdateOrderStatus("refund", "pending"), false);
      assert.equal(shouldUpdateOrderStatus("refund", "refund"), true); // idempotent replay
    });
  });

  describe("4. Mock BillingService Entitlement & Lifecycle Methods", () => {
    const fixedNow = new Date("2026-10-18T12:00:00.000Z");

    const activeUserSub = {
      id: "sub_user_active",
      orderId: "ord_user_1",
      userId: "user_alice",
      organizationId: null,
      planId: "starter",
      status: "active",
      billingPeriod: "monthly",
      currentPeriodStart: new Date("2026-10-01T00:00:00.000Z"),
      currentPeriodEnd: new Date("2026-11-01T00:00:00.000Z"), // valid future
      cancelAtPeriodEnd: false,
      metadata: {},
      createdAt: new Date("2026-10-01T00:00:00.000Z"),
      updatedAt: new Date("2026-10-01T00:00:00.000Z"),
    };

    const expiredUserSub = {
      id: "sub_user_expired",
      orderId: "ord_user_2",
      userId: "user_bob",
      organizationId: null,
      planId: "pro",
      status: "active", // DB column still says 'active'!
      billingPeriod: "monthly",
      currentPeriodStart: new Date("2026-08-01T00:00:00.000Z"),
      currentPeriodEnd: new Date("2026-09-01T00:00:00.000Z"), // in past!
      cancelAtPeriodEnd: false,
      metadata: {},
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
      updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    };

    const boundaryUserSub = {
      id: "sub_user_boundary",
      orderId: "ord_user_3",
      userId: "user_charlie",
      organizationId: null,
      planId: "starter",
      status: "active",
      billingPeriod: "monthly",
      currentPeriodStart: new Date("2026-09-18T12:00:00.000Z"),
      currentPeriodEnd: new Date("2026-10-18T12:00:00.000Z"), // exactly fixedNow!
      cancelAtPeriodEnd: false,
      metadata: {},
      createdAt: new Date("2026-09-18T12:00:00.000Z"),
      updatedAt: new Date("2026-09-18T12:00:00.000Z"),
    };

    const lifetimeSub = {
      id: "sub_user_lifetime",
      orderId: "ord_user_4",
      userId: "user_david",
      organizationId: null,
      planId: "lifetime",
      status: "active",
      billingPeriod: "lifetime",
      currentPeriodStart: new Date("2025-01-01T00:00:00.000Z"),
      currentPeriodEnd: new Date("2125-01-01T00:00:00.000Z"),
      cancelAtPeriodEnd: false,
      metadata: {},
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
      updatedAt: new Date("2025-01-01T00:00:00.000Z"),
    };

    function extractParams(node: unknown): string[] {
      const params: string[] = [];
      function walk(curr: unknown, d = 0) {
        if (!curr || typeof curr !== "object" || d > 8) return;
        const obj = curr as Record<string, unknown>;
        if (typeof obj.value === "string") {
          params.push(obj.value);
        }
        if (Array.isArray(obj.value)) {
          for (const item of obj.value) {
            if (typeof item === "string") params.push(item);
            walk(item, d + 1);
          }
        }
        for (const k of Object.keys(obj)) {
          if (k !== "table" && k !== "column") {
            walk(obj[k], d + 1);
          }
        }
      }
      walk(node);
      return params;
    }

    const mockDb = {
      select: () => ({
        from: () => ({
          where: (condition: unknown) => ({
            orderBy: () => ({
              limit: async () => {
                const params = extractParams(condition);
                if (params.includes("user_alice")) return [activeUserSub];
                if (params.includes("user_bob")) return [expiredUserSub];
                if (params.includes("user_charlie")) return [boundaryUserSub];
                if (params.includes("user_david")) return [lifetimeSub];
                return [];
              },
            }),
          }),
        }),
      }),
    } as unknown as ConstructorParameters<typeof BillingService>[0];

    const service = new BillingService(mockDb);

    it("should return subscription when actively entitled", async () => {
      const sub = await service.getActiveSubscription({ userId: "user_alice" }, fixedNow);
      assert.ok(sub);
      assert.equal(sub.id, "sub_user_active");
      assert.equal(sub.planId, "starter");

      const entitlement = await service.checkEntitlement({ userId: "user_alice" }, fixedNow);
      assert.equal(entitlement.hasAccess, true);
      assert.equal(entitlement.planId, "starter");
    });

    it("should return null when subscription currentPeriodEnd is in the past even if DB status is active", async () => {
      const sub = await service.getActiveSubscription({ userId: "user_bob" }, fixedNow);
      assert.equal(sub, null);

      const entitlement = await service.checkEntitlement({ userId: "user_bob" }, fixedNow);
      assert.equal(entitlement.hasAccess, false);
      assert.equal(entitlement.planId, "free");
      assert.equal(entitlement.subscription, null);
    });

    it("should return null when subscription currentPeriodEnd is exactly now (boundary test)", async () => {
      const sub = await service.getActiveSubscription({ userId: "user_charlie" }, fixedNow);
      assert.equal(sub, null);

      const entitlement = await service.checkEntitlement({ userId: "user_charlie" }, fixedNow);
      assert.equal(entitlement.hasAccess, false);
      assert.equal(entitlement.planId, "free");
    });

    it("should grant access for lifetime subscriptions", async () => {
      const sub = await service.getActiveSubscription({ userId: "user_david" }, fixedNow);
      assert.ok(sub);
      assert.equal(sub.planId, "lifetime");

      const entitlement = await service.checkEntitlement({ userId: "user_david" }, fixedNow);
      assert.equal(entitlement.hasAccess, true);
      assert.equal(entitlement.planId, "lifetime");
    });
  });
});
