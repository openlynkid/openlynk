import { NextRequest, NextResponse } from "next/server";
import { creatorService } from "@/modules/creator/service";
import { productService } from "@/modules/creator/products";
import { getCreatorEntitlements } from "@/modules/creator/entitlements";
import { getSessionUser } from "@/server/auth/session";
import { errorResponse, unauthorized } from "@/lib/api-errors";
import type { AssetInput } from "@/modules/creator/products";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req.headers);
    if (!session) return unauthorized();

    const profile = await creatorService.ensureProfile(session.user.id);
    const products = await productService.listProducts(profile.id);

    // Assets are attached in one extra query per product rather than N+1 inside the
    // list render, so the dashboard can show "3 files" without a request per row.
    const withAssets = await Promise.all(
      products.map(async (item) => ({
        ...item,
        assets: await productService.listAssets(item.id),
      }))
    );

    const entitlements = await getCreatorEntitlements(session.user.id);
    return NextResponse.json({ products: withAssets, entitlements });
  } catch (error) {
    return errorResponse(error, "Failed to list products");
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

    const { assets, ...input } = (body ?? {}) as Parameters<
      typeof productService.createProduct
    >[1] & { assets?: AssetInput[] };

    const product = await productService.createProduct(
      session.user.id,
      input,
      Array.isArray(assets) ? assets : []
    );
    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Failed to create product");
  }
}

/** Reorders the storefront. The body is `{ order: string[] }` of product ids. */
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
        { error: "Body must be { order: string[] } of product ids." },
        { status: 400 }
      );
    }

    const products = await productService.reorderProducts(session.user.id, order as string[]);
    return NextResponse.json({ products });
  } catch (error) {
    return errorResponse(error, "Failed to reorder products");
  }
}
