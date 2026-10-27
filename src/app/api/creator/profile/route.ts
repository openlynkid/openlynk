import { NextRequest, NextResponse } from "next/server";
import { creatorService } from "@/modules/creator/service";
import { getCreatorEntitlements } from "@/modules/creator/entitlements";
import { getSessionUser } from "@/server/auth/session";
import { errorResponse, unauthorized } from "@/lib/api-errors";

/** The creator's own profile plus the limits and counts the dashboard header needs. */
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req.headers);
    if (!session) return unauthorized();

    const [entitlements, counts] = await Promise.all([
      getCreatorEntitlements(session.user.id),
      creatorService.getDashboardCounts(session.user.id),
    ]);

    return NextResponse.json({
      profile: counts.profile,
      entitlements,
      linkCount: counts.linkCount,
      productCount: counts.productCount,
      publicUrl: `/u/${counts.profile.username}`,
    });
  } catch (error) {
    return errorResponse(error, "Failed to load creator profile");
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSessionUser(req.headers);
    if (!session) return unauthorized();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const profile = await creatorService.updateProfile(
      session.user.id,
      body as Parameters<typeof creatorService.updateProfile>[1]
    );

    return NextResponse.json({ profile });
  } catch (error) {
    return errorResponse(error, "Failed to update creator profile");
  }
}
