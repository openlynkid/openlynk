import type { MetadataRoute } from "next";
import { PUBLIC_ROUTES, absoluteUrl } from "@/lib/seo";

/**
 * `lastModified` is intentionally not set. Google's contract for the field is "the date
 * the page content last changed"; a build-time `new Date()` would claim every page
 * changed on every deploy, and a git-derived date is not reliably available (CI checks
 * out shallow, and `next build` can run with no `.git` present at all). A wrong
 * lastModified is worse than an absent one, so the field is left out until there is a
 * real source of change dates.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map((route) => ({ url: absoluteUrl(route) }));
}
