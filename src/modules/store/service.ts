import { and, asc, desc, eq, gte, inArray, or, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { creatorProfile, product, productAsset } from "@/server/db/schema/creator";
import {
  purchase,
  storeOrder,
  storeTransaction,
  storeWebhookEvent,
} from "@/server/db/schema/store";
import { midtrans } from "@/modules/billing/midtrans-client";
import {
  computeWebhookFingerprint,
  determinePaymentStatus,
  shouldUpdateOrderStatus,
  validateGrossAmount,
} from "@/modules/billing/service";
import type { MidtransNotificationPayload } from "@/modules/billing/types";
import { recordEvent } from "@/modules/analytics/service";
import { invalidateStorefront } from "@/lib/storefront-cache";
import {
  calculatePayout,
  downloadTokensMatch,
  generateDownloadToken,
  generateLicenseKey,
  generatePurchaseId,
  generateStoreOrderId,
} from "./delivery";
import {
  StoreNotFoundError,
  StoreValidationError,
  StoreWebhookError,
  type CreateStoreCheckoutInput,
  type PurchaseDelivery,
  type StoreCheckoutResponse,
} from "./types";

/**
 * Characters that make an email unusable as a delivery address are refused here rather
 * than at the mail provider, so a buyer cannot pay and then have nowhere to receive the
 * product. Intentionally permissive — the goal is a plausible address, not RFC 5322.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

export function normalizeBuyerEmail(input: unknown): string {
  if (typeof input !== "string") {
    throw new StoreValidationError("An email address is required.");
  }
  const email = input.trim().toLowerCase();
  if (email.length === 0 || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    throw new StoreValidationError("Enter a valid email address.");
  }
  return email;
}

export class StoreService {
  private dbInstance: typeof db;

  constructor(dbInstance?: typeof db) {
    this.dbInstance = dbInstance ?? db;
  }

  /**
   * Starts a storefront checkout for a paid product.
   *
   * The amount is read from the product row inside this method and never from the
   * request, so a client cannot name its own price. A product that is inactive, belongs
   * to an unpublished page, or is free is refused before the gateway is called.
   */
  async createCheckout(input: {
    username: string;
    productId: string;
    buyerEmail: unknown;
    buyerName?: string | null;
    buyerUserId?: string | null;
  }): Promise<StoreCheckoutResponse> {
    const buyerEmail = normalizeBuyerEmail(input.buyerEmail);

    const [row] = await this.dbInstance
      .select({ profile: creatorProfile, product })
      .from(product)
      .innerJoin(creatorProfile, eq(product.profileId, creatorProfile.id))
      .where(
        and(
          eq(product.id, input.productId),
          eq(creatorProfile.username, input.username.trim().toLowerCase()),
          eq(creatorProfile.isPublished, true),
          eq(product.isActive, true)
        )
      )
      .limit(1);

    if (!row) {
      throw new StoreNotFoundError("That product is not available.");
    }

    if (row.product.price <= 0) {
      throw new StoreValidationError(
        "This product is free. Use the free download instead of checkout.",
      );
    }

    const checkoutInput: CreateStoreCheckoutInput = {
      profileId: row.profile.id,
      productId: row.product.id,
      productTitle: row.product.title,
      amount: row.product.price,
      buyerEmail,
      buyerName: input.buyerName ?? null,
      buyerUserId: input.buyerUserId ?? null,
    };

    return this.createPaidOrder(checkoutInput);
  }

  private async createPaidOrder(input: CreateStoreCheckoutInput): Promise<StoreCheckoutResponse> {
    const orderId = generateStoreOrderId();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    // The buyer's library is the post-payment destination: it lists every entitlement
    // for the email or account used at checkout, so the page works whether or not the
    // buyer was signed in.
    const finishUrl = `${appUrl}/library?order_id=${encodeURIComponent(orderId)}`;

    const snap = await midtrans.createSnapTransaction({
      transaction_details: { order_id: orderId, gross_amount: input.amount },
      item_details: [
        {
          id: input.productId,
          name: input.productTitle.slice(0, 50),
          price: input.amount,
          quantity: 1,
        },
      ],
      customer_details: {
        first_name: input.buyerName?.trim() || "Customer",
        email: input.buyerEmail,
      },
      callbacks: { finish: finishUrl },
    });

    await this.dbInstance.insert(storeOrder).values({
      id: orderId,
      profileId: input.profileId,
      productId: input.productId,
      buyerUserId: input.buyerUserId ?? null,
      buyerEmail: input.buyerEmail,
      buyerName: input.buyerName ?? null,
      amount: input.amount,
      currency: "IDR",
      status: "pending",
      snapToken: snap.token,
      snapRedirectUrl: snap.redirect_url,
    });

    return {
      orderId,
      snapToken: snap.token,
      snapRedirectUrl: snap.redirect_url,
      amount: input.amount,
    };
  }

  /**
   * Grants a free product without a payment.
   *
   * A free product still gets an order row and a purchase row, so the creator's order
   * list and the buyer's library have one shape to read regardless of price. The order
   * is created already `settlement`, which is what makes it distinct from a paid order
   * that has not been paid yet.
   */
  async claimFreeProduct(input: {
    username: string;
    productId: string;
    buyerEmail: unknown;
    buyerUserId?: string | null;
  }): Promise<PurchaseDelivery> {
    const buyerEmail = normalizeBuyerEmail(input.buyerEmail);

    const [row] = await this.dbInstance
      .select({ profile: creatorProfile, product })
      .from(product)
      .innerJoin(creatorProfile, eq(product.profileId, creatorProfile.id))
      .where(
        and(
          eq(product.id, input.productId),
          eq(creatorProfile.username, input.username.trim().toLowerCase()),
          eq(creatorProfile.isPublished, true),
          eq(product.isActive, true)
        )
      )
      .limit(1);

    if (!row) {
      throw new StoreNotFoundError("That product is not available.");
    }
    if (row.product.price !== 0) {
      throw new StoreValidationError("This product is not free. Use checkout instead.");
    }

    const orderId = generateStoreOrderId();
    const now = new Date();

    const created = await this.dbInstance.transaction(async (tx) => {
      await tx.insert(storeOrder).values({
        id: orderId,
        profileId: row.profile.id,
        productId: row.product.id,
        buyerUserId: input.buyerUserId ?? null,
        buyerEmail,
        amount: 0,
        currency: "IDR",
        status: "settlement",
        paidAt: now,
      });

      const [existing] = await tx
        .select()
        .from(purchase)
        .where(
          and(
            eq(purchase.productId, row.product.id),
            eq(purchase.buyerEmail, buyerEmail),
            eq(purchase.status, "completed")
          )
        )
        .limit(1);

      // One free claim per buyer per product: re-claiming returns the existing
      // entitlement rather than minting another licence key on every page load.
      if (existing) return { purchaseRow: existing, isNew: false };

      const [purchaseRow] = await tx
        .insert(purchase)
        .values({
          id: generatePurchaseId(),
          orderId,
          productId: row.product.id,
          profileId: row.profile.id,
          buyerUserId: input.buyerUserId ?? null,
          buyerEmail,
          amount: 0,
          status: "completed",
          licenseKey:
            row.product.deliveryType === "code"
              ? generateLicenseKey(row.product.licensePrefix ?? undefined)
              : null,
          downloadToken: generateDownloadToken(),
          metadata: { source: "free_claim" },
        })
        .returning();

      await tx
        .update(product)
        .set({ salesCount: sql`${product.salesCount} + 1` })
        .where(eq(product.id, row.product.id));

      return { purchaseRow, isNew: true };
    });

    if (created.isNew) {
      await recordEvent({
        profileId: row.profile.id,
        eventType: "purchase",
        targetId: row.product.id,
        metadata: { amount: 0, source: "free_claim" },
      });
      // The storefront renders a "N sold" badge from this counter.
      invalidateStorefront(row.profile.username);
    }

    return this.buildDelivery(created.purchaseRow);
  }

  /**
   * Handles a Midtrans notification for a storefront order.
   *
   * Order of operations mirrors the subscription webhook, and for the same reasons:
   * verify the signature before touching state, make the event idempotent with a
   * deterministic fingerprint, lock the order row so two concurrent deliveries cannot
   * both fulfil it, and compare the amount against the stored order rather than the
   * payload.
   */
  async processWebhook(payload: MidtransNotificationPayload): Promise<{
    success: boolean;
    orderId: string;
    status: string;
    duplicate?: boolean;
    purchaseId?: string;
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
      throw new StoreWebhookError("Missing required fields in Midtrans notification payload");
    }

    const isValidSignature = midtrans.verifySignature(
      order_id,
      status_code,
      gross_amount,
      signature_key
    );

    const { eventId } = computeWebhookFingerprint({
      transaction_id,
      order_id,
      transaction_status,
      status_code,
      fraud_status,
      gross_amount,
    });

    if (!isValidSignature) {
      await this.auditFailure(eventId, order_id, signature_key, payload, "Invalid SHA-512 signature");
      throw new StoreWebhookError(`Invalid signature for order ${order_id}`);
    }

    try {
      const result = await this.dbInstance.transaction(async (tx) => {
        const [existingEvent] = await tx
          .select()
          .from(storeWebhookEvent)
          .where(eq(storeWebhookEvent.id, eventId))
          .limit(1);

        if (existingEvent?.processed) {
          return {
            success: true,
            orderId: order_id,
            status: transaction_status,
            duplicate: true,
          };
        }

        const [existingOrder] = await tx
          .select()
          .from(storeOrder)
          .where(eq(storeOrder.id, order_id))
          .for("update");

        if (!existingOrder) {
          throw new StoreWebhookError(`Order with ID ${order_id} not found in database.`);
        }

        const amountCheck = validateGrossAmount(gross_amount, existingOrder.amount);
        if (!amountCheck.valid) {
          throw new StoreWebhookError(
            amountCheck.error || `Gross amount mismatch for order ${order_id}`
          );
        }

        if (
          payload.currency &&
          payload.currency.trim().toUpperCase() !== existingOrder.currency.toUpperCase()
        ) {
          throw new StoreWebhookError(
            `Currency mismatch for order ${order_id}: expected ${existingOrder.currency}, received ${payload.currency}`
          );
        }

        const { isSuccess, finalStatus } = determinePaymentStatus(
          transaction_status,
          fraud_status
        );

        if (transaction_id) {
          await tx
            .insert(storeTransaction)
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
              target: storeTransaction.id,
              set: {
                transactionStatus: transaction_status,
                fraudStatus: fraud_status || null,
                statusCode: status_code,
                statusMessage: payload.status_message || null,
                rawPayload: payload,
              },
              where: sql`store_transaction.transaction_status != 'settlement' OR ${transaction_status} IN ('settlement', 'refund', 'partial_refund')`,
            });
        }

        const canUpdate = shouldUpdateOrderStatus(existingOrder.status, finalStatus);
        if (canUpdate) {
          await tx
            .update(storeOrder)
            .set({
              status: finalStatus,
              paymentType: payment_type || existingOrder.paymentType,
              paidAt: isSuccess ? existingOrder.paidAt || new Date() : existingOrder.paidAt,
              updatedAt: new Date(),
            })
            .where(eq(storeOrder.id, order_id));
        }

        let purchaseId: string | undefined;

        // Fulfil only on a fresh success. A replayed settlement is caught by the event
        // fingerprint above; this guards the case where the same order settles through a
        // different transaction id.
        if (
          isSuccess &&
          existingOrder.status !== "settlement" &&
          existingOrder.status !== "refund" &&
          existingOrder.status !== "partial_refund"
        ) {
          const [alreadyFulfilled] = await tx
            .select()
            .from(purchase)
            .where(eq(purchase.orderId, order_id))
            .limit(1);

          if (alreadyFulfilled) {
            purchaseId = alreadyFulfilled.id;
          } else {
            const [productRow] = await tx
              .select()
              .from(product)
              .where(eq(product.id, existingOrder.productId))
              .limit(1);

            const [created] = await tx
              .insert(purchase)
              .values({
                id: generatePurchaseId(),
                orderId: order_id,
                productId: existingOrder.productId,
                profileId: existingOrder.profileId,
                buyerUserId: existingOrder.buyerUserId,
                buyerEmail: existingOrder.buyerEmail,
                amount: existingOrder.amount,
                status: "completed",
                licenseKey:
                  productRow?.deliveryType === "code"
                    ? generateLicenseKey(productRow.licensePrefix ?? undefined)
                    : null,
                downloadToken: generateDownloadToken(),
                metadata: { source: "checkout", paymentType: payment_type || null },
              })
              .onConflictDoNothing({ target: purchase.orderId })
              .returning();

            if (created) {
              purchaseId = created.id;
              await tx
                .update(product)
                .set({ salesCount: sql`${product.salesCount} + 1` })
                .where(eq(product.id, existingOrder.productId));
            }
          }
        }

        // A confirmed full refund revokes the entitlement. A partial refund only records
        // the transaction above, matching the subscription flow's behaviour.
        if (finalStatus === "refund" && transaction_status === "refund") {
          const revoked = await tx
            .update(purchase)
            .set({ status: "refunded", refundedAt: new Date(), updatedAt: new Date() })
            .where(and(eq(purchase.orderId, order_id), eq(purchase.status, "completed")))
            .returning({ id: purchase.id, productId: purchase.productId });

          for (const row of revoked) {
            await tx
              .update(product)
              .set({ salesCount: sql`greatest(${product.salesCount} - 1, 0)` })
              .where(eq(product.id, row.productId));
          }
        }

        await tx
          .insert(storeWebhookEvent)
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
            target: storeWebhookEvent.id,
            set: { processed: true, processingError: null },
          });

        return {
          success: true,
          orderId: order_id,
          status: finalStatus,
          duplicate: false,
          purchaseId,
        };
      });

      // A settlement or refund moves the "N sold" badge on the public product page, so
      // the storefront cache is dropped once the transaction has committed. Only the
      // profile is needed, and a failure here must not fail an already-committed webhook.
      const [owner] = await this.dbInstance
        .select({ username: creatorProfile.username })
        .from(storeOrder)
        .innerJoin(creatorProfile, eq(storeOrder.profileId, creatorProfile.id))
        .where(eq(storeOrder.id, result.orderId))
        .limit(1);
      if (owner) invalidateStorefront(owner.username);

      return result;
    } catch (error) {
      await this.auditFailure(
        eventId,
        order_id,
        signature_key,
        payload,
        error instanceof Error ? error.message : "Processing error"
      );
      throw error;
    }
  }

  /**
   * Persists a webhook audit row outside the main transaction.
   *
   * A failure inside the transaction has already rolled back, so the audit has to be
   * written on its own connection. This must never throw: losing an audit row is bad,
   * but replacing the real error with an audit error is worse.
   */
  private async auditFailure(
    eventId: string,
    orderId: string | null,
    signature: string,
    payload: MidtransNotificationPayload,
    message: string
  ): Promise<void> {
    try {
      await this.dbInstance
        .insert(storeWebhookEvent)
        .values({
          id: eventId,
          gateway: "midtrans",
          orderId: orderId || null,
          signature,
          payload,
          processed: false,
          processingError: message,
        })
        .onConflictDoUpdate({
          target: storeWebhookEvent.id,
          set: { processed: false, processingError: message },
        });
    } catch (auditError) {
      console.error(
        "Failed to persist store webhook audit record:",
        auditError instanceof Error ? auditError.message : auditError,
      );
    }
  }

  /** Assembles the buyer-facing delivery payload for a purchase row. */
  async buildDelivery(purchaseRow: typeof purchase.$inferSelect): Promise<PurchaseDelivery> {
    const [productRow] = await this.dbInstance
      .select()
      .from(product)
      .where(eq(product.id, purchaseRow.productId))
      .limit(1);

    let files: PurchaseDelivery["files"] = [];
    if (productRow?.deliveryType === "file") {
      const assets = await this.dbInstance
        .select()
        .from(productAsset)
        .where(eq(productAsset.productId, purchaseRow.productId))
        .orderBy(asc(productAsset.position), asc(productAsset.createdAt));
      files = assets.map((asset) => ({
        fileName: asset.fileName,
        fileUrl: asset.fileUrl,
        fileSize: asset.fileSize,
      }));
    }

    return {
      purchaseId: purchaseRow.id,
      productTitle: productRow?.title ?? "Product",
      productType: productRow?.productType ?? "digital",
      deliveryType: productRow?.deliveryType ?? "file",
      amount: purchaseRow.amount,
      status: purchaseRow.status,
      licenseKey: purchaseRow.licenseKey,
      deliveryUrl: productRow?.deliveryType === "link" ? productRow.deliveryUrl : null,
      files,
      downloadToken: purchaseRow.downloadToken,
      downloadCount: purchaseRow.downloadCount,
      createdAt: purchaseRow.createdAt.toISOString(),
    };
  }

  /**
   * Resolves a purchase from its download token.
   *
   * The token is compared in constant time. A refunded purchase resolves to `null` so a
   * revoked entitlement stops delivering the moment it is refunded, without having to
   * invalidate every token that was already issued.
   */
  async getDeliveryByToken(token: unknown): Promise<PurchaseDelivery | null> {
    if (typeof token !== "string" || token.trim().length === 0) return null;
    const provided = token.trim();

    const [row] = await this.dbInstance
      .select()
      .from(purchase)
      .where(eq(purchase.downloadToken, provided))
      .limit(1);

    // The lookup above is by equality on an indexed column; the explicit comparison
    // documents the intent and keeps the check in one place if the lookup changes.
    if (!row || !downloadTokensMatch(provided, row.downloadToken)) return null;
    if (row.status !== "completed") return null;

    return this.buildDelivery(row);
  }

  /** Increments the download counter and returns the entitlement to serve. */
  async registerDownload(token: unknown): Promise<PurchaseDelivery | null> {
    const delivery = await this.getDeliveryByToken(token);
    if (!delivery) return null;

    const [updated] = await this.dbInstance
      .update(purchase)
      .set({
        downloadCount: sql`${purchase.downloadCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(purchase.id, delivery.purchaseId))
      .returning({ downloadCount: purchase.downloadCount });

    return { ...delivery, downloadCount: updated?.downloadCount ?? delivery.downloadCount };
  }

  /**
   * A buyer's library: everything bought with this account or this email.
   *
   * Matching on both is deliberate — a buyer who checks out as a guest and later
   * registers with the same address should see the purchase, and a signed-in buyer
   * should not lose access because they used a different address at checkout.
   */
  async listPurchasesForBuyer(identifier: {
    userId?: string | null;
    email?: string | null;
  }): Promise<PurchaseDelivery[]> {
    const conditions = [];
    if (identifier.userId) {
      conditions.push(eq(purchase.buyerUserId, identifier.userId));
    }
    if (identifier.email) {
      conditions.push(eq(purchase.buyerEmail, identifier.email.trim().toLowerCase()));
    }
    if (conditions.length === 0) return [];

    const rows = await this.dbInstance
      .select()
      .from(purchase)
      .where(or(...conditions))
      .orderBy(desc(purchase.createdAt))
      .limit(200);

    return Promise.all(rows.map((row) => this.buildDelivery(row)));
  }

  async getOrderStatus(orderId: string) {
    const [row] = await this.dbInstance
      .select()
      .from(storeOrder)
      .where(eq(storeOrder.id, orderId))
      .limit(1);
    return row ?? null;
  }

  /**
   * The entitlement for a paid order, addressed by the order id.
   *
   * The order id is itself the capability — it is created for one buyer, is unguessable,
   * and is what the buyer's browser already holds after checkout. Returning the delivery
   * here is what lets the checkout page show the product without asking the buyer to sign
   * in, and it exposes nothing beyond what that buyer just paid for.
   */
  async getDeliveryByOrderId(orderId: string): Promise<PurchaseDelivery | null> {
    const [row] = await this.dbInstance
      .select()
      .from(purchase)
      .where(and(eq(purchase.orderId, orderId), eq(purchase.status, "completed")))
      .limit(1);

    if (!row) return null;
    return this.buildDelivery(row);
  }

  /**
   * Creator revenue report for a window, split by product.
   *
   * Revenue comes from completed purchases and the fee from `calculatePayout`, the same
   * function the product page previews, so the number the creator was promised and the
   * number they are paid cannot drift.
   */
  async getCreatorSales(profileId: string, since?: Date) {
    const conditions = [
      eq(purchase.profileId, profileId),
      eq(purchase.status, "completed"),
    ];
    // `gte` rather than a raw template: a raw `sql` fragment binds the Date as a
    // parameter, and the driver cannot serialise a Date on a non-prepared statement.
    if (since) conditions.push(gte(purchase.createdAt, since));

    const [totals] = await this.dbInstance
      .select({
        sales: sql<number>`count(*)::int`,
        gross: sql<number>`coalesce(sum(${purchase.amount}), 0)::int`,
      })
      .from(purchase)
      .where(and(...conditions));

    const gross = totals?.gross ?? 0;
    const payout = calculatePayout(gross);

    const perProduct = await this.dbInstance
      .select({
        productId: product.id,
        title: product.title,
        sales: sql<number>`count(${purchase.id})::int`,
        gross: sql<number>`coalesce(sum(${purchase.amount}), 0)::int`,
      })
      .from(product)
      .leftJoin(
        purchase,
        and(eq(purchase.productId, product.id), eq(purchase.status, "completed"))
      )
      .where(eq(product.profileId, profileId))
      .groupBy(product.id, product.title)
      .orderBy(desc(sql`coalesce(sum(${purchase.amount}), 0)`));

    return {
      sales: totals?.sales ?? 0,
      gross,
      fee: payout.fee,
      net: payout.net,
      perProduct: perProduct.map((row) => ({
        productId: row.productId,
        title: row.title,
        sales: row.sales ?? 0,
        gross: row.gross ?? 0,
        net: calculatePayout(row.gross ?? 0).net,
      })),
    };
  }

  /** Products a buyer already owns, used to mark "Owned" on the storefront. */
  async listOwnedProductIds(identifier: {
    userId?: string | null;
    email?: string | null;
  }): Promise<string[]> {
    const conditions = [];
    if (identifier.userId) conditions.push(eq(purchase.buyerUserId, identifier.userId));
    if (identifier.email) {
      conditions.push(eq(purchase.buyerEmail, identifier.email.trim().toLowerCase()));
    }
    if (conditions.length === 0) return [];

    const rows = await this.dbInstance
      .select({ productId: purchase.productId })
      .from(purchase)
      .where(and(eq(purchase.status, "completed"), or(...conditions)));

    return [...new Set(rows.map((row) => row.productId))];
  }

  /** Used by the admin-facing order detail to resolve several orders at once. */
  async listOrdersByIds(orderIds: string[]) {
    if (orderIds.length === 0) return [];
    return this.dbInstance.select().from(storeOrder).where(inArray(storeOrder.id, orderIds));
  }
}

export const storeService = new StoreService();
