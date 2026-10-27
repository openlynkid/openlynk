import { NextRequest, NextResponse } from "next/server";
import { creatorService } from "@/modules/creator/service";
import { getCreatorEntitlements } from "@/modules/creator/entitlements";
import { getSessionUser } from "@/server/auth/session";
import { errorResponse, unauthorized } from "@/lib/api-errors";

/**
 * Connects or clears the creator's custom hostname.
 *
 * The plan check lives in `updateProfile`, so a direct call to this route cannot bypass
 * it. This handler only shapes the request and reports the resulting state.
 */
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

    const rawDomain = (body as { domain?: unknown })?.domain ?? null;
    const profile = await creatorService.updateProfile(session.user.id, {
      customDomain: typeof rawDomain === "string" ? rawDomain : null,
    });
    const entitlements = await getCreatorEntitlements(session.user.id);

    return NextResponse.json({ profile, entitlements });
  } catch (error) {
    return errorResponse(error, "Failed to update custom domain");
  }
}
