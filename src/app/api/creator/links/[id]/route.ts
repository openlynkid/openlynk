import { NextRequest, NextResponse } from "next/server";
import { creatorService } from "@/modules/creator/service";
import { getSessionUser } from "@/server/auth/session";
import { errorResponse, unauthorized } from "@/lib/api-errors";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const session = await getSessionUser(req.headers);
    if (!session) return unauthorized();

    const { id } = await ctx.params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
    }

    const link = await creatorService.updateLink(
      session.user.id,
      id,
      (body ?? {}) as Parameters<typeof creatorService.updateLink>[2]
    );
    return NextResponse.json({ link });
  } catch (error) {
    return errorResponse(error, "Failed to update link");
  }
}

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  try {
    const session = await getSessionUser(req.headers);
    if (!session) return unauthorized();

    const { id } = await ctx.params;
    await creatorService.deleteLink(session.user.id, id);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return errorResponse(error, "Failed to delete link");
  }
}
