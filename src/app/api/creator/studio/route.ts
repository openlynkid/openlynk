import { NextRequest, NextResponse } from "next/server";
import { creatorService, type StudioLayoutItem } from "@/modules/creator/service";
import { getCreatorEntitlements } from "@/modules/creator/entitlements";
import { getSessionUser } from "@/server/auth/session";
import { errorResponse, unauthorized } from "@/lib/api-errors";
import { TILE_SIZE_PRESETS } from "@/modules/creator/types";

/**
 * The bento grid vocabulary: the tile shapes the studio offers and the grid width.
 *
 * Served from the domain rather than hardcoded in the client, so the editor cannot offer
 * a footprint the renderer has no class for, and the two cannot drift.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req.headers);
    if (!session) return unauthorized();

    const [profile, entitlements] = await Promise.all([
      creatorService.ensureProfile(session.user.id),
      getCreatorEntitlements(session.user.id),
    ]);
    const links = await creatorService.listLinks(profile.id);

    return NextResponse.json({
      sizePresets: TILE_SIZE_PRESETS,
      entitlements,
      tiles: links,
    });
  } catch (error) {
    return errorResponse(error, "Failed to load the studio");
  }
}

/** The largest arrangement we will accept in one write; well above any plan's link limit. */
const MAX_ITEMS = 500;

/**
 * Saves the whole arrangement in one call.
 *
 * The payload is `{ items: [{ id, layout: { w, h }, isActive? }] }`. Ids are checked
 * against the caller's own tiles inside `saveStudioLayout`, so an id belonging to another
 * creator matches no row rather than being rejected here — the same ownership-in-the-
 * WHERE-clause pattern the rest of the creator API uses.
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await getSessionUser(req.headers);
    if (!session) return unauthorized();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
    }

    const items = (body as { items?: unknown })?.items;
    if (!Array.isArray(items) || items.length > MAX_ITEMS) {
      return NextResponse.json(
        { error: "Body must be { items: [{ id, layout }] }." },
        { status: 400 }
      );
    }

    for (const item of items) {
      const candidate = item as { id?: unknown; layout?: unknown };
      if (typeof candidate?.id !== "string" || typeof candidate?.layout !== "object") {
        return NextResponse.json(
          { error: "Every item needs a string id and a layout object." },
          { status: 400 }
        );
      }
    }

    const tiles = await creatorService.saveStudioLayout(
      session.user.id,
      items as StudioLayoutItem[]
    );
    return NextResponse.json({ tiles });
  } catch (error) {
    return errorResponse(error, "Failed to save the studio layout");
  }
}
