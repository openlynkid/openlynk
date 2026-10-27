import { and, desc, eq, gte, sql } from "drizzle-orm";
import crypto from "crypto";
import { db } from "@/server/db";
import { analyticsEvent } from "@/server/db/schema/analytics";
import { creatorLink, product } from "@/server/db/schema/creator";
import { purchase } from "@/server/db/schema/store";

export type AnalyticsEventType =
  | "profile_view"
  | "link_click"
  | "product_view"
  | "purchase";

const EVENT_TYPES: AnalyticsEventType[] = [
  "profile_view",
  "link_click",
  "product_view",
  "purchase",
];

function newId(): string {
  return `evt_${crypto.randomBytes(12).toString("hex")}`;
}

/**
 * Coarse device class from the user agent.
 *
 * Deliberately coarse: the dashboard shows a device split, and storing a full
 * fingerprint-grade user agent would be more personal data than that feature needs.
 */
export function classifyDevice(userAgent: string | null | undefined): string {
  if (!userAgent) return "unknown";
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet|playbook|silk/.test(ua)) return "tablet";
  if (/mobi|android|iphone|ipod|phone/.test(ua)) return "mobile";
  if (/windows|macintosh|linux|cros/.test(ua)) return "desktop";
  return "unknown";
}

/**
 * Keeps only the origin of a referrer, and only when it is a real site.
 *
 * A full referrer URL can carry a search query or a private path, so it is reduced to
 * the host before storage; anything that is not http(s) is dropped.
 */
export function normalizeReferrer(referrer: string | null | undefined): string | null {
  if (!referrer) return null;
  try {
    const url = new URL(referrer);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.host.slice(0, 200);
  } catch {
    return null;
  }
}

export interface RecordEventInput {
  profileId: string;
  eventType: AnalyticsEventType;
  targetId?: string | null;
  referrer?: string | null;
  country?: string | null;
  device?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Records one storefront interaction.
 *
 * Never throws: analytics is a side effect of serving a page, and a creator's public
 * storefront must not return a 500 because a metrics insert failed. The caller gets
 * `null` and the error is logged.
 */
export async function recordEvent(
  input: RecordEventInput,
  dbInstance: typeof db = db
): Promise<string | null> {
  if (!EVENT_TYPES.includes(input.eventType)) return null;

  try {
    const [row] = await dbInstance
      .insert(analyticsEvent)
      .values({
        id: newId(),
        profileId: input.profileId,
        eventType: input.eventType,
        targetId: input.targetId ?? null,
        referrer: normalizeReferrer(input.referrer),
        country: input.country ? input.country.slice(0, 2).toUpperCase() : null,
        device: input.device ? input.device.slice(0, 20) : null,
        metadata: input.metadata ?? null,
      })
      .returning({ id: analyticsEvent.id });
    return row?.id ?? null;
  } catch (error) {
    console.error(
      "⚠️ Failed to record analytics event:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export interface AnalyticsSummary {
  rangeDays: number;
  views: number;
  linkClicks: number;
  productViews: number;
  purchases: number;
  /** Purchases divided by profile views, as a percentage rounded to one decimal. */
  conversionRate: number;
  /** Revenue in whole IDR from completed purchases in the window. */
  revenue: number;
  /** Views per day, oldest first, one entry per day in the window. */
  viewsByDay: { date: string; views: number }[];
  /** Per-link click counts, most clicked first. */
  topLinks: { id: string; title: string; clicks: number }[];
  /** Per-product revenue, highest first. */
  topProducts: { id: string; title: string; sales: number; revenue: number }[];
  devices: { device: string; count: number }[];
  countries: { country: string; count: number }[];
}

/** Clamps a caller-supplied window to a sane range of whole days. */
export function normalizeRangeDays(value: unknown, fallback = 30): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), 1), 365);
}

/**
 * Builds the dashboard analytics summary for one profile over a window.
 *
 * Reads the aggregate counters and the event table in one pass. The `purchase` count and
 * `revenue` come from the `purchase` table rather than the event stream, so a
 * failed analytics insert can never understate money actually collected.
 */
export async function getAnalyticsSummary(
  profileId: string,
  rangeDays = 30,
  dbInstance: typeof db = db,
  now = new Date()
): Promise<AnalyticsSummary> {
  const days = normalizeRangeDays(rangeDays);
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const countByType = async (eventType: AnalyticsEventType) => {
    const [row] = await dbInstance
      .select({ count: sql<number>`count(*)::int` })
      .from(analyticsEvent)
      .where(
        and(
          eq(analyticsEvent.profileId, profileId),
          eq(analyticsEvent.eventType, eventType),
          gte(analyticsEvent.createdAt, since)
        )
      );
    return row?.count ?? 0;
  };

  const [views, linkClicks, productViews] = await Promise.all([
    countByType("profile_view"),
    countByType("link_click"),
    countByType("product_view"),
  ]);

  const [purchaseAgg] = await dbInstance
    .select({
      count: sql<number>`count(*)::int`,
      revenue: sql<number>`coalesce(sum(${purchase.amount}), 0)::int`,
    })
    .from(purchase)
    .where(
      and(
        eq(purchase.profileId, profileId),
        eq(purchase.status, "completed"),
        gte(purchase.createdAt, since)
      )
    );

  const purchases = purchaseAgg?.count ?? 0;
  const revenue = purchaseAgg?.revenue ?? 0;

  const viewsByDayRows = await dbInstance
    .select({
      day: sql<string>`to_char(date_trunc('day', ${analyticsEvent.createdAt}), 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    })
    .from(analyticsEvent)
    .where(
      and(
        eq(analyticsEvent.profileId, profileId),
        eq(analyticsEvent.eventType, "profile_view"),
        gte(analyticsEvent.createdAt, since)
      )
    )
    .groupBy(sql`date_trunc('day', ${analyticsEvent.createdAt})`)
    .orderBy(sql`date_trunc('day', ${analyticsEvent.createdAt})`);

  // Fill the gaps so the chart has one point per day rather than only the days that
  // happened to have traffic.
  const byDay = new Map(viewsByDayRows.map((row) => [row.day, row.count]));
  const viewsByDay: { date: string; views: number }[] = [];
  for (let offset = days - 1; offset >= 0; offset--) {
    const date = new Date(now.getTime() - offset * 24 * 60 * 60 * 1000);
    const key = date.toISOString().slice(0, 10);
    viewsByDay.push({ date: key, views: byDay.get(key) ?? 0 });
  }

  const topLinkRows = await dbInstance
    .select({
      id: creatorLink.id,
      title: creatorLink.title,
      clicks: creatorLink.clickCount,
    })
    .from(creatorLink)
    .where(eq(creatorLink.profileId, profileId))
    .orderBy(desc(creatorLink.clickCount))
    .limit(5);

  const topProductRows = await dbInstance
    .select({
      id: product.id,
      title: product.title,
      sales: sql<number>`count(${purchase.id})::int`,
      revenue: sql<number>`coalesce(sum(${purchase.amount}), 0)::int`,
    })
    .from(product)
    .leftJoin(
      purchase,
      and(eq(purchase.productId, product.id), eq(purchase.status, "completed"))
    )
    .where(eq(product.profileId, profileId))
    .groupBy(product.id, product.title)
    .orderBy(desc(sql`coalesce(sum(${purchase.amount}), 0)`))
    .limit(5);

  const deviceRows = await dbInstance
    .select({
      device: sql<string>`coalesce(${analyticsEvent.device}, 'unknown')`,
      count: sql<number>`count(*)::int`,
    })
    .from(analyticsEvent)
    .where(
      and(eq(analyticsEvent.profileId, profileId), gte(analyticsEvent.createdAt, since))
    )
    .groupBy(sql`coalesce(${analyticsEvent.device}, 'unknown')`)
    .orderBy(desc(sql`count(*)`));

  const countryRows = await dbInstance
    .select({
      country: sql<string>`coalesce(${analyticsEvent.country}, 'XX')`,
      count: sql<number>`count(*)::int`,
    })
    .from(analyticsEvent)
    .where(
      and(
        eq(analyticsEvent.profileId, profileId),
        gte(analyticsEvent.createdAt, since),
        sql`${analyticsEvent.country} is not null`
      )
    )
    .groupBy(sql`coalesce(${analyticsEvent.country}, 'XX')`)
    .orderBy(desc(sql`count(*)`))
    .limit(10);

  return {
    rangeDays: days,
    views,
    linkClicks,
    productViews,
    purchases,
    conversionRate: views > 0 ? Math.round((purchases / views) * 1000) / 10 : 0,
    revenue,
    viewsByDay,
    topLinks: topLinkRows.map((row) => ({
      id: row.id,
      title: row.title,
      clicks: row.clicks ?? 0,
    })),
    topProducts: topProductRows.map((row) => ({
      id: row.id,
      title: row.title,
      sales: row.sales ?? 0,
      revenue: row.revenue ?? 0,
    })),
    devices: deviceRows.map((row) => ({ device: row.device, count: row.count })),
    countries: countryRows.map((row) => ({ country: row.country, count: row.count })),
  };
}

export interface PurchaseRecord {
  id: string;
  productTitle: string;
  buyerEmail: string;
  amount: number;
  status: string;
  licenseKey: string | null;
  createdAt: Date;
}

/** Recent orders for the creator's order list. */
export async function listRecentPurchases(
  profileId: string,
  limit = 50,
  dbInstance: typeof db = db
): Promise<PurchaseRecord[]> {
  const rows = await dbInstance
    .select({
      id: purchase.id,
      productTitle: product.title,
      buyerEmail: purchase.buyerEmail,
      amount: purchase.amount,
      status: purchase.status,
      licenseKey: purchase.licenseKey,
      createdAt: purchase.createdAt,
    })
    .from(purchase)
    .innerJoin(product, eq(purchase.productId, product.id))
    .where(eq(purchase.profileId, profileId))
    .orderBy(desc(purchase.createdAt))
    .limit(Math.min(Math.max(limit, 1), 200));

  return rows.map((row) => ({
    id: row.id,
    productTitle: row.productTitle,
    buyerEmail: row.buyerEmail,
    amount: row.amount,
    status: row.status,
    licenseKey: row.licenseKey,
    createdAt: row.createdAt,
  }));
}
