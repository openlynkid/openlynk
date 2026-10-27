import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { billingService } from "@/modules/billing/service";
import { getPlanById } from "@/modules/billing/plans";
import { verifyUserOrgMembership } from "@/server/auth/org-auth";

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const rawOrgId = searchParams.get("organizationId");
    const orgId = rawOrgId ? rawOrgId.trim() : null;

    let sub = null;

    if (orgId) {
      // Enforce organization membership authorization
      const orgAuth = await verifyUserOrgMembership(session.user.id, orgId, {
        requireBillingAccess: false,
      });

      if (!orgAuth.success) {
        return NextResponse.json({ error: orgAuth.error }, { status: orgAuth.status });
      }

      // Query only after authorization succeeds, scoped strictly to the organization
      sub = await billingService.getActiveSubscription({
        organizationId: orgAuth.organization.id,
      });
    } else {
      // Scoped strictly to the personal user account
      sub = await billingService.getActiveSubscription({
        userId: session.user.id,
      });
    }

    const plan = sub ? getPlanById(sub.planId) : getPlanById("free");

    return NextResponse.json({
      subscription: sub,
      plan: plan || null,
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "digest" in error &&
      (error as { digest?: string }).digest === "NEXT_PRERENDER_INTERRUPTED"
    ) {
      throw error;
    }
    console.error("❌ Failed to fetch subscription:", error);
    return NextResponse.json(
      { error: "Failed to retrieve subscription" },
      { status: 500 }
    );
  }
}
