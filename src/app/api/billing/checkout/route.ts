import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { billingService } from "@/modules/billing/service";
import { getPlanById, isSupportedInterval } from "@/modules/billing/plans";
import { verifyUserOrgMembership } from "@/server/auth/org-auth";
import { CheckoutValidationError } from "@/modules/billing/types";
import { z } from "zod";

const checkoutSchema = z.object({
  planId: z.string().trim().min(1, "Plan ID is required"),
  interval: z.enum(["monthly", "yearly", "lifetime"]).default("monthly"),
  organizationId: z.string().trim().nullable().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
    }

    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid checkout request", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { planId, interval, organizationId } = parsed.data;

    // Validate plan
    const plan = getPlanById(planId);
    if (!plan) {
      return NextResponse.json({ error: `Invalid plan ID: ${planId}` }, { status: 400 });
    }

    if (plan.price <= 0) {
      return NextResponse.json(
        { error: "Free plans do not require payment checkout." },
        { status: 400 }
      );
    }

    // A plan may only be bought on the intervals it actually supports. This blocks a
    // lifetime period being purchased at the monthly price, and vice versa.
    if (!isSupportedInterval(plan, interval)) {
      return NextResponse.json(
        { error: `Plan '${plan.id}' does not support the '${interval}' billing interval.` },
        { status: 400 }
      );
    }

    let resolvedOrgId: string | null = null;

    // Enforce organization authorization if organizationId is supplied
    if (organizationId) {
      const orgAuth = await verifyUserOrgMembership(session.user.id, organizationId, {
        requireBillingAccess: true,
      });

      if (!orgAuth.success) {
        return NextResponse.json({ error: orgAuth.error }, { status: orgAuth.status });
      }

      resolvedOrgId = orgAuth.organization.id;
    }

    // Guard against unsupported cross-plan changes while a subscription is actively entitled
    const activeSub = await billingService.getActiveSubscription({
      userId: session.user.id,
      organizationId: resolvedOrgId,
    });

    if (activeSub && activeSub.planId !== plan.id) {
      return NextResponse.json(
        {
          error: `Cross-plan subscription change (from '${activeSub.planId}' to '${plan.id}') is not supported yet. Please wait until your current subscription expires or contact support.`,
        },
        { status: 400 }
      );
    }

    const checkout = await billingService.createCheckoutSession({
      userId: session.user.id,
      userEmail: session.user.email,
      userName: session.user.name,
      planId: plan.id,
      interval,
      organizationId: resolvedOrgId,
    });

    return NextResponse.json(checkout);
  } catch (error) {
    if (error instanceof CheckoutValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error(
      "❌ Checkout session creation failed:",
      error instanceof Error ? error.message : "Internal Error"
    );
    return NextResponse.json(
      { error: "Failed to create checkout" },
      { status: 500 }
    );
  }
}
