import { NextRequest, NextResponse } from "next/server";
import { storeService } from "@/modules/store/service";
import { errorResponse } from "@/lib/api-errors";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Polls a storefront order's payment status.
 *
 * Public by design: the buyer is not necessarily signed in, and the only thing this
 * exposes is whether a specific order id has settled. The order id is unguessable
 * (`OL-<epoch>-<8 hex>`), which is what keeps that acceptable — the response contains no
 * buyer details.
 */
export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const order = await storeService.getOrderStatus(id);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Once settled, include the entitlement so the buyer's checkout page can show the
    // product without a second round trip. Before that there is nothing to deliver.
    const delivery =
      order.status === "settlement" || order.status === "capture"
        ? await storeService.getDeliveryByOrderId(order.id)
        : null;

    return NextResponse.json({
      orderId: order.id,
      status: order.status,
      amount: order.amount,
      paidAt: order.paidAt ? order.paidAt.toISOString() : null,
      delivery,
    });
  } catch (error) {
    return errorResponse(error, "Failed to load order status");
  }
}
