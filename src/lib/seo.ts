import { env } from "@/env";

/**
 * The public, indexable surface, as site-relative paths. These are the URLs that appear
 * in `sitemap.xml`.
 *
 * `/login` and `/register` are deliberately absent: `robots.txt` disallows them, and
 * listing a disallowed URL in the sitemap is a contradiction — the sitemap asks for an
 * index, robots asks for the opposite.
 */
export const PUBLIC_ROUTES = ["/"] as const;

/**
 * Route prefixes that are indexable but cannot be enumerated in a static sitemap.
 *
 * A creator's page is `/u/<handle>` — the set is unbounded and changes while the app
 * runs, so there is nothing to list at build time. They must still be crawlable (a
 * creator's whole point is being found), so they are neither in `PUBLIC_ROUTES` nor
 * disallowed in `robots.txt`. This is the third category the classification guard
 * requires for exactly this case.
 */
export const INDEXABLE_DYNAMIC_ROUTES = ["/u"] as const;

/**
 * Route prefixes that must stay out of the index and out of the sitemap.
 *
 * Kept beside `PUBLIC_ROUTES` so the two cannot drift: `tests/sitemap-route.test.ts`
 * walks `src/app` and fails if any page is classified by none of these lists, so adding
 * a page forces a decision instead of silently omitting it from the sitemap.
 */
export const PRIVATE_ROUTES = [
  "/dashboard",
  "/library",
  "/login",
  "/register",
] as const;

/**
 * The site origin from the validated env, with trailing slashes removed so a configured
 * `https://app.example.com/` cannot produce `https://app.example.com//sitemap.xml`.
 */
export function getSiteOrigin(): string {
  return env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
}

/** Absolute URL for a site-relative path. */
export function absoluteUrl(path: string): string {
  return `${getSiteOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
}
