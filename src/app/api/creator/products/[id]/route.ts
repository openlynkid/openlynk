import { NextRequest, NextResponse } from "next/server";
import { productService } from "@/modules/creator/products";
import { getSessionUser } from "@/server/auth/session";
import { errorResponse, unauthorized } from "@/lib/api-errors";
import type { AssetInput } from "@/modules/creator/products";

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

    const { assets, ...input } = (body ?? {}) as Parameters<
      typeof productService.updateProduct
    >[2] & { assets?: AssetInput[] };

    const product = await productService.updateProduct(
      session.user.id,
      id,
      input,
      Array.isArray(assets) ? assets : undefined
    );
    return NextResponse.json({ product });
  } catch (error) {
    return errorResponse(error, "Failed to update product");
  }
}

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  try {
    const session = await getSessionUser(req.headers);
    if (!session) return unauthorized();

    const { id } = await ctx.params;
    await productService.deleteProduct(session.user.id, id);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return errorResponse(error, "Failed to delete product");
  }
}
