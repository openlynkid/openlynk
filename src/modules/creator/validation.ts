/**
 * Handles are the public address of a storefront (`/u/<username>`), so their rules are
 * a contract: a handle that passes validation here must be safe to put in a URL path and
 * must not collide with a route the app already serves.
 */

/** 3-30 characters, lowercase alphanumeric with internal `-` or `_`. */
const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{1,28}[a-z0-9])$/;

/**
 * Path segments that already mean something to the router or the platform. A handle
 * that shadows one would make the storefront unreachable or, worse, let a creator
 * impersonate a platform surface, so they are refused at the source.
 */
export const RESERVED_USERNAMES = new Set([
  "api",
  "u",
  "dashboard",
  "login",
  "register",
  "signup",
  "signin",
  "logout",
  "admin",
  "administrator",
  "root",
  "system",
  "support",
  "help",
  "about",
  "pricing",
  "billing",
  "settings",
  "account",
  "profile",
  "store",
  "shop",
  "product",
  "products",
  "links",
  "analytics",
  "orders",
  "library",
  "checkout",
  "pay",
  "payment",
  "webhooks",
  "webhook",
  "public",
  "static",
  "assets",
  "images",
  "media",
  "cdn",
  "docs",
  "blog",
  "terms",
  "privacy",
  "legal",
  "openlynk",
  "openlynk-id",
  "www",
  "mail",
  "email",
  "ftp",
  "ns",
  "robots",
  "sitemap",
  "favicon",
  "well-known",
]);

export interface HandleValidationResult {
  valid: boolean;
  /** The normalised handle to store, present only when `valid`. */
  normalized?: string;
  error?: string;
}

/**
 * Validates and normalises a creator handle.
 *
 * Normalisation is lowercase and trim only. Folding `_` to `-` or stripping other
 * characters would silently point two different requested handles at one page, which is
 * a worse surprise than a rejection.
 */
export function validateUsername(input: unknown): HandleValidationResult {
  if (typeof input !== "string") {
    return { valid: false, error: "Username must be text." };
  }

  const normalized = input.trim().toLowerCase();

  if (normalized.length === 0) {
    return { valid: false, error: "Username is required." };
  }
  if (normalized.length < 3) {
    return { valid: false, error: "Username must be at least 3 characters." };
  }
  if (normalized.length > 30) {
    return { valid: false, error: "Username must be at most 30 characters." };
  }
  if (!USERNAME_PATTERN.test(normalized)) {
    return {
      valid: false,
      error:
        "Username may only contain lowercase letters, numbers, hyphens and underscores, and must start and end with a letter or number.",
    };
  }
  if (RESERVED_USERNAMES.has(normalized)) {
    return { valid: false, error: `"${normalized}" is reserved and cannot be used.` };
  }

  return { valid: true, normalized };
}

/** Product slugs live under the profile, so they only need to be URL-safe. */
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/;

export function validateProductSlug(input: unknown): HandleValidationResult {
  if (typeof input !== "string") {
    return { valid: false, error: "Slug must be text." };
  }
  const normalized = input.trim().toLowerCase();

  if (normalized.length === 0) {
    return { valid: false, error: "Slug is required." };
  }
  if (normalized.length > 60) {
    return { valid: false, error: "Slug must be at most 60 characters." };
  }
  if (!SLUG_PATTERN.test(normalized)) {
    return {
      valid: false,
      error: "Slug may only contain lowercase letters, numbers and hyphens.",
    };
  }

  return { valid: true, normalized };
}

/**
 * Derives a slug from a product title. Falls back to a caller-supplied suffix when the
 * title has no usable characters, so the caller never has to handle an empty slug.
 */
export function slugify(input: string, fallback = "product"): string {
  const slug = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");

  return slug.length > 0 ? slug : fallback;
}

/**
 * Only http(s) links are accepted on a public page. A `javascript:` or `data:` URL on a
 * storefront is a stored-XSS vector, and a protocol-relative `//evil.test` link is a
 * phishing redirect, so both are rejected outright.
 */
export function isSafeOutboundUrl(input: unknown): input is string {
  if (typeof input !== "string") return false;
  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > 2048) return false;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }

  return parsed.protocol === "http:" || parsed.protocol === "https:";
}

export function normalizeOutboundUrl(input: string): string {
  const trimmed = input.trim();
  // A bare `example.com` is what creators paste most often; give it a scheme rather
  // than rejecting a link they can see is valid.
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}
