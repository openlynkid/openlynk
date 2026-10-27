import { revalidateTag } from "next/cache";

/**
 * Cache-tag names for a creator's public pages.
 *
 * Defined here rather than next to the queries so the read side (`queries.ts`) and the
 * write side (the creator and product services) cannot drift apart — a tag that only one
 * of them knows about is a silent cache miss.
 */
export const storefrontTag = (username: string) => `storefront:${username}`;

export const productTag = (username: string, slug: string) =>
  `product:${username}:${slug}`;

/**
 * Drops the cached storefront for one handle after a write.
 *
 * Best effort by design. `revalidateTag` needs a request scope, and a caller outside one
 * (a script, a test, a background job) still has correct data — the page's
 * `cacheLife("minutes")` is the backstop. Swallowing the invariant error is preferable to
 * failing a write that already committed.
 */
export function invalidateStorefront(username: string): void {
  try {
    revalidateTag(storefrontTag(username), "max");
  } catch {
    // No request scope; the time-based revalidation covers it.
  }
}
