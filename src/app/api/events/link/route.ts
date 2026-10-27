import { NextRequest, NextResponse } from "next/server";
import { creatorService } from "@/modules/creator/service";
import { classifyDevice, recordEvent, type AnalyticsEventType } from "@/modules/analytics/service";
import { getSessionUser } from "@/server/auth/session";
import { errorResponse } from "@/lib/api-errors";

/**
 * Records a storefront interaction (page view or link click).
 *
 * Public by design — the events come from anonymous visitors. The profile is resolved
 * from the username and the target is checked to belong to that profile, so a caller
 * cannot inflate another creator's link counters by passing an arbitrary target id.
 */
export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
    }

    const payload = (body ?? {}) as {
      username?: unknown;
      type?: unknown;
      targetId?: unknown;
    };

    if (typeof payload.username !== "string") {
      return NextResponse.json({ error: "A username is required." }, { status: 400 });
    }

    const requestedType = payload.type;
    const eventType: AnalyticsEventType =
      requestedType === "link_click"
        ? "link_click"
        : requestedType === "product_view"
          ? "product_view"
          : "profile_view";

    const profile = await creatorService.getProfileByUsername(payload.username);
    if (!profile || !profile.isPublished) {
      // Silently accept: a missing profile is a client bug, not something the visitor
      // needs to see, and analytics must never break the page.
      return NextResponse.json({ recorded: false });
    }

    const session = await getSessionUser(req.headers).catch(() => null);
    const device = classifyDevice(req.headers.get("user-agent"));
    const country = req.headers.get("x-vercel-ip-country");

    if (eventType === "link_click") {
      if (typeof payload.targetId !== "string") {
        return NextResponse.json({ error: "A targetId is required." }, { status: 400 });
      }

      // Verify the target is one of this profile's links before counting it.
      const links = await creatorService.listLinks(profile.id);
      const target = links.find((link) => link.id === payload.targetId);
      if (!target) {
        return NextResponse.json({ recorded: false });
      }

      await creatorService.recordLinkClick(target.id);
      await recordEvent({
        profileId: profile.id,
        eventType: "link_click",
        targetId: target.id,
        referrer: req.headers.get("referer"),
        country,
        device,
      });

      return NextResponse.json({ recorded: true });
    }

    if (eventType === "product_view") {
      if (typeof payload.targetId !== "string") {
        return NextResponse.json({ error: "A targetId is required." }, { status: 400 });
      }

      // Same ownership rule as a link click: a product id from another creator must not
      // be countable against this profile.
      const products = await creatorService.listActiveProducts(profile.id);
      const target = products.find((item) => item.id === payload.targetId);
      if (!target) {
        return NextResponse.json({ recorded: false });
      }

      await recordEvent({
        profileId: profile.id,
        eventType: "product_view",
        targetId: target.id,
        referrer: req.headers.get("referer"),
        country,
        device,
      });

      return NextResponse.json({ recorded: true });
    }

    await recordEvent({
      profileId: profile.id,
      eventType: "profile_view",
      referrer: req.headers.get("referer"),
      country,
      device,
      metadata: session ? { signedIn: true } : null,
    });

    return NextResponse.json({ recorded: true });
  } catch (error) {
    return errorResponse(error, "Failed to record event");
  }
}
