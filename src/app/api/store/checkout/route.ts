import { NextRequest, NextResponse } from "next/server";
import { storeService } from "@/modules/store/service";
import { getSessionUser } from "@/server/auth/session";
import { errorResponse } from "@/lib/api-errors";

/**
 * Starts a storefront checkout.
 *
 * Public by design — a buyer should not have to create an account to buy. The amount is
 * resolved from the product row inside the service, never from the body, so the request
 * carries only *which* product and *who* is buying.
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
      name?: unknown;
    };

    if (typeof payload.username !== "string" || typeof payload.productId !== "string") {
      return NextResponse.json(
        { error: "A username and a productId are required." },
        { status: 400 }
      );
    }

    // Attach the buyer's account when they are signed in, so the purchase lands in their
    // library even if they type a different email at checkout.
    const session = await getSessionUser(req.headers);

    const checkout = await storeService.createCheckout({
      username: payload.username,
      productId: payload.productId,
      buyerEmail: payload.email,
      buyerName: typeof payload.name === "string" ? payload.name : null,
      buyerUserId: session?.user.id ?? null,
    });

    return NextResponse.json(checkout, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Failed to create store checkout");
  }
}
