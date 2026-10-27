import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { billingService } from "@/modules/billing/service";

/**
 * Constant-time comparison so a wrong secret cannot be recovered by timing.
 * A length mismatch returns false without leaking which part differed.
 */
function secretsMatch(provided: string, expected: string): boolean {
  const providedBuf = Buffer.from(provided, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");

  if (providedBuf.length !== expectedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuf, expectedBuf);
}

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  // Fail closed: an unauthenticated expiry sweep lets anyone mutate subscription
  // state, so a missing secret is a misconfiguration, not an open door.
  if (!cronSecret) {
    console.error("❌ CRON_SECRET is not configured; refusing to run the expiry sync.");
    return NextResponse.json(
      { error: "Cron endpoint is not configured" },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get("authorization");
  const providedSecret = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!providedSecret || !secretsMatch(providedSecret, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await billingService.syncExpiredSubscriptions();

    return NextResponse.json({
      success: true,
      updatedCount: result.updatedCount,
      expiredSubscriptionIds: result.expiredSubscriptionIds,
    });
  } catch (error) {
    console.error(
      "❌ Subscription expiry sync failed:",
      error instanceof Error ? error.message : "Internal Error"
    );
    return NextResponse.json(
      { error: "Failed to sync expired subscriptions" },
      { status: 500 }
    );
  }
}

// Allow GET for Vercel Cron triggers if configured
export async function GET(req: NextRequest) {
  return POST(req);
}
