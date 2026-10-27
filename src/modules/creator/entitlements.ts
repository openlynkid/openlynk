import { getPlanById } from "@/modules/billing/plans";
import { billingService } from "@/modules/billing/service";

/**
 * What a plan allows on the creator side.
 *
 * The plan catalogue in `src/modules/billing/plans.ts` is the single source of truth for
 * *price*; this module is the single source of truth for what a paying creator gets.
 * Keeping the two apart means a price change never silently changes an entitlement, and
 * a limit change never touches the checkout path.
 *
 * `null` means unlimited rather than a large number, so a limit check reads
 * `limit === null || count < limit` and cannot be defeated by a big-but-finite value.
 */
export interface CreatorEntitlements {
  planId: string;
  /** Maximum active links and blocks on the bio page. */
  maxLinks: number | null;
  /** Maximum products on the storefront. */
  maxProducts: number | null;
  /** Storefront analytics. */
  analytics: "none" | "basic" | "advanced";
  /** Serve the page on the creator's own hostname. */
  customDomain: boolean;
  /** Hide the "Made with OpenLynk" footer. */
  removeBranding: boolean;
  /** Use a theme beyond the built-in presets (custom colours). */
  customTheme: boolean;
}

/**
 * Limits per plan id. A plan id that is not listed here gets the free limits: an
 * unknown or lapsed plan must never grant more than the free tier, so the lookup fails
 * closed rather than open.
 */
const PLAN_ENTITLEMENTS: Record<string, Omit<CreatorEntitlements, "planId">> = {
  free: {
    maxLinks: 5,
    maxProducts: 1,
    analytics: "none",
    customDomain: false,
    removeBranding: false,
    customTheme: false,
  },
  starter: {
    maxLinks: 50,
    maxProducts: 10,
    analytics: "basic",
    customDomain: false,
    removeBranding: false,
    customTheme: false,
  },
  pro: {
    maxLinks: null,
    maxProducts: 100,
    analytics: "advanced",
    customDomain: true,
    removeBranding: true,
    customTheme: true,
  },
  lifetime: {
    maxLinks: null,
    maxProducts: null,
    analytics: "advanced",
    customDomain: true,
    removeBranding: true,
    customTheme: true,
  },
};

export const FREE_ENTITLEMENTS: CreatorEntitlements = {
  planId: "free",
  ...PLAN_ENTITLEMENTS.free,
};

/** Entitlements for a plan id. Unknown ids fall back to the free tier. */
export function getEntitlementsForPlan(planId: string | null | undefined): CreatorEntitlements {
  if (!planId) return FREE_ENTITLEMENTS;
  const limits = PLAN_ENTITLEMENTS[planId];
  if (!limits) return FREE_ENTITLEMENTS;
  return { planId, ...limits };
}

/**
 * Resolves the entitlements of a *user* — their live subscription if they have one, the
 * free tier otherwise.
 *
 * Uses `checkEntitlement` rather than reading the subscription row directly so an
 * expired period is treated as free here exactly as it is on the billing page; the two
 * must not disagree about whether someone is paying.
 */
export async function getCreatorEntitlements(
  userId: string,
  now = new Date()
): Promise<CreatorEntitlements> {
  const { hasAccess, planId } = await billingService.checkEntitlement({ userId }, now);
  return getEntitlementsForPlan(hasAccess ? planId : "free");
}

export type LimitCheck = { allowed: true } | { allowed: false; error: string };

/**
 * Whether one more item of a kind may be created.
 *
 * The limit is passed in rather than read from the DB, so the caller can count the rows
 * inside the same transaction that inserts the new one.
 */
export function checkLimit(
  kind: "links" | "products",
  currentCount: number,
  entitlements: CreatorEntitlements
): LimitCheck {
  const limit = kind === "links" ? entitlements.maxLinks : entitlements.maxProducts;
  const label = kind === "links" ? "links" : "products";

  if (limit !== null && currentCount >= limit) {
    return {
      allowed: false,
      error:
        entitlements.planId === "free"
          ? `The free plan allows ${limit} ${label}. Upgrade to add more.`
          : `Your ${entitlements.planId} plan allows ${limit} ${label}. Upgrade to add more.`,
    };
  }

  return { allowed: true };
}

/** Human-readable plan name for the upgrade prompt, reusing the billing catalogue. */
export function getPlanName(planId: string): string {
  return getPlanById(planId)?.name ?? "Free";
}
