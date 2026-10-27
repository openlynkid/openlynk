import { pgTable, text, timestamp, integer, boolean, jsonb, index } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { organization } from "./organizations";

export const order = pgTable("order", {
  id: text("id").primaryKey(), // e.g. ORD-20261018-XXXX (Midtrans order_id)
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  organizationId: text("organization_id").references(() => organization.id, { onDelete: "cascade" }),
  itemType: text("item_type").notNull().default("subscription"), // 'subscription' | 'one_time' | 'credit'
  planId: text("plan_id").notNull(),
  billingPeriod: text("billing_period"), // 'monthly' | 'yearly' | 'lifetime'
  amount: integer("amount").notNull(), // Gross amount in IDR (integer)
  currency: text("currency").notNull().default("IDR"),
  status: text("status").notNull().default("pending"), // 'pending' | 'settlement' | 'capture' | 'deny' | 'cancel' | 'expire' | 'failure'
  snapToken: text("snap_token"),
  snapRedirectUrl: text("snap_redirect_url"),
  paymentType: text("payment_type"), // 'credit_card' | 'gopay' | 'qris' | 'bank_transfer'
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const subscription = pgTable("subscription", {
  id: text("id").primaryKey(), // Generated UUID or sub_xxx
  orderId: text("order_id")
    .unique()
    .references(() => order.id, { onDelete: "set null" }),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  organizationId: text("organization_id").references(() => organization.id, { onDelete: "cascade" }),
  planId: text("plan_id").notNull(), // 'starter' | 'pro' | 'enterprise'
  status: text("status").notNull().default("active"), // 'active' | 'past_due' | 'canceled' | 'expired'
  billingPeriod: text("billing_period").notNull().default("monthly"), // 'monthly' | 'yearly' | 'lifetime'
  currentPeriodStart: timestamp("current_period_start").notNull().defaultNow(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  // Entitlement lookups filter active subscriptions per owner; the expiry cron
  // scans active rows by period end. These composite indexes serve both.
  index("subscription_user_status_idx").on(table.userId, table.status),
  index("subscription_org_status_idx").on(table.organizationId, table.status),
  index("subscription_status_period_end_idx").on(table.status, table.currentPeriodEnd),
]);

export const paymentTransaction = pgTable("payment_transaction", {
  id: text("id").primaryKey(), // Midtrans transaction_id
  orderId: text("order_id")
    .notNull()
    .references(() => order.id, { onDelete: "cascade" }),
  grossAmount: integer("gross_amount").notNull(),
  paymentType: text("payment_type").notNull(),
  transactionStatus: text("transaction_status").notNull(), // e.g. 'settlement', 'capture', 'pending', etc.
  fraudStatus: text("fraud_status"),
  statusCode: text("status_code").notNull(),
  statusMessage: text("status_message"),
  rawPayload: jsonb("raw_payload").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const webhookEvent = pgTable("webhook_event", {
  id: text("id").primaryKey(), // SHA256 or uuid
  gateway: text("gateway").notNull().default("midtrans"),
  orderId: text("order_id"),
  signature: text("signature").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  processed: boolean("processed").notNull().default(false),
  processingError: text("processing_error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
