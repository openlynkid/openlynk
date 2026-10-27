import { NextRequest, NextResponse } from "next/server";
import { storeService } from "@/modules/store/service";
import { getSessionUser } from "@/server/auth/session";
import { errorResponse } from "@/lib/api-errors";

/**
 * The signed-in buyer's library.
 *
 * Resolved from the session only — never from a query parameter — so a buyer can only
 * ever list their own entitlements. Matching is by account *and* email, so a purchase
 * made as a guest with the same address still appears.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req.headers);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const purchases = await storeService.listPurchasesForBuyer({
      userId: session.user.id,
      email: session.user.email,
    });

    return NextResponse.json({ purchases });
  } catch (error) {
    return errorResponse(error, "Failed to load library");
  }
}
