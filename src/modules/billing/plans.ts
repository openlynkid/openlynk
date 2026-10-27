import type { BillingInterval, PricingPlan } from "./types";

export const PRICING_PLANS: Record<string, PricingPlan> = {
  free: {
    id: "free",
    name: "Free",
    description: "For creators starting their first link-in-bio page.",
    price: 0,
    currency: "IDR",
    interval: "monthly",
    maxTeamMembers: 1,
    features: [
      { text: "Up to 5 links", included: true },
      { text: "1 digital product", included: true },
      { text: "OpenLynk subdomain", included: true },
      { text: "Custom domains", included: false },
      { text: "Advanced analytics", included: false },
    ],
  },
  starter: {
    id: "starter",
    name: "Starter",
    description: "For growing creators selling their first digital products.",
    price: 149000, // Rp 149,000 / month
    currency: "IDR",
    interval: "monthly",
    maxTeamMembers: 5,
    features: [
      { text: "Up to 50 links", included: true },
      { text: "Up to 10 digital products", included: true },
      { text: "Basic traffic analytics", included: true },
      { text: "Custom domains", included: false },
      { text: "Remove OpenLynk branding", included: false },
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    description: "For professional creators running a full storefront.",
    price: 499000, // Rp 499,000 / month
    currency: "IDR",
    interval: "monthly",
    isPopular: true,
    maxTeamMembers: 20,
    features: [
      { text: "Unlimited links", included: true },
      { text: "Up to 100 digital products", included: true },
      { text: "Advanced analytics & audience insight", included: true },
      { text: "Custom domain & custom theme", included: true },
      { text: "Remove OpenLynk branding", included: true },
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
      { text: "Unlimited links & products", included: true },
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
