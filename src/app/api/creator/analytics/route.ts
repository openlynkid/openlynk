import { NextRequest, NextResponse } from "next/server";
import { creatorService } from "@/modules/creator/service";
import { getCreatorEntitlements } from "@/modules/creator/entitlements";
import { getAnalyticsSummary, normalizeRangeDays } from "@/modules/analytics/service";
import { getSessionUser } from "@/server/auth/session";
import { errorResponse, unauthorized } from "@/lib/api-errors";

/**
 * Creator-facing analytics for the signed-in user's own profile.
 *
 * The profile is resolved from the session, never from a query parameter, so a creator
 * cannot read another creator's traffic by guessing an id. The plan's analytics tier
 * gates the response: a free creator gets the plan notice instead of the numbers.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req.headers);
    if (!session) return unauthorized();

    const profile = await creatorService.ensureProfile(session.user.id);
    const entitlements = await getCreatorEntitlements(session.user.id);

    if (entitlements.analytics === "none") {
      return NextResponse.json({
        gated: true,
        entitlements,
        summary: null,
        message: "Analytics are available on the Starter plan and above.",
      });
    }

    const rangeDays = normalizeRangeDays(req.nextUrl.searchParams.get("days"), 30);
    const summary = await getAnalyticsSummary(profile.id, rangeDays);

    return NextResponse.json({ gated: false, entitlements, summary });
  } catch (error) {
    return errorResponse(error, "Failed to load analytics");
  }
}
