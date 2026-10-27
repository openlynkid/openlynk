import { NextRequest, NextResponse } from "next/server";
import { billingService } from "@/modules/billing/service";
import type { MidtransNotificationPayload } from "@/modules/billing/types";
import { WebhookValidationError } from "@/modules/billing/types";

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

    const result = await billingService.processWebhookNotification(payload);

    return NextResponse.json({
      received: true,
      order_id: result.orderId,
      status: result.status,
      duplicate: result.duplicate ?? false,
    });
  } catch (error) {
    if (error instanceof WebhookValidationError) {
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
