import { db } from "@/server/db";
import { order, subscription, paymentTransaction, webhookEvent } from "@/server/db/schema/billing";
import { eq, and, desc, isNull, or, sql, lte, ne } from "drizzle-orm";
import { getPlanById, getPlanAmount, isSupportedInterval } from "./plans";
import { midtrans } from "./midtrans-client";
import { calculatePeriodEnd } from "./date-utils";
import type {
  CreateCheckoutInput,
  CheckoutSessionResponse,
  MidtransNotificationPayload,
  BillingInterval,
} from "./types";
import { WebhookValidationError, CheckoutValidationError } from "./types";
import crypto from "crypto";

export { calculatePeriodEnd };

export function validateGrossAmount(
  grossAmountInput: unknown,
  expectedOrderAmount: number
): { valid: boolean; normalizedAmount: string; error?: string } {
  if (grossAmountInput === undefined || grossAmountInput === null) {
    return { valid: false, normalizedAmount: "", error: "Missing gross_amount" };
  }

  const grossAmountStr = String(grossAmountInput).trim();
  // Deterministic IDR regex: non-negative integer digits optionally followed by .0 or .00
  if (!/^(?:0|[1-9]\d*)(?:\.00?)?$/.test(grossAmountStr)) {
    return { valid: false, normalizedAmount: "", error: `Malformed gross_amount format: ${grossAmountStr}` };
  }

  const numericVal = Math.round(Number(grossAmountStr));
  if (numericVal !== expectedOrderAmount) {
    return {
      valid: false,
      normalizedAmount: String(numericVal),
      error: `Gross amount mismatch: expected ${expectedOrderAmount}, received ${grossAmountStr}`,
    };
  }

  return { valid: true, normalizedAmount: String(expectedOrderAmount) };
}

export function computeWebhookFingerprint(payload: {
  transaction_id?: string;
  order_id: string;
  transaction_status: string;
  status_code: string;
  fraud_status?: string;
  gross_amount: string | number;
}): { eventId: string; rawFingerprint: string } {
  const transactionId = (payload.transaction_id || "").trim();
  const orderId = (payload.order_id || "").trim();
  const transactionStatus = (payload.transaction_status || "").trim().toLowerCase();
  const statusCode = (payload.status_code || "").trim();
  const fraudStatus = (payload.fraud_status || "").trim().toLowerCase();

  // Canonicalize gross_amount: if valid numeric string, use integer string
  const rawAmountStr = String(payload.gross_amount).trim();
  let canonicalAmount = rawAmountStr;
  if (/^(?:0|[1-9]\d*)(?:\.00?)?$/.test(rawAmountStr)) {
    canonicalAmount = String(Math.round(Number(rawAmountStr)));
  }

  const rawFingerprint = `${transactionId}:${orderId}:${transactionStatus}:${statusCode}:${fraudStatus}:${canonicalAmount}`;
  const eventFingerprint = crypto.createHash("sha256").update(rawFingerprint).digest("hex");
  return { eventId: `wh_${eventFingerprint}`, rawFingerprint };
}

export function determinePaymentStatus(
  transactionStatus: string,
  fraudStatus?: string
): { isSuccess: boolean; finalStatus: string } {
  const isSuccess =
    transactionStatus === "settlement" ||
    (transactionStatus === "capture" && fraudStatus === "accept");

  let finalStatus = "pending";
  if (isSuccess) {
    finalStatus = "settlement";
  } else if (transactionStatus === "capture" && fraudStatus === "challenge") {
    finalStatus = "challenge";
  } else if (transactionStatus === "pending") {
    finalStatus = "pending";
  } else if (
    transactionStatus === "deny" ||
    transactionStatus === "cancel" ||
    transactionStatus === "expire"
  ) {
    finalStatus = transactionStatus;
  } else if (
    transactionStatus === "refund" ||
    transactionStatus === "partial_refund"
  ) {
    finalStatus = "refund";
  } else {
    finalStatus = "failure";
  }

  return { isSuccess, finalStatus };
}

export function shouldUpdateOrderStatus(
  currentStatus: string,
  incomingFinalStatus: string
): boolean {
  if (currentStatus === "settlement") {
    // Legitimate refund transitions settled order to refund
    if (incomingFinalStatus === "refund") return true;
    // Repeated settlement is idempotent
    if (incomingFinalStatus === "settlement") return true;
    // Stale/delayed out-of-order events (pending, expire, deny, cancel, challenge) are ignored
    return false;
  }

  if (currentStatus === "refund") {
    // Once fully refunded, late settlement or capture cannot reactivate the order
    return incomingFinalStatus === "refund";
  }

  if (currentStatus === "deny" || currentStatus === "cancel" || currentStatus === "expire") {
    // Terminal failure before settlement cannot regress to pending
    if (incomingFinalStatus === "pending") return false;
    return true;
  }

  // From pending or challenge, any valid status update is permitted
  return true;
}

/**
 * Single centralized function to determine whether a subscription is actively entitled.
 * Strictly enforces that currentPeriodEnd <= now is expired, regardless of whether
 * the database column still reads 'active'. Lifetime subscriptions never expire.
 */
export function isSubscriptionActive(
  sub: {
    status: string;
    billingPeriod?: string | null;
    currentPeriodEnd?: Date | null;
  } | null | undefined,
  now = new Date()
): boolean {
  if (!sub) return false;
  if (sub.status !== "active") return false;
  if (sub.billingPeriod === "lifetime") return true;
  if (!sub.currentPeriodEnd) return false;

  const nowMs = now.getTime();
  const endMs = new Date(sub.currentPeriodEnd).getTime();

  // Strict boundary: currentPeriodEnd <= now is expired (must be strictly > now)
  return endMs > nowMs;
}

export class BillingService {
  private dbInstance: typeof db;

  constructor(dbInstance?: typeof db) {
    this.dbInstance = dbInstance ?? db;
  }

  async createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutSessionResponse> {
    const plan = getPlanById(input.planId);
    if (!plan) {
      throw new CheckoutValidationError(`Invalid plan ID: ${input.planId}`);
    }

    if (plan.price <= 0) {
      throw new CheckoutValidationError("Free plans do not require payment checkout.");
    }

    if (!isSupportedInterval(plan, input.interval)) {
      throw new CheckoutValidationError(
        `Unsupported billing interval '${input.interval}' for plan '${plan.id}'.`
      );
    }

    // Authoritative amount for the selected plan and interval
    const totalAmount = getPlanAmount(plan, input.interval);

    const orderId = `ORD-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Call Midtrans Snap
    const snap = await midtrans.createSnapTransaction({
      transaction_details: {
        order_id: orderId,
        gross_amount: totalAmount,
      },
      item_details: [
        {
          id: plan.id,
          name: `${plan.name} Plan (${input.interval})`,
          price: totalAmount,
          quantity: 1,
        },
      ],
      customer_details: {
        first_name: input.userName || "Customer",
        email: input.userEmail,
      },
      callbacks: {
        finish: `${appUrl}/dashboard/billing?status=success&order_id=${orderId}`,
      },
    });

    // Save order in database
    await this.dbInstance.insert(order).values({
      id: orderId,
      userId: input.userId,
      organizationId: input.organizationId || null,
      itemType: input.interval === "lifetime" ? "one_time" : "subscription",
      planId: plan.id,
      billingPeriod: input.interval,
      amount: totalAmount,
      currency: "IDR",
      status: "pending",
      snapToken: snap.token,
      snapRedirectUrl: snap.redirect_url,
      metadata: {
        userEmail: input.userEmail,
      },
    });

    return {
      orderId,
      snapToken: snap.token,
      snapRedirectUrl: snap.redirect_url,
      amount: totalAmount,
    };
  }

  async processWebhookNotification(payload: MidtransNotificationPayload): Promise<{
    success: boolean;
    orderId: string;
    status: string;
    duplicate?: boolean;
  }> {
    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_id,
      transaction_status,
      fraud_status,
      payment_type,
    } = payload;

    if (!order_id || !status_code || !gross_amount || !signature_key || !transaction_status) {
      throw new WebhookValidationError("Missing required fields in Midtrans notification payload");
    }

    // 1. Verify Signature using constant-time comparison before modifying state
    const isValidSignature = midtrans.verifySignature(
      order_id,
      status_code,
      gross_amount,
      signature_key
    );

    // Compute canonical, deterministic idempotency key for this event
    const { eventId } = computeWebhookFingerprint({
      transaction_id,
      order_id,
      transaction_status,
      status_code,
      fraud_status,
      gross_amount,
    });

    if (!isValidSignature) {
      // Record rejected audit event without exposing signing keys or secrets
      try {
        await this.dbInstance
          .insert(webhookEvent)
          .values({
            id: eventId,
            gateway: "midtrans",
            orderId: order_id,
            signature: signature_key,
            payload,
            processed: false,
            processingError: "Invalid SHA-512 signature",
          })
          .onConflictDoNothing();
      } catch (auditErr) {
        console.error("Failed to record signature failure audit:", auditErr);
      }

      throw new WebhookValidationError(`Invalid signature for order ${order_id}`);
    }

    // 2. Process notification atomically in database transaction
    try {
      return await this.dbInstance.transaction(async (tx) => {
        // Check if this exact event was already processed
        const [existingEvent] = await tx
          .select()
          .from(webhookEvent)
          .where(eq(webhookEvent.id, eventId))
          .limit(1);

        if (existingEvent && existingEvent.processed) {
          return {
            success: true,
            orderId: order_id,
            status: transaction_status,
            duplicate: true,
          };
        }

        // Concurrency lock: lock the order row using SELECT ... FOR UPDATE
        const [existingOrder] = await tx
          .select()
          .from(order)
          .where(eq(order.id, order_id))
          .for("update");

        if (!existingOrder) {
          throw new WebhookValidationError(`Order with ID ${order_id} not found in database.`);
        }

        // Validate gross_amount against authoritative order amount
        const amountCheck = validateGrossAmount(gross_amount, existingOrder.amount);
        if (!amountCheck.valid) {
          throw new WebhookValidationError(amountCheck.error || `Gross amount mismatch for order ${order_id}`);
        }

        // Validate currency if provided
        if (
          payload.currency &&
          payload.currency.trim().toUpperCase() !== existingOrder.currency.toUpperCase()
        ) {
          throw new WebhookValidationError(
            `Currency mismatch for order ${order_id}: expected ${existingOrder.currency}, received ${payload.currency}`
          );
        }

        // Determine Final Status based on Midtrans semantics
        const { isSuccess, finalStatus } = determinePaymentStatus(
          transaction_status,
          fraud_status
        );

        // Record or update transaction log with state monotonicity guard
        if (transaction_id) {
          await tx
            .insert(paymentTransaction)
            .values({
              id: transaction_id,
              orderId: order_id,
              grossAmount: existingOrder.amount,
              paymentType: payment_type || "unknown",
              transactionStatus: transaction_status,
              fraudStatus: fraud_status || null,
              statusCode: status_code,
              statusMessage: payload.status_message || null,
              rawPayload: payload,
            })
            .onConflictDoUpdate({
              target: paymentTransaction.id,
              set: {
                transactionStatus: transaction_status,
                fraudStatus: fraud_status || null,
                statusCode: status_code,
                statusMessage: payload.status_message || null,
                rawPayload: payload,
              },
              where: sql`payment_transaction.transaction_status != 'settlement' OR ${transaction_status} IN ('settlement', 'refund', 'partial_refund')`,
            });
        }

        // Check if order status should be updated
        const canUpdate = shouldUpdateOrderStatus(existingOrder.status, finalStatus);
        if (canUpdate) {
          await tx
            .update(order)
            .set({
              status: finalStatus,
              paymentType: payment_type || existingOrder.paymentType,
              paidAt: isSuccess ? (existingOrder.paidAt || new Date()) : existingOrder.paidAt,
              updatedAt: new Date(),
            })
            .where(eq(order.id, order_id));
        }

        // Handle Full Refund: revoke subscription entitlement originating from this order
        // Partial refunds (transaction_status === 'partial_refund') do not revoke full entitlement
        if (finalStatus === "refund" && transaction_status === "refund") {
          await tx
            .update(subscription)
            .set({
              status: "refunded",
              updatedAt: new Date(),
            })
            .where(
              or(
                eq(subscription.orderId, existingOrder.id),
                sql`${subscription.metadata}->>'originOrderId' = ${existingOrder.id}`
              )
            );
        }

        // Activate or extend subscription idempotently using orderId foreign key and row locking
        if (
          isSuccess &&
          existingOrder.status !== "settlement" &&
          existingOrder.status !== "refund" &&
          existingOrder.status !== "partial_refund"
        ) {
          const now = new Date();
          const billingPeriod = (existingOrder.billingPeriod as BillingInterval) || "monthly";

          // Lock customer's existing active subscription to guarantee atomic extension without double-counting
          let existingActiveSub: typeof subscription.$inferSelect | undefined;

          if (existingOrder.organizationId) {
            const [foundOrgSub] = await tx
              .select()
              .from(subscription)
              .where(
                and(
                  eq(subscription.organizationId, existingOrder.organizationId),
                  eq(subscription.status, "active")
                )
              )
              .orderBy(desc(subscription.createdAt))
              .limit(1)
              .for("update");
            existingActiveSub = foundOrgSub;
          } else if (existingOrder.userId) {
            const [foundUserSub] = await tx
              .select()
              .from(subscription)
              .where(
                and(
                  eq(subscription.userId, existingOrder.userId),
                  isNull(subscription.organizationId),
                  eq(subscription.status, "active")
                )
              )
              .orderBy(desc(subscription.createdAt))
              .limit(1)
              .for("update");
            existingActiveSub = foundUserSub;
          }

          const hasActivePeriod = Boolean(existingActiveSub && isSubscriptionActive(existingActiveSub, now));

          if (existingActiveSub && hasActivePeriod && existingActiveSub.planId === existingOrder.planId) {
            // --- RENEWAL / EXTENSION ---
            // If matching active subscription exists, calculate next period starting from currentPeriodEnd
            const newPeriodEnd = calculatePeriodEnd(existingActiveSub.currentPeriodEnd, billingPeriod);
            const prevMetadata = (existingActiveSub.metadata as Record<string, unknown>) || {};
            const extensionOrderIds = Array.isArray(prevMetadata.extensionOrderIds)
              ? [...prevMetadata.extensionOrderIds, existingOrder.id]
              : [existingOrder.id];

            await tx
              .update(subscription)
              .set({
                currentPeriodEnd: newPeriodEnd,
                orderId: existingOrder.id,
                billingPeriod,
                updatedAt: now,
                metadata: {
                  ...prevMetadata,
                  extensionOrderIds,
                  lastExtensionAt: now.toISOString(),
                },
              })
              .where(eq(subscription.id, existingActiveSub.id));
          } else {
            // --- NEW ACTIVATION ---
            // If no active subscription (e.g. first purchase, or previous was expired/canceled/refunded)
            // Start from activation time
            const periodStart = existingOrder.paidAt || now;
            const periodEnd = calculatePeriodEnd(periodStart, billingPeriod);
            const subId = `sub_${existingOrder.id}`;

            const [subAlreadyExists] = await tx
              .select()
              .from(subscription)
              .where(or(eq(subscription.id, subId), eq(subscription.orderId, existingOrder.id)))
              .limit(1);

            if (!subAlreadyExists) {
              await tx
                .insert(subscription)
                .values({
                  id: subId,
                  orderId: existingOrder.id,
                  userId: existingOrder.userId,
                  organizationId: existingOrder.organizationId,
                  planId: existingOrder.planId,
                  status: "active",
                  billingPeriod,
                  currentPeriodStart: periodStart,
                  currentPeriodEnd: periodEnd,
                  cancelAtPeriodEnd: false,
                  metadata: {
                    originOrderId: existingOrder.id,
                  },
                })
                .onConflictDoNothing();
            }
          }
        }

        // Persist successful event processing state
        await tx
          .insert(webhookEvent)
          .values({
            id: eventId,
            gateway: "midtrans",
            orderId: order_id,
            signature: signature_key,
            payload,
            processed: true,
            processingError: null,
          })
          .onConflictDoUpdate({
            target: webhookEvent.id,
            set: {
              processed: true,
              processingError: null,
            },
          });

        return {
          success: true,
          orderId: order_id,
          status: finalStatus,
          duplicate: false,
        };
      });
    } catch (error) {
      // Transaction was rolled back!
      // In a separate persistence path outside the transaction, record failure audit record:
      try {
        await this.dbInstance
          .insert(webhookEvent)
          .values({
            id: eventId,
            gateway: "midtrans",
            orderId: order_id || null,
            signature: signature_key,
            payload,
            processed: false,
            processingError: error instanceof Error ? error.message : "Processing error",
          })
          .onConflictDoUpdate({
            target: webhookEvent.id,
            set: {
              processed: false,
              processingError: error instanceof Error ? error.message : "Processing error",
            },
          });
      } catch (auditErr) {
        console.error(
          "Failed to persist webhook error audit record:",
          auditErr instanceof Error ? auditErr.message : auditErr
        );
      }

      throw error;
    }
  }

  /**
   * Retrieves the current active subscription for a user or organization.
   * Strictly enforces that currentPeriodEnd <= now is expired and returns null,
   * even if the database status column still reads 'active'.
   */
  async getActiveSubscription(
    identifier: {
      userId?: string;
      organizationId?: string | null;
    },
    now = new Date()
  ): Promise<typeof subscription.$inferSelect | null> {
    let sub: typeof subscription.$inferSelect | undefined;

    if (identifier.organizationId) {
      const [orgSub] = await this.dbInstance
        .select()
        .from(subscription)
        .where(
          and(
            eq(subscription.organizationId, identifier.organizationId),
            eq(subscription.status, "active")
          )
        )
        .orderBy(desc(subscription.createdAt))
        .limit(1);

      sub = orgSub;
    } else if (identifier.userId) {
      const [userSub] = await this.dbInstance
        .select()
        .from(subscription)
        .where(
          and(
            eq(subscription.userId, identifier.userId),
            isNull(subscription.organizationId),
            eq(subscription.status, "active")
          )
        )
        .orderBy(desc(subscription.createdAt))
        .limit(1);

      sub = userSub;
    }

    if (!sub) return null;

    if (!isSubscriptionActive(sub, now)) {
      return null;
    }

    return sub;
  }

  /**
   * Centralized entitlement verification function.
   * Ensures unified access evaluation across all API routes and background tasks.
   */
  async checkEntitlement(
    identifier: {
      userId?: string;
      organizationId?: string | null;
    },
    now = new Date()
  ): Promise<{
    hasAccess: boolean;
    planId: string;
    subscription: typeof subscription.$inferSelect | null;
  }> {
    const sub = await this.getActiveSubscription(identifier, now);
    if (!sub) {
      return {
        hasAccess: false,
        planId: "free",
        subscription: null,
      };
    }

    return {
      hasAccess: true,
      planId: sub.planId,
      subscription: sub,
    };
  }

  /**
   * Scheduled job synchronization helper.
   * Idempotently updates active subscriptions whose currentPeriodEnd <= now to 'expired'.
   * Never modifies lifetime subscriptions and never activates or extends subscriptions.
   */
  async syncExpiredSubscriptions(now = new Date()): Promise<{
    updatedCount: number;
    expiredSubscriptionIds: string[];
  }> {
    const expiredRows = await this.dbInstance
      .update(subscription)
      .set({
        status: "expired",
        updatedAt: now,
      })
      .where(
        and(
          eq(subscription.status, "active"),
          ne(subscription.billingPeriod, "lifetime"),
          lte(subscription.currentPeriodEnd, now)
        )
      )
      .returning({ id: subscription.id });

    return {
      updatedCount: expiredRows.length,
      expiredSubscriptionIds: expiredRows.map((r) => r.id),
    };
  }
}

export const billingService = new BillingService();
