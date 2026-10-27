import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * Creator page theme. Every field is optional so a profile created before a preset
 * existed still renders: the storefront falls back to the preset default for any key
 * the creator never set.
 */
export interface ProfileTheme {
  preset?: string;
  background?: string;
  buttonStyle?: "solid" | "outline" | "soft";
  buttonRadius?: "none" | "md" | "full";
  textColor?: string;
  accentColor?: string;
  fontFamily?: "sans" | "serif" | "mono";
}

/** A creator's public page: the link-in-bio surface plus its storefront settings. */
export const creatorProfile = pgTable(
  "creator_profile",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /**
     * The public handle. Lowercase, URL-safe, unique across the platform — it is the
     * whole address of the bio page (`/u/<username>`), so a rename is a breaking change
     * to every published link and is treated as such by the service.
     */
    username: text("username").notNull(),
    displayName: text("display_name").notNull(),
    bio: text("bio"),
    avatarUrl: text("avatar_url"),
    /** Page-level SEO overrides; the display name and bio are the fallback. */
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    theme: jsonb("theme").$type<ProfileTheme>().notNull().default({}),
    /** Pro-and-above: serve the page on the creator's own hostname. */
    customDomain: text("custom_domain"),
    isPublished: boolean("is_published").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("creator_profile_user_id_unique").on(table.userId),
    uniqueIndex("creator_profile_username_unique").on(table.username),
    index("creator_profile_custom_domain_idx").on(table.customDomain),
  ]
);

/**
 * A block on the bio page. `type` distinguishes a real outbound link from the visual
 * furniture a creator can place between them (a section heading or a divider), so the
 * order of the page is a single sortable list rather than three tables.
 */
export const creatorLink = pgTable(
  "creator_link",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => creatorProfile.id, { onDelete: "cascade" }),
    type: text("type").notNull().default("link"), // 'link' | 'header' | 'divider'
    title: text("title").notNull(),
    url: text("url"),
    description: text("description"),
    /** Lucide icon name, resolved by the renderer's allow-list. */
    icon: text("icon"),
    thumbnailUrl: text("thumbnail_url"),
    /** Ascending render order within a profile. */
    position: integer("position").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    /**
     * Denormalised click counter. The analytics table is the source of truth for
     * reporting; this column exists so the public page and the manager list can show a
     * number without an aggregate query per row.
     */
    clickCount: integer("click_count").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("creator_link_profile_position_idx").on(table.profileId, table.position),
  ]
);

/** A digital product for sale on the creator's storefront. */
export const product = pgTable(
  "product",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => creatorProfile.id, { onDelete: "cascade" }),
    /** URL segment under the profile: `/u/<username>/p/<slug>`. */
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    /** Price in whole IDR. `0` is a free download; negative is rejected by the service. */
    price: integer("price").notNull().default(0),
    /** Optional strike-through price for a sale, in whole IDR. */
    compareAtPrice: integer("compare_at_price"),
    coverImageUrl: text("cover_image_url"),
    productType: text("product_type").notNull().default("digital"), // 'digital' | 'ebook' | 'course' | 'membership'
    /**
     * How the buyer receives the product after payment:
     * `file` (one or more hosted assets), `link` (an external URL) or `code`
     * (a licence key generated per purchase).
     */
    deliveryType: text("delivery_type").notNull().default("file"),
    /** Used when `deliveryType` is 'link'. */
    deliveryUrl: text("delivery_url"),
    /**
     * Used when `deliveryType` is 'code'. A prefix the generated key is built from,
     * e.g. `OPENLYNK` -> `OPENLYNK-XXXX-XXXX`.
     */
    licensePrefix: text("license_prefix"),
    position: integer("position").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    /** Denormalised completed-sale counter, mirroring `creatorLink.clickCount`. */
    salesCount: integer("sales_count").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("product_profile_slug_unique").on(table.profileId, table.slug),
    index("product_profile_position_idx").on(table.profileId, table.position),
  ]
);

/** A downloadable file attached to a product with `deliveryType = 'file'`. */
export const productAsset = pgTable(
  "product_asset",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    fileUrl: text("file_url").notNull(),
    fileSize: integer("file_size"),
    mimeType: text("mime_type"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("product_asset_product_position_idx").on(table.productId, table.position)]
);

export type CreatorProfile = typeof creatorProfile.$inferSelect;
export type CreatorLink = typeof creatorLink.$inferSelect;
export type Product = typeof product.$inferSelect;
export type ProductAsset = typeof productAsset.$inferSelect;
