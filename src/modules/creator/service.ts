import { and, asc, eq, sql, desc, inArray } from "drizzle-orm";
import crypto from "crypto";
import { db } from "@/server/db";
import { creatorProfile, creatorLink } from "@/server/db/schema/creator";
import { product } from "@/server/db/schema/creator";
import {
  isSafeOutboundUrl,
  normalizeOutboundUrl,
  slugify,
  validateProductSlug,
  validateUsername,
} from "./validation";
import {
  checkLimit,
  getCreatorEntitlements,
  type CreatorEntitlements,
} from "./entitlements";
import { invalidateStorefront } from "@/lib/storefront-cache";
import {
  isSafeColor,
  resolveTheme,
  type CreatorLinkType,
  type PublicLink,
  type PublicProduct,
  type PublicProfile,
  type ThemeInput,
} from "./types";

/** Raised when a creator submits input the domain rejects. Maps to HTTP 400. */
export class CreatorValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CreatorValidationError";
  }
}

/** Raised when a resource does not exist, or exists but belongs to someone else. */
export class CreatorNotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "CreatorNotFoundError";
  }
}

/** Raised when a plan limit blocks the write. Maps to HTTP 402/403. */
export class CreatorLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CreatorLimitError";
  }
}

const MAX_LINK_TITLE = 120;
const MAX_BIO = 500;

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(12).toString("hex")}`;
}

export interface ProfileUpdateInput {
  displayName?: string;
  bio?: string | null;
  avatarUrl?: string | null;
  username?: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  theme?: ThemeInput;
  customDomain?: string | null;
  isPublished?: boolean;
}

export interface LinkInput {
  type?: CreatorLinkType;
  title: string;
  url?: string | null;
  description?: string | null;
  icon?: string | null;
  thumbnailUrl?: string | null;
}

/** Fields a creator may set on a link, already validated and normalised. */
type LinkValues = {
  type: CreatorLinkType;
  title: string;
  url: string | null;
  description: string | null;
  icon: string | null;
  thumbnailUrl: string | null;
};

const LINK_TYPES: CreatorLinkType[] = ["link", "header", "divider"];

/**
 * Validates a link payload. A `link` needs a safe outbound URL; `header` and `divider`
 * are pure presentation, so a URL on them is dropped rather than rejected.
 */
export function validateLinkInput(input: LinkInput): LinkValues {
  const type: CreatorLinkType = input.type ?? "link";
  if (!LINK_TYPES.includes(type)) {
    throw new CreatorValidationError(`Unknown link type '${String(type)}'.`);
  }

  const title = (input.title ?? "").trim();
  if (type !== "divider" && title.length === 0) {
    throw new CreatorValidationError("A title is required.");
  }
  if (title.length > MAX_LINK_TITLE) {
    throw new CreatorValidationError(`Title must be at most ${MAX_LINK_TITLE} characters.`);
  }

  let url: string | null = null;
  if (type === "link") {
    const raw = (input.url ?? "").trim();
    if (raw.length === 0) {
      throw new CreatorValidationError("A URL is required for a link.");
    }
    const normalized = normalizeOutboundUrl(raw);
    if (!isSafeOutboundUrl(normalized)) {
      throw new CreatorValidationError("URL must be a valid http:// or https:// address.");
    }
    url = normalized;
  }

  const description = input.description?.trim() ? input.description.trim().slice(0, 300) : null;
  const icon = input.icon?.trim() ? input.icon.trim().slice(0, 40) : null;
  const thumbnailUrl =
    input.thumbnailUrl && isSafeOutboundUrl(input.thumbnailUrl.trim())
      ? input.thumbnailUrl.trim()
      : null;

  return { type, title: title || "Divider", url, description, icon, thumbnailUrl };
}

/**
 * Sanitises a theme before it is stored.
 *
 * Only known presets and 6-digit hex colours survive, so a stored theme can never carry
 * a value the renderer would have to defend against. Unknown keys are dropped.
 */
export function sanitizeTheme(input: ThemeInput | undefined): ThemeInput {
  if (!input) return {};
  const clean: ThemeInput = {};
  if (typeof input.preset === "string") clean.preset = input.preset;
  if (isSafeColor(input.background)) clean.background = input.background;
  if (isSafeColor(input.textColor)) clean.textColor = input.textColor;
  if (isSafeColor(input.accentColor)) clean.accentColor = input.accentColor;
  if (input.buttonStyle && ["solid", "outline", "soft"].includes(input.buttonStyle)) {
    clean.buttonStyle = input.buttonStyle;
  }
  if (input.buttonRadius && ["none", "md", "full"].includes(input.buttonRadius)) {
    clean.buttonRadius = input.buttonRadius;
  }
  if (input.fontFamily && ["sans", "serif", "mono"].includes(input.fontFamily)) {
    clean.fontFamily = input.fontFamily;
  }
  return clean;
}

/** `example.com/path` -> `example.com`, for custom-domain storage and lookup. */
export function normalizeDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "");
}

const DOMAIN_PATTERN = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

export function validateCustomDomain(input: unknown): string {
  if (typeof input !== "string" || input.trim().length === 0) {
    throw new CreatorValidationError("A domain is required.");
  }
  const domain = normalizeDomain(input);
  if (!DOMAIN_PATTERN.test(domain)) {
    throw new CreatorValidationError("Enter a valid domain, for example links.yourname.com.");
  }
  return domain;
}

/** Derives a candidate handle from the creator's name or email. */
function suggestUsername(seed: string | null | undefined): string {
  const base = slugify((seed ?? "").split("@")[0] ?? "", "creator").replace(/-/g, "");
  const trimmed = base.slice(0, 20);
  return trimmed.length >= 3 ? trimmed : `creator${trimmed}`;
}

export class CreatorService {
  private dbInstance: typeof db;

  constructor(dbInstance?: typeof db) {
    this.dbInstance = dbInstance ?? db;
  }

  async getProfileByUserId(userId: string) {
    const [profile] = await this.dbInstance
      .select()
      .from(creatorProfile)
      .where(eq(creatorProfile.userId, userId))
      .limit(1);
    return profile ?? null;
  }

  async getProfileByUsername(username: string) {
    const [profile] = await this.dbInstance
      .select()
      .from(creatorProfile)
      .where(eq(creatorProfile.username, username.trim().toLowerCase()))
      .limit(1);
    return profile ?? null;
  }

  async getProfileByDomain(domain: string) {
    const [profile] = await this.dbInstance
      .select()
      .from(creatorProfile)
      .where(eq(creatorProfile.customDomain, normalizeDomain(domain)))
      .limit(1);
    return profile ?? null;
  }

  /**
   * Returns the creator's profile, creating a starter one on first access.
   *
   * Every dashboard route needs a profile, so making this idempotent removes a
   * "profile missing" branch from all of them. The generated handle is checked against
   * existing rows, so two creators called "Iwan" cannot collide.
   */
  async ensureProfile(userId: string, seed?: { name?: string | null; email?: string | null }) {
    const existing = await this.getProfileByUserId(userId);
    if (existing) return existing;

    const username = await this.allocateUsername(seed?.name || seed?.email);
    const displayName = (seed?.name || "").trim() || username;

    const [created] = await this.dbInstance
      .insert(creatorProfile)
      .values({
        id: newId("cp"),
        userId,
        username,
        displayName,
        bio: null,
        theme: { preset: "default" },
        isPublished: true,
      })
      .onConflictDoNothing({ target: creatorProfile.userId })
      .returning();

    // A concurrent request may have won the race; re-read rather than fail.
    if (!created) {
      const profile = await this.getProfileByUserId(userId);
      if (!profile) throw new CreatorValidationError("Could not create a creator profile.");
      return profile;
    }
    return created;
  }

  /** Finds a free handle close to the seed, adding a numeric suffix when taken. */
  private async allocateUsername(seed: string | null | undefined): Promise<string> {
    const base = suggestUsername(seed);
    for (let attempt = 0; attempt < 25; attempt++) {
      const candidate = attempt === 0 ? base : `${base}${attempt + 1}`.slice(0, 30);
      const result = validateUsername(candidate);
      if (!result.valid) continue;
      const taken = await this.getProfileByUsername(result.normalized!);
      if (!taken) return result.normalized!;
    }
    // Deterministic fallbacks are exhausted (implausible), so use a random handle
    // rather than failing the signup.
    return `creator${crypto.randomBytes(4).toString("hex")}`;
  }

  /**
   * Applies a partial profile update.
   *
   * A username change is validated for format and uniqueness, and a custom domain for
   * shape and uniqueness, before anything is written. Fields the caller omits are left
   * untouched, so a partial form submission cannot blank the rest of the page.
   */
  async updateProfile(userId: string, input: ProfileUpdateInput) {
    const profile = await this.ensureProfile(userId);
    const entitlements = await getCreatorEntitlements(userId);

    const patch: Record<string, unknown> = { updatedAt: new Date() };

    if (input.displayName !== undefined) {
      const displayName = input.displayName.trim();
      if (displayName.length === 0 || displayName.length > 80) {
        throw new CreatorValidationError("Display name must be between 1 and 80 characters.");
      }
      patch.displayName = displayName;
    }

    if (input.bio !== undefined) {
      const bio = (input.bio ?? "").trim();
      if (bio.length > MAX_BIO) {
        throw new CreatorValidationError(`Bio must be at most ${MAX_BIO} characters.`);
      }
      patch.bio = bio.length > 0 ? bio : null;
    }

    if (input.avatarUrl !== undefined) {
      const avatarUrl = (input.avatarUrl ?? "").trim();
      if (avatarUrl.length > 0 && !isSafeOutboundUrl(avatarUrl)) {
        throw new CreatorValidationError("Avatar must be a valid http:// or https:// URL.");
      }
      patch.avatarUrl = avatarUrl.length > 0 ? avatarUrl : null;
    }

    if (input.username !== undefined && input.username.trim().toLowerCase() !== profile.username) {
      const result = validateUsername(input.username);
      if (!result.valid) {
        throw new CreatorValidationError(result.error!);
      }
      const taken = await this.getProfileByUsername(result.normalized!);
      if (taken && taken.id !== profile.id) {
        throw new CreatorValidationError(`"${result.normalized}" is already taken.`);
      }
      patch.username = result.normalized;
    }

    if (input.seoTitle !== undefined) {
      patch.seoTitle = input.seoTitle?.trim() ? input.seoTitle.trim().slice(0, 120) : null;
    }
    if (input.seoDescription !== undefined) {
      patch.seoDescription = input.seoDescription?.trim()
        ? input.seoDescription.trim().slice(0, 200)
        : null;
    }

    if (input.theme !== undefined) {
      const clean = sanitizeTheme(input.theme);
      // Custom colours are a paid feature; a free creator keeps the preset's colours.
      if (!entitlements.customTheme) {
        delete clean.background;
        delete clean.textColor;
        delete clean.accentColor;
      }
      patch.theme = clean;
    }

    if (input.customDomain !== undefined) {
      if (!entitlements.customDomain) {
        throw new CreatorValidationError(
          "Custom domains are available on the Pro plan and above.",
        );
      }
      if (input.customDomain === null || input.customDomain.trim().length === 0) {
        patch.customDomain = null;
      } else {
        const domain = validateCustomDomain(input.customDomain);
        const existing = await this.getProfileByDomain(domain);
        if (existing && existing.id !== profile.id) {
          throw new CreatorValidationError(`${domain} is already connected to another page.`);
        }
        patch.customDomain = domain;
      }
    }

    if (input.isPublished !== undefined) {
      patch.isPublished = Boolean(input.isPublished);
    }

    const [updated] = await this.dbInstance
      .update(creatorProfile)
      .set(patch)
      .where(eq(creatorProfile.id, profile.id))
      .returning();

    // A rename leaves the old handle's cache entry behind, so both are dropped.
    invalidateStorefront(updated.username);
    if (profile.username !== updated.username) {
      invalidateStorefront(profile.username);
    }

    return updated;
  }

  async listLinks(profileId: string) {
    return this.dbInstance
      .select()
      .from(creatorLink)
      .where(eq(creatorLink.profileId, profileId))
      .orderBy(asc(creatorLink.position), asc(creatorLink.createdAt));
  }

  /** Creates a link at the end of the page, enforcing the plan's link limit. */
  async createLink(userId: string, input: LinkInput) {
    const profile = await this.ensureProfile(userId);
    const entitlements = await getCreatorEntitlements(userId);
    const values = validateLinkInput(input);

    const [{ count }] = await this.dbInstance
      .select({ count: sql<number>`count(*)::int` })
      .from(creatorLink)
      .where(eq(creatorLink.profileId, profile.id));

    const limit = checkLimit("links", count, entitlements);
    if (!limit.allowed) {
      throw new CreatorLimitError(limit.error);
    }

    const [last] = await this.dbInstance
      .select({ position: creatorLink.position })
      .from(creatorLink)
      .where(eq(creatorLink.profileId, profile.id))
      .orderBy(desc(creatorLink.position))
      .limit(1);

    const [created] = await this.dbInstance
      .insert(creatorLink)
      .values({
        id: newId("link"),
        profileId: profile.id,
        ...values,
        position: (last?.position ?? -1) + 1,
        isActive: true,
      })
      .returning();

    invalidateStorefront(profile.username);
    return created;
  }

  /**
   * Updates a link the caller owns.
   *
   * Ownership is part of the WHERE clause, not a separate check, so a link id belonging
   * to another creator simply matches no row — there is no window between checking and
   * writing, and no way to update across tenants.
   */
  async updateLink(userId: string, linkId: string, input: Partial<LinkInput> & { isActive?: boolean }) {
    const profile = await this.ensureProfile(userId);

    const [existing] = await this.dbInstance
      .select()
      .from(creatorLink)
      .where(and(eq(creatorLink.id, linkId), eq(creatorLink.profileId, profile.id)))
      .limit(1);

    if (!existing) {
      throw new CreatorNotFoundError("That link does not exist.");
    }

    const patch: Record<string, unknown> = { updatedAt: new Date() };

    // Re-validate the whole link when any content field is present: changing only the
    // title of a `link` must not bypass the URL check.
    if (
      input.title !== undefined ||
      input.url !== undefined ||
      input.type !== undefined ||
      input.description !== undefined
    ) {
      const merged = validateLinkInput({
        type: (input.type ?? existing.type) as CreatorLinkType,
        title: input.title ?? existing.title,
        url: input.url !== undefined ? input.url : existing.url,
        description: input.description !== undefined ? input.description : existing.description,
        icon: input.icon !== undefined ? input.icon : existing.icon,
        thumbnailUrl:
          input.thumbnailUrl !== undefined ? input.thumbnailUrl : existing.thumbnailUrl,
      });
      Object.assign(patch, merged);
    } else {
      if (input.icon !== undefined) {
        patch.icon = input.icon?.trim() ? input.icon.trim().slice(0, 40) : null;
      }
      if (input.thumbnailUrl !== undefined) {
        patch.thumbnailUrl =
          input.thumbnailUrl && isSafeOutboundUrl(input.thumbnailUrl.trim())
            ? input.thumbnailUrl.trim()
            : null;
      }
    }

    if (input.isActive !== undefined) {
      patch.isActive = Boolean(input.isActive);
    }

    const [updated] = await this.dbInstance
      .update(creatorLink)
      .set(patch)
      .where(and(eq(creatorLink.id, linkId), eq(creatorLink.profileId, profile.id)))
      .returning();

    invalidateStorefront(profile.username);
    return updated;
  }

  async deleteLink(userId: string, linkId: string) {
    const profile = await this.ensureProfile(userId);
    const deleted = await this.dbInstance
      .delete(creatorLink)
      .where(and(eq(creatorLink.id, linkId), eq(creatorLink.profileId, profile.id)))
      .returning({ id: creatorLink.id });

    if (deleted.length === 0) {
      throw new CreatorNotFoundError("That link does not exist.");
    }

    invalidateStorefront(profile.username);
    return deleted[0];
  }

  /**
   * Rewrites the page order from a list of link ids.
   *
   * Ids that do not belong to the caller are ignored rather than rejected, so a stale
   * client sending a deleted id still reorders the rest instead of failing the whole
   * drag. Links the caller omitted keep their relative order, appended after the ones
   * that were listed.
   */
  async reorderLinks(userId: string, orderedIds: string[]) {
    const profile = await this.ensureProfile(userId);
    const links = await this.listLinks(profile.id);
    const known = new Map(links.map((link) => [link.id, link]));

    const ranked = orderedIds.filter((id) => known.has(id));
    const rest = links.filter((link) => !ranked.includes(link.id)).map((link) => link.id);
    const finalOrder = [...ranked, ...rest];

    if (finalOrder.length === 0) return [];

    await this.dbInstance.transaction(async (tx) => {
      for (const [index, id] of finalOrder.entries()) {
        await tx
          .update(creatorLink)
          .set({ position: index, updatedAt: new Date() })
          .where(and(eq(creatorLink.id, id), eq(creatorLink.profileId, profile.id)));
      }
    });

    invalidateStorefront(profile.username);
    return this.listLinks(profile.id);
  }

  /** Increments the denormalised click counter for a public link click. */
  async recordLinkClick(linkId: string) {
    await this.dbInstance
      .update(creatorLink)
      .set({ clickCount: sql`${creatorLink.clickCount} + 1` })
      .where(eq(creatorLink.id, linkId));
  }

  /**
   * Everything the public storefront needs for one handle.
   *
   * Returns `null` for a handle that does not exist and for an unpublished page, so the
   * route can 404 both without leaking which handles are registered but hidden.
   */
  async getPublicProfile(username: string): Promise<PublicProfile | null> {
    const profile = await this.getProfileByUsername(username);
    if (!profile || !profile.isPublished) return null;

    const [links, products, entitlements] = await Promise.all([
      this.dbInstance
        .select()
        .from(creatorLink)
        .where(and(eq(creatorLink.profileId, profile.id), eq(creatorLink.isActive, true)))
        .orderBy(asc(creatorLink.position), asc(creatorLink.createdAt)),
      this.dbInstance
        .select()
        .from(product)
        .where(and(eq(product.profileId, profile.id), eq(product.isActive, true)))
        .orderBy(asc(product.position), asc(product.createdAt)),
      getCreatorEntitlements(profile.userId),
    ]);

    const publicLinks: PublicLink[] = links.map((link) => ({
      id: link.id,
      type: link.type as CreatorLinkType,
      title: link.title,
      url: link.url,
      description: link.description,
      icon: link.icon,
      thumbnailUrl: link.thumbnailUrl,
    }));

    const publicProducts: PublicProduct[] = products.map((item) => ({
      id: item.id,
      slug: item.slug,
      title: item.title,
      description: item.description,
      price: item.price,
      compareAtPrice: item.compareAtPrice,
      coverImageUrl: item.coverImageUrl,
      productType: item.productType as PublicProduct["productType"],
      salesCount: item.salesCount,
    }));

    return {
      username: profile.username,
      displayName: profile.displayName,
      bio: profile.bio,
      avatarUrl: profile.avatarUrl,
      theme: resolveTheme(profile.theme),
      links: publicLinks,
      products: publicProducts,
      showBranding: !entitlements.removeBranding,
    };
  }

  /**
   * Aggregate counters for the dashboard overview.
   *
   * Counts only, no event rows: the dashboard header must not pull a full analytics
   * scan just to show a number.
   */
  async getDashboardCounts(userId: string, entitlements?: CreatorEntitlements) {
    const profile = await this.ensureProfile(userId);
    const resolved = entitlements ?? (await getCreatorEntitlements(userId));

    const [[linkCount], [productCount]] = await Promise.all([
      this.dbInstance
        .select({ count: sql<number>`count(*)::int` })
        .from(creatorLink)
        .where(eq(creatorLink.profileId, profile.id)),
      this.dbInstance
        .select({ count: sql<number>`count(*)::int` })
        .from(product)
        .where(eq(product.profileId, profile.id)),
    ]);

    return {
      profile,
      entitlements: resolved,
      linkCount: linkCount?.count ?? 0,
      productCount: productCount?.count ?? 0,
    };
  }

  /** Bulk lookup used by the storefront to resolve several products at once. */
  async listActiveProducts(profileId: string) {
    return this.dbInstance
      .select()
      .from(product)
      .where(and(eq(product.profileId, profileId), eq(product.isActive, true)))
      .orderBy(asc(product.position), asc(product.createdAt));
  }

  /** Used by the product service to resolve a product by its public path. */
  async findProductsByIds(ids: string[]) {
    if (ids.length === 0) return [];
    return this.dbInstance.select().from(product).where(inArray(product.id, ids));
  }
}

export { validateProductSlug };
export const creatorService = new CreatorService();
