import { NextRequest, NextResponse } from "next/server";
import { storeService } from "@/modules/store/service";
import { getSessionUser } from "@/server/auth/session";
import { errorResponse } from "@/lib/api-errors";

/**
 * Claims a free product.
 *
 * Same shape as checkout, and idempotent: claiming twice with the same email returns the
 * existing entitlement rather than minting a second licence key.
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
      productId?: unknown;
      email?: unknown;
    };

    if (typeof payload.username !== "string" || typeof payload.productId !== "string") {
      return NextResponse.json(
        { error: "A username and a productId are required." },
        { status: 400 }
      );
    }

    const session = await getSessionUser(req.headers);

    const delivery = await storeService.claimFreeProduct({
      username: payload.username,
      productId: payload.productId,
      buyerEmail: payload.email,
      buyerUserId: session?.user.id ?? null,
    });

    return NextResponse.json({ delivery }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Failed to claim free product");
  }
}
