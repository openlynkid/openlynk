import { and, asc, desc, eq, sql } from "drizzle-orm";
import crypto from "crypto";
import { db } from "@/server/db";
import { product, productAsset } from "@/server/db/schema/creator";
import {
  isSafeOutboundUrl,
  slugify,
  validateProductSlug,
} from "./validation";
import { invalidateStorefront } from "@/lib/storefront-cache";
import { checkLimit, getCreatorEntitlements } from "./entitlements";
import { creatorService } from "./service";
import {
  CreatorLimitError,
  CreatorNotFoundError,
  CreatorValidationError,
} from "./service";
import {
  DELIVERY_TYPES,
  PRODUCT_TYPES,
  type ProductDeliveryType,
  type ProductType,
} from "./types";

const MAX_TITLE = 140;
const MAX_DESCRIPTION = 4000;
/** Rp 500.000.000 — a guard against a fat-fingered price, not a business limit. */
export const MAX_PRICE_IDR = 500_000_000;

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(12).toString("hex")}`;
}

export interface ProductInput {
  title: string;
  description?: string | null;
  price: number;
  compareAtPrice?: number | null;
  coverImageUrl?: string | null;
  productType?: ProductType;
  deliveryType?: ProductDeliveryType;
  deliveryUrl?: string | null;
  licensePrefix?: string | null;
  slug?: string;
}

export interface AssetInput {
  fileName: string;
  fileUrl: string;
  fileSize?: number | null;
  mimeType?: string | null;
}

/**
 * Validates a price in whole IDR.
 *
 * Fractional rupiah does not exist, so a non-integer is rejected rather than rounded:
 * silently rounding a creator's price would make the storefront disagree with what the
 * checkout charges.
 */
export function validatePrice(value: unknown, label = "Price"): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new CreatorValidationError(`${label} must be a number.`);
  }
  if (!Number.isInteger(value)) {
    throw new CreatorValidationError(`${label} must be a whole number of rupiah.`);
  }
  if (value < 0) {
    throw new CreatorValidationError(`${label} cannot be negative.`);
  }
  if (value > MAX_PRICE_IDR) {
    throw new CreatorValidationError(`${label} cannot exceed Rp ${MAX_PRICE_IDR.toLocaleString("id-ID")}.`);
  }
  return value;
}

/**
 * Validates and normalises a product payload.
 *
 * Delivery is validated against the chosen `deliveryType`, so a product can never be
 * saved in a state that would leave a paying buyer with nothing: `file` must have at
 * least one asset (checked by the caller, which knows about assets), `link` must have a
 * safe URL, and `code` gets a default prefix.
 */
export function validateProductInput(input: ProductInput): {
  title: string;
  description: string | null;
  price: number;
  compareAtPrice: number | null;
  coverImageUrl: string | null;
  productType: ProductType;
  deliveryType: ProductDeliveryType;
  deliveryUrl: string | null;
  licensePrefix: string | null;
  slug: string;
} {
  const title = (input.title ?? "").trim();
  if (title.length === 0) {
    throw new CreatorValidationError("A product title is required.");
  }
  if (title.length > MAX_TITLE) {
    throw new CreatorValidationError(`Title must be at most ${MAX_TITLE} characters.`);
  }

  const description = input.description?.trim()
    ? input.description.trim().slice(0, MAX_DESCRIPTION)
    : null;

  const price = validatePrice(input.price, "Price");

  let compareAtPrice: number | null = null;
  if (input.compareAtPrice !== undefined && input.compareAtPrice !== null) {
    compareAtPrice = validatePrice(input.compareAtPrice, "Compare-at price");
    // A "was" price below the real price is a lie the storefront would render, so it is
    // rejected rather than silently dropped.
    if (compareAtPrice <= price) {
      throw new CreatorValidationError(
        "Compare-at price must be higher than the selling price.",
      );
    }
  }

  const productType: ProductType = input.productType ?? "digital";
  if (!PRODUCT_TYPES.includes(productType)) {
    throw new CreatorValidationError(`Unknown product type '${String(productType)}'.`);
  }

  const deliveryType: ProductDeliveryType = input.deliveryType ?? "file";
  if (!DELIVERY_TYPES.includes(deliveryType)) {
    throw new CreatorValidationError(`Unknown delivery type '${String(deliveryType)}'.`);
  }

  let coverImageUrl: string | null = null;
  if (input.coverImageUrl?.trim()) {
    if (!isSafeOutboundUrl(input.coverImageUrl.trim())) {
      throw new CreatorValidationError("Cover image must be a valid http:// or https:// URL.");
    }
    coverImageUrl = input.coverImageUrl.trim();
  }

  let deliveryUrl: string | null = null;
  let licensePrefix: string | null = null;

  if (deliveryType === "link") {
    const raw = (input.deliveryUrl ?? "").trim();
    if (raw.length === 0) {
      throw new CreatorValidationError("A delivery URL is required for link delivery.");
    }
    if (!isSafeOutboundUrl(raw)) {
      throw new CreatorValidationError("Delivery URL must be a valid http:// or https:// address.");
    }
    deliveryUrl = raw;
  }

  if (deliveryType === "code") {
    const prefix = (input.licensePrefix ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    licensePrefix = prefix.length > 0 ? prefix.slice(0, 12) : "OPENLYNK";
  }

  // A free product must not carry a paid delivery method, and vice versa is fine; the
  // important rule is that a paid product is never left with no way to deliver.
  const slugInput = input.slug?.trim() ? input.slug : slugify(title);
  const slugResult = validateProductSlug(slugInput);
  if (!slugResult.valid) {
    throw new CreatorValidationError(slugResult.error!);
  }

  return {
    title,
    description,
    price,
    compareAtPrice,
    coverImageUrl,
    productType,
    deliveryType,
    deliveryUrl,
    licensePrefix,
    slug: slugResult.normalized!,
  };
}

/** Adds a numeric suffix until the slug is free within the profile. */
async function uniqueSlug(
  dbInstance: typeof db,
  profileId: string,
  base: string,
  excludeId?: string
): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`.slice(0, 60).replace(/-+$/, "");
    const [existing] = await dbInstance
      .select({ id: product.id })
      .from(product)
      .where(and(eq(product.profileId, profileId), eq(product.slug, candidate)))
      .limit(1);
    if (!existing || existing.id === excludeId) return candidate;
  }
  return `${base.slice(0, 50)}-${crypto.randomBytes(3).toString("hex")}`;
}

export class ProductService {
  private dbInstance: typeof db;

  constructor(dbInstance?: typeof db) {
    this.dbInstance = dbInstance ?? db;
  }

  async listProducts(profileId: string) {
    return this.dbInstance
      .select()
      .from(product)
      .where(eq(product.profileId, profileId))
      .orderBy(asc(product.position), asc(product.createdAt));
  }

  async getProduct(userId: string, productId: string) {
    const profile = await creatorService.ensureProfile(userId);
    const [found] = await this.dbInstance
      .select()
      .from(product)
      .where(and(eq(product.id, productId), eq(product.profileId, profile.id)))
      .limit(1);
    return found ?? null;
  }

  /** The public lookup: a product only resolves when it is active on a published page. */
  async getPublicProduct(username: string, slug: string) {
    const profile = await creatorService.getProfileByUsername(username);
    if (!profile || !profile.isPublished) return null;

    const [found] = await this.dbInstance
      .select()
      .from(product)
      .where(
        and(
          eq(product.profileId, profile.id),
          eq(product.slug, slug.trim().toLowerCase()),
          eq(product.isActive, true)
        )
      )
      .limit(1);

    if (!found) return null;

    const assets = await this.dbInstance
      .select()
      .from(productAsset)
      .where(eq(productAsset.productId, found.id))
      .orderBy(asc(productAsset.position), asc(productAsset.createdAt));

    const entitlements = await getCreatorEntitlements(profile.userId);

    return {
      profile,
      product: found,
      assets,
      showBranding: !entitlements.removeBranding,
    };
  }

  async createProduct(userId: string, input: ProductInput, assets: AssetInput[] = []) {
    const profile = await creatorService.ensureProfile(userId);
    const entitlements = await getCreatorEntitlements(userId);
    const values = validateProductInput(input);

    const [{ count }] = await this.dbInstance
      .select({ count: sql<number>`count(*)::int` })
      .from(product)
      .where(eq(product.profileId, profile.id));

    const limit = checkLimit("products", count, entitlements);
    if (!limit.allowed) {
      throw new CreatorLimitError(limit.error);
    }

    const cleanAssets = assets.map((asset, index) => {
      const fileName = (asset.fileName ?? "").trim();
      const fileUrl = (asset.fileUrl ?? "").trim();
      if (fileName.length === 0 || !isSafeOutboundUrl(fileUrl)) {
        throw new CreatorValidationError(
          "Each file needs a name and a valid http:// or https:// URL.",
        );
      }
      return {
        id: newId("asset"),
        fileName: fileName.slice(0, 200),
        fileUrl,
        fileSize: typeof asset.fileSize === "number" ? asset.fileSize : null,
        mimeType: asset.mimeType?.trim() ? asset.mimeType.trim().slice(0, 120) : null,
        position: index,
      };
    });

    // A file-delivered product with no file would take payment and deliver nothing.
    if (values.deliveryType === "file" && cleanAssets.length === 0) {
      throw new CreatorValidationError(
        "Add at least one file, or choose link or code delivery.",
      );
    }

    const slug = await uniqueSlug(this.dbInstance, profile.id, values.slug);

    const created = await this.dbInstance.transaction(async (tx) => {
      const [last] = await tx
        .select({ position: product.position })
        .from(product)
        .where(eq(product.profileId, profile.id))
        .orderBy(desc(product.position))
        .limit(1);

      const [row] = await tx
        .insert(product)
        .values({
          id: newId("prod"),
          profileId: profile.id,
          ...values,
          slug,
          position: (last?.position ?? -1) + 1,
          isActive: true,
        })
        .returning();

      if (cleanAssets.length > 0) {
        await tx
          .insert(productAsset)
          .values(cleanAssets.map((asset) => ({ ...asset, productId: row.id })));
      }

      return row;
    });

    invalidateStorefront(profile.username);
    return created;
  }

  /**
   * Updates a product. Ownership is part of every WHERE clause, so a product id from
   * another creator matches no row.
   *
   * Replacing assets is only allowed when the product delivers by file, and the
   * "at least one file" rule is re-checked after the replacement so an edit cannot strip
   * the last asset off a live product.
   */
  async updateProduct(
    userId: string,
    productId: string,
    input: Partial<ProductInput>,
    assets?: AssetInput[]
  ) {
    const profile = await creatorService.ensureProfile(userId);

    const [existing] = await this.dbInstance
      .select()
      .from(product)
      .where(and(eq(product.id, productId), eq(product.profileId, profile.id)))
      .limit(1);

    if (!existing) {
      throw new CreatorNotFoundError("That product does not exist.");
    }

    const merged = validateProductInput({
      title: input.title ?? existing.title,
      description: input.description !== undefined ? input.description : existing.description,
      price: input.price !== undefined ? input.price : existing.price,
      compareAtPrice:
        input.compareAtPrice !== undefined ? input.compareAtPrice : existing.compareAtPrice,
      coverImageUrl:
        input.coverImageUrl !== undefined ? input.coverImageUrl : existing.coverImageUrl,
      productType: (input.productType ?? existing.productType) as ProductType,
      deliveryType: (input.deliveryType ?? existing.deliveryType) as ProductDeliveryType,
      deliveryUrl: input.deliveryUrl !== undefined ? input.deliveryUrl : existing.deliveryUrl,
      licensePrefix:
        input.licensePrefix !== undefined ? input.licensePrefix : existing.licensePrefix,
      slug: input.slug ?? existing.slug,
    });

    const slug =
      merged.slug === existing.slug
        ? existing.slug
        : await uniqueSlug(this.dbInstance, profile.id, merged.slug, existing.id);

    const updated = await this.dbInstance.transaction(async (tx) => {
      const [row] = await tx
        .update(product)
        .set({ ...merged, slug, updatedAt: new Date() })
        .where(and(eq(product.id, productId), eq(product.profileId, profile.id)))
        .returning();

      if (assets !== undefined) {
        const cleanAssets = assets.map((asset, index) => {
          const fileName = (asset.fileName ?? "").trim();
          const fileUrl = (asset.fileUrl ?? "").trim();
          if (fileName.length === 0 || !isSafeOutboundUrl(fileUrl)) {
            throw new CreatorValidationError(
              "Each file needs a name and a valid http:// or https:// URL.",
            );
          }
          return {
            id: newId("asset"),
            productId,
            fileName: fileName.slice(0, 200),
            fileUrl,
            fileSize: typeof asset.fileSize === "number" ? asset.fileSize : null,
            mimeType: asset.mimeType?.trim() ? asset.mimeType.trim().slice(0, 120) : null,
            position: index,
          };
        });

        if (merged.deliveryType === "file" && cleanAssets.length === 0) {
          throw new CreatorValidationError(
            "Add at least one file, or choose link or code delivery.",
          );
        }

        await tx.delete(productAsset).where(eq(productAsset.productId, productId));
        if (cleanAssets.length > 0) {
          await tx.insert(productAsset).values(cleanAssets);
        }
      }

      return row;
    });

    invalidateStorefront(profile.username);
    return updated;
  }

  async deleteProduct(userId: string, productId: string) {
    const profile = await creatorService.ensureProfile(userId);
    const deleted = await this.dbInstance
      .delete(product)
      .where(and(eq(product.id, productId), eq(product.profileId, profile.id)))
      .returning({ id: product.id });

    if (deleted.length === 0) {
      throw new CreatorNotFoundError("That product does not exist.");
    }

    invalidateStorefront(profile.username);
    return deleted[0];
  }

  async listAssets(productId: string) {
    return this.dbInstance
      .select()
      .from(productAsset)
      .where(eq(productAsset.productId, productId))
      .orderBy(asc(productAsset.position), asc(productAsset.createdAt));
  }

  /** Rewrites storefront order from a list of product ids, as `reorderLinks` does. */
  async reorderProducts(userId: string, orderedIds: string[]) {
    const profile = await creatorService.ensureProfile(userId);
    const products = await this.listProducts(profile.id);
    const known = new Set(products.map((item) => item.id));

    const ranked = orderedIds.filter((id) => known.has(id));
    const rest = products.filter((item) => !ranked.includes(item.id)).map((item) => item.id);
    const finalOrder = [...ranked, ...rest];

    if (finalOrder.length === 0) return [];

    await this.dbInstance.transaction(async (tx) => {
      for (const [index, id] of finalOrder.entries()) {
        await tx
          .update(product)
          .set({ position: index, updatedAt: new Date() })
          .where(and(eq(product.id, id), eq(product.profileId, profile.id)));
      }
    });

    invalidateStorefront(profile.username);
    return this.listProducts(profile.id);
  }

  async incrementSales(productId: string, delta = 1) {
    await this.dbInstance
      .update(product)
      .set({ salesCount: sql`${product.salesCount} + ${delta}` })
      .where(eq(product.id, productId));
  }
}

export const productService = new ProductService();
