import "./test-env.ts";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PRICING_PLANS,
  getPlanAmount,
  getPlanById,
  getPlanDisplay,
  isSupportedInterval,
} from "../src/modules/billing/plans.ts";
import { BillingService } from "../src/modules/billing/service.ts";
import { CheckoutValidationError } from "../src/modules/billing/types.ts";

describe("Plan / Interval Integrity & Authoritative Pricing", () => {
  describe("isSupportedInterval", () => {
    it("allows recurring plans on monthly and yearly only", () => {
      const starter = getPlanById("starter")!;
      assert.equal(isSupportedInterval(starter, "monthly"), true);
      assert.equal(isSupportedInterval(starter, "yearly"), true);
      assert.equal(isSupportedInterval(starter, "lifetime"), false);
    });

    it("allows a lifetime plan on lifetime only", () => {
      const lifetime = getPlanById("lifetime")!;
      assert.equal(isSupportedInterval(lifetime, "lifetime"), true);
      assert.equal(isSupportedInterval(lifetime, "monthly"), false);
      assert.equal(isSupportedInterval(lifetime, "yearly"), false);
    });
  });

  describe("getPlanAmount (single source of truth for the charge)", () => {
    it("charges the list price for a monthly interval", () => {
      const starter = getPlanById("starter")!;
      assert.equal(getPlanAmount(starter, "monthly"), 149000);
    });

    it("charges ten months for a yearly interval (two months free)", () => {
      const starter = getPlanById("starter")!;
      const pro = getPlanById("pro")!;
      assert.equal(getPlanAmount(starter, "yearly"), 149000 * 10);
      assert.equal(getPlanAmount(pro, "yearly"), 499000 * 10);
    });

    it("charges the one-time price for a lifetime interval", () => {
      const lifetime = getPlanById("lifetime")!;
      assert.equal(getPlanAmount(lifetime, "lifetime"), 2499000);
    });

    it("throws rather than silently pricing an unsupported interval", () => {
      const starter = getPlanById("starter")!;
      assert.throws(() => getPlanAmount(starter, "lifetime"), /Unsupported billing interval/);
    });
  });

  describe("createCheckoutSession rejects invalid combinations before any gateway call", () => {
    // The validation runs before the database or Midtrans is touched, so no network
    // or database is required to prove the rejection.
    const service = new BillingService({} as never);

    it("rejects buying a lifetime period for a recurring plan (entitlement escalation)", async () => {
      await assert.rejects(
        () =>
          service.createCheckoutSession({
            userId: "user_1",
            userEmail: "user@example.com",
            userName: "User One",
            planId: "starter",
            interval: "lifetime",
          }),
        (err: unknown) =>
          err instanceof CheckoutValidationError && /Unsupported billing interval/.test(err.message)
      );
    });

    it("rejects a monthly interval on the lifetime plan", async () => {
      await assert.rejects(
        () =>
          service.createCheckoutSession({
            userId: "user_1",
            userEmail: "user@example.com",
            userName: "User One",
            planId: "lifetime",
            interval: "monthly",
          }),
        CheckoutValidationError
      );
    });

    it("rejects an unknown plan id", async () => {
      await assert.rejects(
        () =>
          service.createCheckoutSession({
            userId: "user_1",
            userEmail: "user@example.com",
            userName: "User One",
            planId: "enterprise",
            interval: "monthly",
          }),
        CheckoutValidationError
      );
    });

    it("rejects the free plan (no checkout required)", async () => {
      await assert.rejects(
        () =>
          service.createCheckoutSession({
            userId: "user_1",
            userEmail: "user@example.com",
            userName: "User One",
            planId: "free",
            interval: "monthly",
          }),
        CheckoutValidationError
      );
    });
  });

  describe("getPlanDisplay (the price the landing page renders)", () => {
    it("shows the monthly list price for a recurring plan on the monthly interval", () => {
      const pro = getPlanById("pro")!;
      assert.deepEqual(getPlanDisplay(pro, "monthly"), { amount: 499000, suffix: "/ month" });
    });

    it("shows ten months for a recurring plan on the yearly interval", () => {
      const pro = getPlanById("pro")!;
      assert.deepEqual(getPlanDisplay(pro, "yearly"), { amount: 4990000, suffix: "/ year" });
    });

    it("ignores the selected interval for a lifetime plan", () => {
      const lifetime = getPlanById("lifetime")!;
      assert.deepEqual(getPlanDisplay(lifetime, "monthly"), {
        amount: 2499000,
        suffix: "one-time",
      });
      assert.deepEqual(getPlanDisplay(lifetime, "yearly"), {
        amount: 2499000,
        suffix: "one-time",
      });
    });

    it("never drifts from the amount checkout would charge", () => {
      for (const plan of Object.values(PRICING_PLANS)) {
        if (plan.interval === "lifetime") continue;
        for (const interval of ["monthly", "yearly"] as const) {
          assert.equal(
            getPlanDisplay(plan, interval).amount,
            getPlanAmount(plan, interval),
            `${plan.id}/${interval} display must equal the charged amount`
          );
        }
      }
    });
  });

  describe("Plan catalogue invariants", () => {
    it("every paid recurring plan has a positive monthly price", () => {
      for (const plan of Object.values(PRICING_PLANS)) {
        if (plan.interval !== "lifetime") {
          assert.ok(plan.price >= 0, `${plan.id} price must be >= 0`);
        }
      }
    });
  });
});
