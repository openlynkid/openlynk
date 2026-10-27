import { cacheLife, cacheTag } from "next/cache";
import { creatorService } from "@/modules/creator/service";
import { productService } from "@/modules/creator/products";
import { productTag, storefrontTag } from "@/lib/storefront-cache";

/**
 * Cached storefront reads, shared by the bio page and the product page.
 *
 * The cache tag is per handle, so a creator's write can invalidate exactly their own
 * pages. `cacheLife("minutes")` is the backstop for a write that happens on another
 * instance before the tag propagates.
 *
 * These live outside the route files because a `page.tsx` may only export the values
 * Next itself understands — a helper export from a page is a build error.
 */

export async function getCachedProfile(username: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(storefrontTag(username));
  return creatorService.getPublicProfile(username);
}

export async function getCachedProduct(username: string, slug: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(storefrontTag(username), productTag(username, slug));
  return productService.getPublicProduct(username, slug);
}
