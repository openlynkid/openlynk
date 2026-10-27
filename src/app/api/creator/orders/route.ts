import { NextRequest, NextResponse } from "next/server";
import { creatorService } from "@/modules/creator/service";
import { listRecentPurchases } from "@/modules/analytics/service";
import { storeService } from "@/modules/store/service";
import { getSessionUser } from "@/server/auth/session";
import { errorResponse, unauthorized } from "@/lib/api-errors";

/**
 * The creator's orders and payout summary.
 *
 * The profile comes from the session, so an order list is always the caller's own.
 * Revenue is reported net of the platform fee, using the same `calculatePayout` the
 * product page previews.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req.headers);
    if (!session) return unauthorized();

    const profile = await creatorService.ensureProfile(session.user.id);

    const daysParam = Number.parseInt(req.nextUrl.searchParams.get("days") ?? "", 10);
    const days = Number.isFinite(daysParam) ? Math.min(Math.max(daysParam, 1), 365) : 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [purchases, sales] = await Promise.all([
      listRecentPurchases(profile.id, 100),
      storeService.getCreatorSales(profile.id, since),
    ]);

    return NextResponse.json({ purchases, sales, rangeDays: days });
  } catch (error) {
    return errorResponse(error, "Failed to load orders");
  }
}
