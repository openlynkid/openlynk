import { pgTable, text, timestamp, index, jsonb } from "drizzle-orm/pg-core";
import { creatorProfile } from "./creator";

/**
 * An append-only stream of storefront interactions. Reporting aggregates over this
 * table rather than incrementing counters, so a lost write degrades one report instead
 * of corrupting a running total.
 */
export const analyticsEvent = pgTable(
  "analytics_event",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => creatorProfile.id, { onDelete: "cascade" }),
    /** 'profile_view' | 'link_click' | 'product_view' | 'purchase' */
    eventType: text("event_type").notNull(),
    /** The link or product the event is about, when the event has a target. */
    targetId: text("target_id"),
    referrer: text("referrer"),
    /** Two-letter country from the edge geolocation header, when present. */
    country: text("country"),
    device: text("device"), // 'mobile' | 'tablet' | 'desktop' | 'unknown'
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    // Every report filters one profile over a date range, then groups by type.
    index("analytics_event_profile_created_idx").on(table.profileId, table.createdAt),
    index("analytics_event_profile_type_created_idx").on(
      table.profileId,
      table.eventType,
      table.createdAt
    ),
    index("analytics_event_target_idx").on(table.targetId),
  ]
);

export type AnalyticsEvent = typeof analyticsEvent.$inferSelect;
