import { NextRequest, NextResponse } from "next/server";
import { creatorService } from "@/modules/creator/service";
import { getSessionUser } from "@/server/auth/session";
import { errorResponse, unauthorized } from "@/lib/api-errors";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req.headers);
    if (!session) return unauthorized();

    const profile = await creatorService.ensureProfile(session.user.id);
    const links = await creatorService.listLinks(profile.id);
    return NextResponse.json({ links });
  } catch (error) {
    return errorResponse(error, "Failed to list links");
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req.headers);
    if (!session) return unauthorized();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
    }

    const link = await creatorService.createLink(
      session.user.id,
      body as Parameters<typeof creatorService.createLink>[1]
    );
    return NextResponse.json({ link }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Failed to create link");
  }
}

/** Reorders the whole page. The body is `{ order: string[] }` of link ids. */
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

    const order = (body as { order?: unknown })?.order;
    if (!Array.isArray(order) || order.some((id) => typeof id !== "string")) {
      return NextResponse.json(
        { error: "Body must be { order: string[] } of link ids." },
        { status: 400 }
      );
    }

    const links = await creatorService.reorderLinks(session.user.id, order as string[]);
    return NextResponse.json({ links });
  } catch (error) {
    return errorResponse(error, "Failed to reorder links");
  }
}
