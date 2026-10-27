import "../test-env.ts";
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, or } from "drizzle-orm";
import * as schema from "../../src/server/db/schema/index.ts";
import { order, subscription, paymentTransaction, webhookEvent } from "../../src/server/db/schema/billing.ts";
import { user } from "../../src/server/db/schema/auth.ts";
import { organization } from "../../src/server/db/schema/organizations.ts";
import { BillingService } from "../../src/modules/billing/service.ts";
import { calculatePeriodEnd } from "../../src/modules/billing/date-utils.ts";
import crypto from "crypto";
import { migrateUnderLock } from "./migrate-safely.ts";

// Dedicated integration test connection string — strictly requires INTEGRATION_TEST_DATABASE_URL
const integrationDbUrl = process.env.INTEGRATION_TEST_DATABASE_URL || "";

// How many scenarios this file must execute. `pnpm test:integration` exits 0 even when
// every scenario skips, so a missing database used to look green. Assert the executed
// count at the end so a skipped run fails loudly instead.
const REQUIRED_SCENARIO_COUNT = 11;
const EXPECT_INTEGRATION_DB = process.env.EXPECT_INTEGRATION_DB === "true";

/**
 * Positive verification of disposable test database identity.
 * Fails closed on any ambiguous, remote, or production-like target.
 */
function verifyDisposableDatabase(urlStr: string): { isDisposable: boolean; reason: string } {
  if (!urlStr) {
    return { isDisposable: false, reason: "No database URL provided in INTEGRATION_TEST_DATABASE_URL." };
  }

  try {
    const parsed = new URL(urlStr);
    const dbName = parsed.pathname.replace(/^\//, "").toLowerCase();
    const hostname = parsed.hostname.toLowerCase();

    // Reject dangerous/production/staging names immediately
    const forbiddenPatterns = ["prod", "production", "main", "staging", "stage", "live", "master"];
    for (const pat of forbiddenPatterns) {
      if (
        dbName === pat ||
        dbName.startsWith(`${pat}_`) ||
        dbName.endsWith(`_${pat}`) ||
        dbName.includes(`${pat}-`)
      ) {
        return { isDisposable: false, reason: `Database name '${dbName}' matches forbidden environment pattern '${pat}'.` };
      }
    }

    // Require database name to explicitly indicate disposable/test status
    const hasDisposableName =
      dbName.includes("test") ||
      dbName.includes("disposable") ||
      dbName.includes("scratch");

    if (!hasDisposableName) {
      return {
        isDisposable: false,
        reason: `Target database '${dbName}' fails closed: name must explicitly contain 'test', 'disposable', or 'scratch'.`,
      };
    }

    // Verify host is local, containerized, or loopback unless explicit remote test flag is set
    const isLocalOrContainer =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "postgres" ||
      hostname === "host.docker.internal";

    if (!isLocalOrContainer && process.env.ALLOW_REMOTE_DISPOSABLE_DB !== "true") {
      return {
        isDisposable: false,
        reason: `Target host '${hostname}' is not a local/container address. To use a remote test database, set ALLOW_REMOTE_DISPOSABLE_DB=true.`,
      };
    }

    return { isDisposable: true, reason: `Verified disposable test database '${dbName}' on host '${hostname}'.` };
  } catch (err) {
    return { isDisposable: false, reason: `Invalid database URL: ${err instanceof Error ? err.message : String(err)}` };
  }
}

describe("PostgreSQL Webhook Integration & Concurrency Verification (Phase 2.3.2)", () => {
  let isAvailable = false;
  let adminSql: postgres.Sql | null = null;
  let sharedDb: ReturnType<typeof drizzle<typeof schema>> | null = null;
  let executedScenarioCount = 0;

  // Skip only when the database is genuinely optional. With EXPECT_INTEGRATION_DB=true
  // (or CI) a missing database is a failure, not a silent skip.
  function requireDatabase(t: { skip: (reason: string) => void }): boolean {
    if (isAvailable && sharedDb && integrationDbUrl) return true;
    if (process.env.CI === "true" || EXPECT_INTEGRATION_DB) {
      throw new Error(
        "PostgreSQL not available, but this run requires it (CI or EXPECT_INTEGRATION_DB=true)."
      );
    }
    t.skip("PostgreSQL test database not available");
    return false;
  }
  const testServerKey = "SB-Mid-server-test-integration-key-32chars";

  // Track created entities for safe test-owned teardown
  const testUserIds: string[] = [];
  const testOrgIds: string[] = [];
  const testOrderIds: string[] = [];
  const testSubIds: string[] = [];
  const testEventIds: string[] = [];

  before(async () => {
    const safety = verifyDisposableDatabase(integrationDbUrl);
    if (!safety.isDisposable) {
      if (process.env.CI === "true") {
        throw new Error(`[CI FAILURE] Disposable database safety check failed in CI: ${safety.reason}`);
      }
      console.log(`\n[PREREQUISITE SKIPPED] Real PostgreSQL Integration Tests Skipped: ${safety.reason}`);
      console.log("To run real integration tests, set INTEGRATION_TEST_DATABASE_URL to a disposable PostgreSQL database.");
      return;
    }

    try {
      // Connect with retries to ensure container/host socket readiness
      let lastErr: unknown = null;
      for (let attempt = 1; attempt <= 10; attempt++) {
        try {
          adminSql = postgres(integrationDbUrl, {
            max: 5,
            connect_timeout: 10,
            idle_timeout: 10,
            prepare: false,
          });
          await adminSql`SELECT 1 as connected`;
          lastErr = null;
          break;
        } catch (err) {
          lastErr = err;
          if (adminSql) {
            await adminSql.end({ timeout: 1 }).catch(() => {});
            adminSql = null;
          }
          if (attempt < 10) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
      }

      if (lastErr || !adminSql) {
        throw lastErr || new Error("Failed to connect to PostgreSQL after 10 attempts");
      }

      sharedDb = drizzle(adminSql, { schema });

      // Apply migrations safely to the verified disposable database. Serialized against
      // the sibling integration file, which migrates the same database concurrently.
      await migrateUnderLock(sharedDb, integrationDbUrl);

      isAvailable = true;
    } catch (connErr) {
      if (process.env.CI === "true") {
        throw new Error(
          `[CI FAILURE] PostgreSQL integration setup failed in CI: ${connErr instanceof Error ? connErr.message : String(connErr)}`
        );
      }
      console.log(`\n[PREREQUISITE SKIPPED] Cannot connect to PostgreSQL at ${integrationDbUrl}: ${connErr instanceof Error ? connErr.message : String(connErr)}`);
      isAvailable = false;
      if (adminSql) {
        await adminSql.end({ timeout: 1 }).catch(() => {});
        adminSql = null;
      }
    }
  });

  after(async () => {
    // Fail if not all required integration scenarios were executed and passed. This runs
    // in CI and in any local run that opted in with EXPECT_INTEGRATION_DB=true, so a
    // silently-skipped suite (exit 0, "skipped N") fails loudly instead of looking green.
    if ((process.env.CI === "true" || EXPECT_INTEGRATION_DB) && executedScenarioCount < REQUIRED_SCENARIO_COUNT) {
      throw new Error(
        `[CI FAILURE] Incomplete integration run: expected ${REQUIRED_SCENARIO_COUNT} scenarios to execute and pass, but only ${executedScenarioCount} completed.`
      );
    }

    if (!isAvailable || !sharedDb || !adminSql) return;

    // Clean up only test-owned records
    try {
      if (testEventIds.length > 0) {
        await sharedDb.delete(webhookEvent).where(or(...testEventIds.map((id) => eq(webhookEvent.id, id))));
      }
      if (testSubIds.length > 0) {
        await sharedDb.delete(subscription).where(or(...testSubIds.map((id) => eq(subscription.id, id))));
      }
      if (testOrderIds.length > 0) {
        await sharedDb.delete(paymentTransaction).where(or(...testOrderIds.map((id) => eq(paymentTransaction.orderId, id))));
        await sharedDb.delete(order).where(or(...testOrderIds.map((id) => eq(order.id, id))));
      }
      if (testOrgIds.length > 0) {
        await sharedDb.delete(organization).where(or(...testOrgIds.map((id) => eq(organization.id, id))));
      }
      if (testUserIds.length > 0) {
        await sharedDb.delete(user).where(or(...testUserIds.map((id) => eq(user.id, id))));
      }
    } catch (cleanupErr) {
      console.error("Test cleanup error:", cleanupErr);
    } finally {
      await adminSql.end({ timeout: 2 }).catch(() => {});
    }
  });

  function createSignedPayload(params: {
    orderId: string;
    grossAmount: number;
    // Exact string to sign and send. Defaults to "<amount>.00". Midtrans signs the
    // precise gross_amount string it delivers, so any alternate representation must
    // carry its own signature.
    grossAmountRaw?: string;
    statusCode?: string;
    transactionStatus?: string;
    fraudStatus?: string;
    transactionId?: string;
  }) {
    const statusCode = params.statusCode || "200";
    const grossAmountStr = params.grossAmountRaw ?? `${params.grossAmount}.00`;
    const raw = `${params.orderId}${statusCode}${grossAmountStr}${testServerKey}`;
    const signature = crypto.createHash("sha512").update(raw).digest("hex");

    return {
      order_id: params.orderId,
      status_code: statusCode,
      gross_amount: grossAmountStr,
      signature_key: signature,
      transaction_id: params.transactionId || `trx_${params.orderId}`,
      transaction_status: params.transactionStatus || "settlement",
      fraud_status: params.fraudStatus || "accept",
      payment_type: "credit_card",
      transaction_time: new Date().toISOString(),
    };
  }

  async function seedTestOrder(
    orderId: string,
    amount = 149000,
    initialStatus = "pending",
    customUserId?: string,
    customPlanId = "starter",
    customPeriod = "monthly"
  ) {
    if (!sharedDb) throw new Error("Database not connected");

    const userId = customUserId || `usr_${orderId}`;
    if (!customUserId) {
      testUserIds.push(userId);
      await sharedDb.insert(user).values({
        id: userId,
        name: "Integration Test User",
        email: `${userId}@example.com`,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    testOrderIds.push(orderId);

    await sharedDb.insert(order).values({
      id: orderId,
      userId,
      organizationId: null,
      itemType: "subscription",
      planId: customPlanId,
      billingPeriod: customPeriod,
      amount,
      currency: "IDR",
      status: initialStatus,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return { userId, orderId };
  }

  // --- SCENARIO A: Webhook Idempotency ---
  it("Scenario A: Repeated settlement delivery is idempotent and creates exactly one subscription", async (t) => {
    if (!requireDatabase(t)) return;
    assert.ok(sharedDb);

    const orderId = `ord_test_idemp_${Date.now()}`;
    await seedTestOrder(orderId, 149000);
    const service = new BillingService(sharedDb);
    const payload = createSignedPayload({ orderId, grossAmount: 149000 });

    // 1st delivery
    const res1 = await service.processWebhookNotification(payload);
    assert.equal(res1.success, true);
    assert.equal(res1.duplicate, false);

    // 2nd delivery (identical payload)
    const res2 = await service.processWebhookNotification(payload);
    assert.equal(res2.success, true);
    assert.equal(res2.duplicate, true);

    // 3rd delivery: same event, alternate amount format ("149000" instead of "149000.00").
    // The signature must cover the exact string sent; reusing the previous signature
    // would be an invalid, tampered pair and the product would rightly reject it.
    const payloadCanonical = createSignedPayload({
      orderId,
      grossAmount: 149000,
      grossAmountRaw: "149000",
    });
    const res3 = await service.processWebhookNotification(payloadCanonical);
    assert.equal(res3.success, true);
    assert.equal(res3.duplicate, true);

    // Verify database state: exactly 1 subscription, 1 settled order
    const subscriptions = await sharedDb.select().from(subscription).where(eq(subscription.orderId, orderId));
    assert.equal(subscriptions.length, 1);
    assert.equal(subscriptions[0].orderId, orderId);
    assert.equal(subscriptions[0].status, "active");
    testSubIds.push(subscriptions[0].id);

    const [persistedOrder] = await sharedDb.select().from(order).where(eq(order.id, orderId));
    assert.equal(persistedOrder.status, "settlement");
    assert.ok(persistedOrder.paidAt);

    executedScenarioCount++;
  });

  // --- SCENARIO B: Concurrent Duplicate Delivery ---
  it("Scenario B: Concurrent duplicate delivery via separate connections creates at most one subscription", async (t) => {
    if (!requireDatabase(t)) return;
    assert.ok(sharedDb);

    const orderId = `ord_test_concurr_${Date.now()}`;
    await seedTestOrder(orderId, 149000);

    // Create 3 separate physical database connections
    const sqlClients = [
      postgres(integrationDbUrl, { max: 1, prepare: false }),
      postgres(integrationDbUrl, { max: 1, prepare: false }),
      postgres(integrationDbUrl, { max: 1, prepare: false }),
    ];

    try {
      // Verify all 3 clients represent genuinely distinct PostgreSQL backend sessions
      const pids = await Promise.all(
        sqlClients.map(async (client) => {
          const [row] = await client<{ pid: number }[]>`SELECT pg_backend_pid() as pid`;
          return row.pid;
        })
      );
      assert.equal(new Set(pids).size, 3, "Concurrent clients must have distinct PostgreSQL backend PIDs");

      const services = sqlClients.map((client) => new BillingService(drizzle(client, { schema })));
      const payload = createSignedPayload({ orderId, grossAmount: 149000 });

      // Execute all 3 deliveries concurrently
      const results = await Promise.all(services.map((svc) => svc.processWebhookNotification(payload)));

      // Assert all reported success
      assert.equal(results.every((r) => r.success), true);

      // Verify that exactly 1 logical subscription exists in PostgreSQL
      const subs = await sharedDb.select().from(subscription).where(eq(subscription.orderId, orderId));
      assert.equal(subs.length, 1);
      assert.equal(subs[0].orderId, orderId);
      testSubIds.push(subs[0].id);

      // Verify order status
      const [persistedOrder] = await sharedDb.select().from(order).where(eq(order.id, orderId));
      assert.equal(persistedOrder.status, "settlement");

      executedScenarioCount++;
    } finally {
      await Promise.all(sqlClients.map((c) => c.end({ timeout: 1 }).catch(() => {})));
    }
  });

  // --- SCENARIO C: Concurrent Competing Settlement & Out-of-order Events ---
  it("Scenario C: Delayed expire/deny notifications cannot regress settled order in database", async (t) => {
    if (!requireDatabase(t)) return;
    assert.ok(sharedDb);

    const orderId = `ord_test_compete_${Date.now()}`;
    await seedTestOrder(orderId, 149000);

    const client1 = postgres(integrationDbUrl, { max: 1, prepare: false });
    const client2 = postgres(integrationDbUrl, { max: 1, prepare: false });

    try {
      const svc1 = new BillingService(drizzle(client1, { schema }));
      const svc2 = new BillingService(drizzle(client2, { schema }));

      // Svc1 processes settlement
      const settlementPayload = createSignedPayload({
        orderId,
        grossAmount: 149000,
        transactionStatus: "settlement",
        statusCode: "200",
      });
      await svc1.processWebhookNotification(settlementPayload);

      // Svc2 attempts to process a stale delayed expire event
      const expirePayload = createSignedPayload({
        orderId,
        grossAmount: 149000,
        transactionStatus: "expire",
        statusCode: "202",
        transactionId: `trx_expire_${orderId}`,
      });
      await svc2.processWebhookNotification(expirePayload);

      // Assert order status in PostgreSQL is STILL settlement
      const [persistedOrder] = await sharedDb.select().from(order).where(eq(order.id, orderId));
      assert.equal(persistedOrder.status, "settlement");

      // Verify paymentTransaction table did not regress
      const trxs = await sharedDb.select().from(paymentTransaction).where(eq(paymentTransaction.orderId, orderId));
      const settlementTrx = trxs.find((t) => t.transactionStatus === "settlement");
      assert.ok(settlementTrx, "Settlement transaction record must remain intact");

      // Next: verify legitimate refund event transitions order to refund
      const refundPayload = createSignedPayload({
        orderId,
        grossAmount: 149000,
        transactionStatus: "refund",
        statusCode: "200",
        transactionId: `trx_refund_${orderId}`,
      });
      await svc1.processWebhookNotification(refundPayload);

      const [refundedOrder] = await sharedDb.select().from(order).where(eq(order.id, orderId));
      assert.equal(refundedOrder.status, "refund");

      executedScenarioCount++;
    } finally {
      await Promise.all([client1.end({ timeout: 1 }), client2.end({ timeout: 1 })]);
    }
  });

  // --- SCENARIO D: Transaction Atomicity & Failure Audit Decoupling ---
  it("Scenario D: Processing failure rolls back business changes and persists failure audit independently", async (t) => {
    if (!requireDatabase(t)) return;
    assert.ok(sharedDb);

    const orderId = `ord_test_atomic_${Date.now()}`;
    await seedTestOrder(orderId, 149000);
    const service = new BillingService(sharedDb);

    // Send payload with gross_amount mismatch (e.g. 999999 instead of 149000)
    const invalidAmountPayload = createSignedPayload({
      orderId,
      grossAmount: 999999, // Mismatch with order amount 149000
    });

    await assert.rejects(
      async () => {
        await service.processWebhookNotification(invalidAmountPayload);
      },
      /Gross amount mismatch/
    );

    // 1. Confirm business changes rolled back: order is STILL pending
    const [persistedOrder] = await sharedDb.select().from(order).where(eq(order.id, orderId));
    assert.equal(persistedOrder.status, "pending");
    assert.equal(persistedOrder.paidAt, null);

    // 2. Confirm no subscription was created
    const subs = await sharedDb.select().from(subscription).where(eq(subscription.orderId, orderId));
    assert.equal(subs.length, 0);

    // 3. Confirm failure audit was persisted independently in webhook_event
    const events = await sharedDb.select().from(webhookEvent).where(eq(webhookEvent.orderId, orderId));
    assert.ok(events.length > 0, "Failure audit event must be recorded");
    const failedEvent = events[0];
    assert.equal(failedEvent.processed, false);
    assert.match(failedEvent.processingError || "", /Gross amount mismatch/);
    testEventIds.push(failedEvent.id);

    executedScenarioCount++;
  });

  // --- SCENARIO E: Distinct Orders Concurrency ---
  it("Scenario E: Concurrent settlements for distinct orders maintain correct isolation and 1:1 mapping", async (t) => {
    if (!requireDatabase(t)) return;
    assert.ok(sharedDb);

    const orderId1 = `ord_test_dist1_${Date.now()}`;
    const orderId2 = `ord_test_dist2_${Date.now()}`;
    await seedTestOrder(orderId1, 149000);
    await seedTestOrder(orderId2, 299000);

    const client1 = postgres(integrationDbUrl, { max: 1, prepare: false });
    const client2 = postgres(integrationDbUrl, { max: 1, prepare: false });

    try {
      // Verify both clients represent genuinely distinct PostgreSQL backend sessions
      const [pid1Res, pid2Res] = await Promise.all([
        client1<{ pid: number }[]>`SELECT pg_backend_pid() as pid`,
        client2<{ pid: number }[]>`SELECT pg_backend_pid() as pid`,
      ]);
      assert.notEqual(pid1Res[0].pid, pid2Res[0].pid, "Distinct order settlement clients must have distinct PostgreSQL backend PIDs");

      const svc1 = new BillingService(drizzle(client1, { schema }));
      const svc2 = new BillingService(drizzle(client2, { schema }));

      const p1 = createSignedPayload({ orderId: orderId1, grossAmount: 149000 });
      const p2 = createSignedPayload({ orderId: orderId2, grossAmount: 299000 });

      // Run distinct settlements concurrently
      const [r1, r2] = await Promise.all([svc1.processWebhookNotification(p1), svc2.processWebhookNotification(p2)]);

      assert.equal(r1.success, true);
      assert.equal(r2.success, true);

      // Verify each subscription has the correct distinct orderId
      const [sub1] = await sharedDb.select().from(subscription).where(eq(subscription.orderId, orderId1));
      const [sub2] = await sharedDb.select().from(subscription).where(eq(subscription.orderId, orderId2));

      assert.ok(sub1, "Sub 1 must exist");
      assert.ok(sub2, "Sub 2 must exist");
      assert.notEqual(sub1.id, sub2.id);
      assert.equal(sub1.orderId, orderId1);
      assert.equal(sub2.orderId, orderId2);
      testSubIds.push(sub1.id, sub2.id);

      executedScenarioCount++;
    } finally {
      await Promise.all([client1.end({ timeout: 1 }), client2.end({ timeout: 1 })]);
    }
  });

  // --- SCENARIO F: Database Constraints and Deletion Behavior ---
  it("Scenario F: Nullable order_id foreign key preserves subscription on order deletion (SET NULL)", async (t) => {
    if (!requireDatabase(t)) return;
    assert.ok(sharedDb);

    const orderId = `ord_test_del_${Date.now()}`;
    await seedTestOrder(orderId, 149000);
    const service = new BillingService(sharedDb);
    const payload = createSignedPayload({ orderId, grossAmount: 149000 });

    await service.processWebhookNotification(payload);

    const [sub] = await sharedDb.select().from(subscription).where(eq(subscription.orderId, orderId));
    assert.ok(sub);
    testSubIds.push(sub.id);

    // Delete the order fixture; FK constraint is ON DELETE SET NULL
    await sharedDb.delete(order).where(eq(order.id, orderId));

    // Subscription must still exist with orderId set to null
    const [preservedSub] = await sharedDb.select().from(subscription).where(eq(subscription.id, sub.id));
    assert.ok(preservedSub, "Subscription must not be cascaded/deleted");
    assert.equal(preservedSub.orderId, null, "orderId must be set to null per ON DELETE SET NULL");

    executedScenarioCount++;
  });

  // --- SCENARIO G: Confirmed Full Refund Revocation & Late Settlement Guard ---
  it("Scenario G: Confirmed full refund revokes subscription and prevents late reactivation", async (t) => {
    if (!requireDatabase(t)) return;
    assert.ok(sharedDb);

    const orderId = `ord_test_ref_full_${Date.now()}`;
    const { userId } = await seedTestOrder(orderId, 149000);
    const service = new BillingService(sharedDb);
    const settlePayload = createSignedPayload({ orderId, grossAmount: 149000 });

    // 1. Initial settlement activates subscription
    await service.processWebhookNotification(settlePayload);
    const [activeSub] = await sharedDb.select().from(subscription).where(eq(subscription.orderId, orderId));
    assert.ok(activeSub);
    assert.equal(activeSub.status, "active");
    testSubIds.push(activeSub.id);

    const entitlementBefore = await service.checkEntitlement({ userId });
    assert.equal(entitlementBefore.hasAccess, true);

    // 2. Confirmed full refund arrives
    const refundPayload = createSignedPayload({
      orderId,
      grossAmount: 149000,
      transactionStatus: "refund",
      statusCode: "200",
      transactionId: `trx_refund_${orderId}`,
    });
    await service.processWebhookNotification(refundPayload);

    // Verify order is refund and subscription is refunded
    const [refundedOrder] = await sharedDb.select().from(order).where(eq(order.id, orderId));
    assert.equal(refundedOrder.status, "refund");

    const [revokedSub] = await sharedDb.select().from(subscription).where(eq(subscription.id, activeSub.id));
    assert.equal(revokedSub.status, "refunded");

    const entitlementAfter = await service.checkEntitlement({ userId });
    assert.equal(entitlementAfter.hasAccess, false);

    // 3. Late/stale settlement webhook arrives for the refunded order
    const lateSettlePayload = createSignedPayload({
      orderId,
      grossAmount: 149000,
      transactionStatus: "settlement",
      statusCode: "200",
      transactionId: `trx_late_${orderId}`,
    });
    const lateRes = await service.processWebhookNotification(lateSettlePayload);
    assert.equal(lateRes.success, true);
    // Distinct transaction_id and status make this a new event, not an idempotent
    // replay. It is accepted then ignored; the refunded order must not reactivate.
    assert.equal(lateRes.duplicate, false);

    // Confirm order remains refund and subscription remains refunded
    const [stillRefundedOrder] = await sharedDb.select().from(order).where(eq(order.id, orderId));
    assert.equal(stillRefundedOrder.status, "refund");

    const [stillRevokedSub] = await sharedDb.select().from(subscription).where(eq(subscription.id, activeSub.id));
    assert.equal(stillRevokedSub.status, "refunded");

    const entitlementFinal = await service.checkEntitlement({ userId });
    assert.equal(entitlementFinal.hasAccess, false);

    executedScenarioCount++;
  });

  // --- SCENARIO H: Partial Refund Safe Handling ---
  it("Scenario H: Partial refund records transaction audit without revoking subscription entitlement", async (t) => {
    if (!requireDatabase(t)) return;
    assert.ok(sharedDb);

    const orderId = `ord_test_ref_part_${Date.now()}`;
    const { userId } = await seedTestOrder(orderId, 149000);
    const service = new BillingService(sharedDb);
    const settlePayload = createSignedPayload({ orderId, grossAmount: 149000 });

    await service.processWebhookNotification(settlePayload);
    const [sub] = await sharedDb.select().from(subscription).where(eq(subscription.orderId, orderId));
    assert.ok(sub);
    assert.equal(sub.status, "active");
    testSubIds.push(sub.id);

    // Send partial_refund webhook
    const partialRefundPayload = createSignedPayload({
      orderId,
      grossAmount: 149000,
      transactionStatus: "partial_refund",
      statusCode: "200",
      transactionId: `trx_partial_ref_${orderId}`,
    });
    await service.processWebhookNotification(partialRefundPayload);

    // Subscription entitlement must NOT be revoked
    const [retainedSub] = await sharedDb.select().from(subscription).where(eq(subscription.id, sub.id));
    assert.equal(retainedSub.status, "active");

    const entitlement = await service.checkEntitlement({ userId });
    assert.equal(entitlement.hasAccess, true);

    // Confirm both transactions are persisted in audit log
    const txRecords = await sharedDb.select().from(paymentTransaction).where(eq(paymentTransaction.orderId, orderId));
    assert.ok(txRecords.some((r) => r.transactionStatus === "settlement"));
    assert.ok(txRecords.some((r) => r.transactionStatus === "partial_refund"));

    executedScenarioCount++;
  });

  // --- SCENARIO I: Plan Renewal Extends Period End ---
  it("Scenario I: Renewal of active subscription extends currentPeriodEnd from existing period end", async (t) => {
    if (!requireDatabase(t)) return;
    assert.ok(sharedDb);

    const orderId1 = `ord_test_renew_1_${Date.now()}`;
    const { userId } = await seedTestOrder(orderId1, 149000, "pending", undefined, "starter", "monthly");
    const service = new BillingService(sharedDb);

    // 1st order settled -> creates initial subscription
    const payload1 = createSignedPayload({ orderId: orderId1, grossAmount: 149000 });
    await service.processWebhookNotification(payload1);

    const [sub1] = await sharedDb.select().from(subscription).where(eq(subscription.userId, userId));
    assert.ok(sub1);
    assert.ok(sub1.currentPeriodEnd);
    testSubIds.push(sub1.id);
    const initialPeriodEnd = new Date(sub1.currentPeriodEnd);

    // Expected extended period end
    const expectedExtendedEnd = calculatePeriodEnd(initialPeriodEnd, "monthly");

    // 2nd order (renewal) for same user and plan
    const orderId2 = `ord_test_renew_2_${Date.now()}`;
    await seedTestOrder(orderId2, 149000, "pending", userId, "starter", "monthly");
    const payload2 = createSignedPayload({ orderId: orderId2, grossAmount: 149000 });
    await service.processWebhookNotification(payload2);

    // Verify still exactly 1 subscription for this user
    const userSubs = await sharedDb.select().from(subscription).where(eq(subscription.userId, userId));
    assert.equal(userSubs.length, 1);
    const renewedSub = userSubs[0];
    assert.equal(renewedSub.status, "active");
    assert.equal(new Date(renewedSub.currentPeriodEnd!).toISOString(), expectedExtendedEnd.toISOString());

    // Verify extension metadata
    const metadata = renewedSub.metadata as Record<string, unknown>;
    assert.ok(Array.isArray(metadata?.extensionOrderIds));
    assert.ok((metadata.extensionOrderIds as string[]).includes(orderId2));

    executedScenarioCount++;
  });

  // --- SCENARIO J: Expiration Sync Utility ---
  it("Scenario J: syncExpiredSubscriptions expires past subscriptions while preserving lifetime access", async (t) => {
    if (!requireDatabase(t)) return;
    assert.ok(sharedDb);

    const service = new BillingService(sharedDb);
    const now = new Date();
    const pastDate = new Date(now.getTime() - 7 * 86400000); // 7 days ago
    const futureDate = new Date(now.getTime() + 14 * 86400000); // 14 days future

    const userA = `usr_test_exp_past_${Date.now()}`;
    const userB = `usr_test_exp_fut_${Date.now()}`;
    const userC = `usr_test_exp_life_${Date.now()}`;
    testUserIds.push(userA, userB, userC);

    for (const u of [userA, userB, userC]) {
      await sharedDb.insert(user).values({
        id: u,
        name: "Sync Test User",
        email: `${u}@example.com`,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    const subAId = `sub_past_${Date.now()}`;
    const subBId = `sub_fut_${Date.now()}`;
    const subCId = `sub_life_${Date.now()}`;
    testSubIds.push(subAId, subBId, subCId);

    // User A: past monthly subscription, currently 'active' in DB
    await sharedDb.insert(subscription).values({
      id: subAId,
      orderId: null,
      userId: userA,
      organizationId: null,
      planId: "starter",
      billingPeriod: "monthly",
      status: "active",
      currentPeriodStart: new Date(pastDate.getTime() - 30 * 86400000),
      currentPeriodEnd: pastDate,
      cancelAtPeriodEnd: false,
      metadata: {},
      createdAt: now,
      updatedAt: now,
    });

    // User B: future monthly subscription, 'active' in DB
    await sharedDb.insert(subscription).values({
      id: subBId,
      orderId: null,
      userId: userB,
      organizationId: null,
      planId: "starter",
      billingPeriod: "monthly",
      status: "active",
      currentPeriodStart: now,
      currentPeriodEnd: futureDate,
      cancelAtPeriodEnd: false,
      metadata: {},
      createdAt: now,
      updatedAt: now,
    });

    // User C: lifetime subscription, 'active' in DB
    await sharedDb.insert(subscription).values({
      id: subCId,
      orderId: null,
      userId: userC,
      organizationId: null,
      planId: "lifetime-deal",
      billingPeriod: "lifetime",
      status: "active",
      currentPeriodStart: pastDate,
      currentPeriodEnd: pastDate,
      cancelAtPeriodEnd: false,
      metadata: {},
      createdAt: now,
      updatedAt: now,
    });

    // Run expiration sync
    const syncRes = await service.syncExpiredSubscriptions(now);
    assert.ok(syncRes.updatedCount >= 1);
    assert.ok(syncRes.expiredSubscriptionIds.includes(subAId));

    // Verify DB states
    const [dbSubA] = await sharedDb.select().from(subscription).where(eq(subscription.id, subAId));
    assert.equal(dbSubA.status, "expired");

    const [dbSubB] = await sharedDb.select().from(subscription).where(eq(subscription.id, subBId));
    assert.equal(dbSubB.status, "active");

    const [dbSubC] = await sharedDb.select().from(subscription).where(eq(subscription.id, subCId));
    assert.equal(dbSubC.status, "active", "Lifetime subscription must never expire via sync");

    // Idempotent secondary run
    const syncRes2 = await service.syncExpiredSubscriptions(now);
    assert.equal(syncRes2.expiredSubscriptionIds.includes(subAId), false);

    executedScenarioCount++;
  });

  // --- SCENARIO K: orderId idempotency lookup is index-backed ---
  it("Scenario K: the webhook idempotency lookup on subscription.order_id is index-backed", async (t) => {
    if (!requireDatabase(t)) return;
    assert.ok(sharedDb);
    assert.ok(adminSql);

    // The webhook path resolves an existing subscription with
    // `WHERE subscription.order_id = <orderId>` (see BillingService). `orderId` is declared
    // `.unique()`, so PostgreSQL creates `subscription_order_id_unique` for free and no
    // separate index is warranted — the backlog item asked us to confirm this with EXPLAIN
    // before adding one. Guard it: if a future migration drops the unique constraint the
    // lookup silently degrades to a sequential scan of the whole table.
    const indexRows = await adminSql<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes
      WHERE tablename = 'subscription' AND indexdef ILIKE '%(order_id)%'
    `;
    assert.ok(
      indexRows.some((r) => /UNIQUE/i.test(r.indexdef) && /\(order_id\)/.test(r.indexdef)),
      `expected a unique index on subscription(order_id); found: ${indexRows.map((r) => r.indexdef).join(" | ") || "none"}`
    );

    // Seed enough rows that a sequential scan is the planner's cheaper choice unless an
    // index exists. Below ~1000 rows the planner picks a seq scan even *with* the index,
    // so the EXPLAIN assertion would be vacuous; 5000 rows leaves a comfortable margin.
    const N = 5000;
    const marker = `ordplan${Date.now()}`;
    await adminSql`
      INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
      SELECT ${marker} || '-u' || g, 'plan-user', ${marker} || '-u' || g || '@example.test', true, now(), now()
      FROM generate_series(1, ${N}) g
    `;
    await adminSql`
      INSERT INTO "order" (id, user_id, item_type, plan_id, amount, status, created_at, updated_at)
      SELECT ${marker} || '-o' || g, ${marker} || '-u' || g, 'subscription', 'pro', 100000, 'settlement', now(), now()
      FROM generate_series(1, ${N}) g
    `;
    await adminSql`
      INSERT INTO subscription (id, order_id, user_id, plan_id, status, billing_period, current_period_start, current_period_end, created_at, updated_at)
      SELECT ${marker} || '-s' || g, ${marker} || '-o' || g, ${marker} || '-u' || g, 'pro', 'active', 'monthly', now(), now() + interval '30 days', now(), now()
      FROM generate_series(1, ${N}) g
    `;
    await adminSql`ANALYZE subscription`;

    try {
      const plan = await adminSql<{ "QUERY PLAN": string }[]>`
        EXPLAIN (COSTS OFF) SELECT id FROM subscription WHERE order_id = ${marker + "-o2500"}
      `;
      const planText = plan.map((r) => r["QUERY PLAN"]).join("\n");
      assert.match(
        planText,
        /Index (Only )?Scan using subscription_order_id_unique/,
        `idempotency lookup is not index-backed:\n${planText}`
      );
    } finally {
      await adminSql`DELETE FROM subscription WHERE order_id LIKE ${marker + "%"}`;
      await adminSql`DELETE FROM "order" WHERE id LIKE ${marker + "%"}`;
      await adminSql`DELETE FROM "user" WHERE id LIKE ${marker + "%"}`;
    }

    executedScenarioCount++;
  });
});
