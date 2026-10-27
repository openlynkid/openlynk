import type { BillingInterval, PricingPlan } from "./types";

export const PRICING_PLANS: Record<string, PricingPlan> = {
  free: {
    id: "free",
    name: "Hobby",
    description: "For individuals exploring the platform and personal projects.",
    price: 0,
    currency: "IDR",
    interval: "monthly",
    maxTeamMembers: 1,
    features: [
      { text: "1 workspace member", included: true },
      { text: "Up to 5 active projects", included: true },
      { text: "Community support", included: true },
      { text: "Custom domains", included: false },
      { text: "Priority SLAs", included: false },
    ],
  },
  starter: {
    id: "starter",
    name: "Starter",
    description: "Ideal for growing startups and early-stage companies.",
    price: 149000, // Rp 149,000 / month
    currency: "IDR",
    interval: "monthly",
    maxTeamMembers: 5,
    features: [
      { text: "Up to 5 workspace members", included: true },
      { text: "Unlimited projects", included: true },
      { text: "Standard email support", included: true },
      { text: "Custom domain support", included: true },
      { text: "Priority SLAs", included: false },
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    description: "For scaling organizations requiring advanced permissions and power.",
    price: 499000, // Rp 499,000 / month
    currency: "IDR",
    interval: "monthly",
    isPopular: true,
    maxTeamMembers: 20,
    features: [
      { text: "Up to 20 workspace members", included: true },
      { text: "Unlimited projects & storage", included: true },
      { text: "Priority 24/7 support", included: true },
      { text: "Custom branding & domain", included: true },
      { text: "Audit logs & advanced RBAC", included: true },
    ],
  },
  lifetime: {
    id: "lifetime",
    name: "Founder Lifetime",
    description: "One-time payment for perpetual access with all Pro features.",
    price: 2499000, // Rp 2,499,000 one-time
    currency: "IDR",
    interval: "lifetime",
    maxTeamMembers: 10,
    features: [
      { text: "Perpetual lifetime access", included: true },
      { text: "Up to 10 workspace members", included: true },
      { text: "All future Pro features included", included: true },
      { text: "VIP Discord & direct support", included: true },
    ],
  },
};

export function getPlanById(planId: string): PricingPlan | undefined {
  return PRICING_PLANS[planId];
}

/**
 * Whether a plan may be purchased on a given interval. A lifetime plan is one-time
 * only; a recurring plan supports monthly and yearly. This is the single guard that
 * stops a client from buying a perpetual (lifetime) period at the monthly price.
 */
export function isSupportedInterval(plan: PricingPlan, interval: BillingInterval): boolean {
  if (plan.interval === "lifetime") {
    return interval === "lifetime";
  }
  return interval === "monthly" || interval === "yearly";
}

/**
 * Authoritative price for a plan on an interval, in IDR. Yearly is billed as ten
 * months (two months free). This is the one place the charge amount is computed, so
 * the checkout service and the pricing UI can never drift apart.
 */
export function getPlanAmount(plan: PricingPlan, interval: BillingInterval): number {
  if (!isSupportedInterval(plan, interval)) {
    throw new Error(`Unsupported billing interval '${interval}' for plan '${plan.id}'.`);
  }
  if (plan.interval === "lifetime") {
    return plan.price;
  }
  return interval === "yearly" ? plan.price * 10 : plan.price;
}

/**
 * What a pricing card should render for a plan on a selected interval. The amount
 * always comes from getPlanAmount, so the displayed price cannot drift from the
 * amount the checkout charges.
 */
export function getPlanDisplay(
  plan: PricingPlan,
  interval: BillingInterval
): { amount: number; suffix: string } {
  const effectiveInterval: BillingInterval = plan.interval === "lifetime" ? "lifetime" : interval;
  return {
    amount: getPlanAmount(plan, effectiveInterval),
    suffix:
      effectiveInterval === "lifetime"
        ? "one-time"
        : effectiveInterval === "yearly"
          ? "/ year"
          : "/ month",
  };
}
