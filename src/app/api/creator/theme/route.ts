import { NextRequest, NextResponse } from "next/server";
import { creatorService, CreatorValidationError } from "@/modules/creator/service";
import { getCreatorEntitlements } from "@/modules/creator/entitlements";
import { sanitizeTheme } from "@/modules/creator/service";
import { resolveTheme, THEME_PRESETS } from "@/modules/creator/types";
import { getSessionUser } from "@/server/auth/session";
import { errorResponse, unauthorized } from "@/lib/api-errors";

/** The available presets, so the appearance editor never hardcodes the list. */
export async function GET() {
  return NextResponse.json({ presets: THEME_PRESETS });
}

/**
 * Saves the page theme.
 *
 * Custom colours are a paid feature, so a free creator's colours are stripped by
 * `updateProfile` and the response reports what was actually stored rather than what was
 * requested — the editor then shows the truth instead of a value that silently reverted.
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

    const theme = sanitizeTheme((body as { theme?: Parameters<typeof sanitizeTheme>[0] })?.theme);
    const presetId = theme.preset;
    if (presetId && !THEME_PRESETS.some((preset) => preset.id === presetId)) {
      throw new CreatorValidationError(`Unknown theme preset '${presetId}'.`);
    }

    const profile = await creatorService.updateProfile(session.user.id, { theme });
    const entitlements = await getCreatorEntitlements(session.user.id);

    return NextResponse.json({
      profile,
      resolvedTheme: resolveTheme(profile.theme),
      entitlements,
    });
  } catch (error) {
    return errorResponse(error, "Failed to save theme");
  }
}
