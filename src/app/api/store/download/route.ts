import { NextRequest, NextResponse } from "next/server";
import { storeService } from "@/modules/store/service";
import { errorResponse } from "@/lib/api-errors";

/**
 * Resolves a purchase from its download token and increments the download counter.
 *
 * The token is the credential, so the response is the delivery payload itself — a buyer
 * who has the link can always re-download, which is what "lifetime access" has to mean
 * for a digital product. A refunded purchase resolves to `null` and answers 404.
 */
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");
    const delivery = await storeService.registerDownload(token);

    if (!delivery) {
      return NextResponse.json(
        { error: "This download link is not valid." },
        { status: 404 }
      );
    }

    return NextResponse.json({ delivery });
  } catch (error) {
    return errorResponse(error, "Failed to resolve download");
  }
}
