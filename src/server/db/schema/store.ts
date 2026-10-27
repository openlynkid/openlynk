import { pgTable, text, timestamp, integer, boolean, jsonb, index } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { creatorProfile, product } from "./creator";

/**
 * A storefront purchase intent, one row per product per checkout attempt.
 *
 * Kept separate from the platform's `order` table on purpose. That table carries
 * *subscription* semantics — plan ids, billing periods, period extension on webhook —
 * and reusing it for one-time digital goods would mean every entitlement query had to
 * discriminate between two meanings of the same columns. A storefront order is a single
 * product, paid once, with no renewal.
 */
export const storeOrder = pgTable(
  "store_order",
  {
    id: text("id").primaryKey(), // Midtrans order_id: OL-<epoch>-<rand>
    profileId: text("profile_id")
      .notNull()
      .references(() => creatorProfile.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    /** The buyer, when they were signed in at checkout. Guest checkout is allowed. */
    buyerUserId: text("buyer_user_id").references(() => user.id, { onDelete: "set null" }),
    buyerEmail: text("buyer_email").notNull(),
    buyerName: text("buyer_name"),
    /** Charge in whole IDR. Snapshotted from the product so a later price edit cannot
     * change what an in-flight order is expected to cost. */
    amount: integer("amount").notNull(),
    currency: text("currency").notNull().default("IDR"),
    status: text("status").notNull().default("pending"),
    snapToken: text("snap_token"),
    snapRedirectUrl: text("snap_redirect_url"),
    paymentType: text("payment_type"),
    paidAt: timestamp("paid_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("store_order_profile_created_idx").on(table.profileId, table.createdAt),
    index("store_order_product_idx").on(table.productId),
    index("store_order_buyer_idx").on(table.buyerUserId),
    index("store_order_status_idx").on(table.status),
  ]
);

/**
 * A fulfilled purchase: the buyer's entitlement to a product.
 *
 * Created exactly once per paid order. The unique `orderId` is what makes webhook
 * retries idempotent — a second settlement for the same order cannot mint a second
 * entitlement.
 */
export const purchase = pgTable(
  "purchase",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .unique()
      .references(() => storeOrder.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    profileId: text("profile_id")
      .notNull()
      .references(() => creatorProfile.id, { onDelete: "cascade" }),
    buyerUserId: text("buyer_user_id").references(() => user.id, { onDelete: "set null" }),
    buyerEmail: text("buyer_email").notNull(),
    amount: integer("amount").notNull(),
    status: text("status").notNull().default("completed"), // 'completed' | 'refunded'
    /** The licence key minted when the product delivers by code. */
    licenseKey: text("license_key"),
    /** A random token that authorises the download page for a guest buyer. */
    downloadToken: text("download_token").notNull(),
    downloadCount: integer("download_count").notNull().default(0),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    refundedAt: timestamp("refunded_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("purchase_profile_created_idx").on(table.profileId, table.createdAt),
    index("purchase_buyer_email_idx").on(table.buyerEmail),
    index("purchase_buyer_user_idx").on(table.buyerUserId),
    index("purchase_download_token_idx").on(table.downloadToken),
    index("purchase_product_status_idx").on(table.productId, table.status),
  ]
);

/**
 * The immutable record of what the gateway said, one row per transaction id.
 *
 * Mirrors `payment_transaction` for the subscription flow. Its `settled` flag is the
 * monotonicity guard: a transaction that already settled can never be walked back by a
 * late `pending` or `expire` notification.
 */
export const storeTransaction = pgTable("store_transaction", {
  id: text("id").primaryKey(), // Midtrans transaction_id
  orderId: text("order_id")
    .notNull()
    .references(() => storeOrder.id, { onDelete: "cascade" }),
  grossAmount: integer("gross_amount").notNull(),
  paymentType: text("payment_type").notNull(),
  transactionStatus: text("transaction_status").notNull(),
  fraudStatus: text("fraud_status"),
  statusCode: text("status_code").notNull(),
  statusMessage: text("status_message"),
  rawPayload: jsonb("raw_payload").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/**
 * Webhook audit trail, mirroring `webhook_event`.
 *
 * `gateway` keeps one table usable for both Midtrans and a future second provider, and
 * the `(gateway, id)` primary key is what stops a replayed delivery from being
 * processed twice.
 */
export const storeWebhookEvent = pgTable(
  "store_webhook_event",
  {
    id: text("id").primaryKey(),
    gateway: text("gateway").notNull().default("midtrans"),
    orderId: text("order_id"),
    signature: text("signature").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    processed: boolean("processed").notNull().default(false),
    processingError: text("processing_error"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("store_webhook_event_order_idx").on(table.orderId)]
);

export type StoreOrder = typeof storeOrder.$inferSelect;
export type Purchase = typeof purchase.$inferSelect;
export type StoreTransaction = typeof storeTransaction.$inferSelect;
export type StoreWebhookEvent = typeof storeWebhookEvent.$inferSelect;
