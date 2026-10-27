import { NextRequest, NextResponse } from "next/server";
import { billingService } from "@/modules/billing/service";
import { storeService } from "@/modules/store/service";
import type { MidtransNotificationPayload } from "@/modules/billing/types";
import { WebhookValidationError } from "@/modules/billing/types";
import { StoreWebhookError } from "@/modules/store/types";

/**
 * Storefront orders are prefixed `OL-` (`generateStoreOrderId`); platform subscription
 * orders are prefixed `ORD-` (`BillingService.createCheckoutSession`). The prefix is the
 * only thing that distinguishes the two flows on a single Midtrans notification URL, so
 * it is treated as the routing key and matched case-insensitively.
 */
const STORE_ORDER_PREFIX = "ol-";

export function isStoreOrder(orderId: unknown): boolean {
  return typeof orderId === "string" && orderId.trim().toLowerCase().startsWith(STORE_ORDER_PREFIX);
}

export async function POST(req: NextRequest) {
  try {
    let payload: MidtransNotificationPayload;
    try {
      payload = (await req.json()) as MidtransNotificationPayload;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body" },
        { status: 400 }
      );
    }

    if (
      !payload ||
      typeof payload !== "object" ||
      !payload.order_id ||
      !payload.signature_key ||
      !payload.status_code ||
      !payload.gross_amount ||
      !payload.transaction_status
    ) {
      return NextResponse.json(
        { error: "Invalid Midtrans notification payload: missing required fields" },
        { status: 400 }
      );
    }

    // Route to the storefront fulfillment path when this is a digital-product order.
    if (isStoreOrder(payload.order_id)) {
      const storeResult = await storeService.processWebhook(payload);

      return NextResponse.json({
        received: true,
        order_id: storeResult.orderId,
        status: storeResult.status,
        duplicate: storeResult.duplicate ?? false,
      });
    }

    const result = await billingService.processWebhookNotification(payload);

    return NextResponse.json({
      received: true,
      order_id: result.orderId,
      status: result.status,
      duplicate: result.duplicate ?? false,
    });
  } catch (error) {
    if (error instanceof WebhookValidationError || error instanceof StoreWebhookError) {
      return NextResponse.json(
        {
          received: false,
          error: error.message,
        },
        { status: 400 }
      );
    }

    console.error(
      "❌ Midtrans Webhook internal processing error:",
      error instanceof Error ? error.message : "Internal Server Error"
    );
    return NextResponse.json(
      {
        received: false,
        error: "Internal processing error",
      },
      { status: 500 }
    );
  }
}
