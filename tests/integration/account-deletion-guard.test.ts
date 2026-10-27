import "../test-env.ts";
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq, or } from "drizzle-orm";
import * as schema from "../../src/server/db/schema/index.ts";
import { order, subscription, paymentTransaction } from "../../src/server/db/schema/billing.ts";
import { user } from "../../src/server/db/schema/auth.ts";
import { organization, member } from "../../src/server/db/schema/organizations.ts";
import {
  collectOrgMembershipFacts,
  deleteSoleMemberOrganizations,
  findDeletionBlockers,
} from "../../src/modules/account/deletion-guard.ts";
import { migrateUnderLock } from "./migrate-safely.ts";

const integrationDbUrl = process.env.INTEGRATION_TEST_DATABASE_URL || "";

// How many scenarios this file must execute. `pnpm test:integration` exits 0 even when
// every scenario skips, so a missing database used to look green. Assert the executed
// count at the end so a skipped run fails loudly instead.
const REQUIRED_SCENARIO_COUNT = 10;
const EXPECT_INTEGRATION_DB = process.env.EXPECT_INTEGRATION_DB === "true";

/** Fails closed on any ambiguous, remote, or production-like target. */
function verifyDisposableDatabase(urlStr: string): { isDisposable: boolean; reason: string } {
  if (!urlStr) {
    return { isDisposable: false, reason: "No database URL provided in INTEGRATION_TEST_DATABASE_URL." };
  }

  try {
    const parsed = new URL(urlStr);
    const dbName = parsed.pathname.replace(/^\//, "").toLowerCase();
    const hostname = parsed.hostname.toLowerCase();

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

    const hasDisposableName =
      dbName.includes("test") || dbName.includes("disposable") || dbName.includes("scratch");

    if (!hasDisposableName) {
      return {
        isDisposable: false,
        reason: `Target database '${dbName}' fails closed: name must explicitly contain 'test', 'disposable', or 'scratch'.`,
      };
    }

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

describe("Account Deletion Guard against real PostgreSQL (cascade safety)", () => {
  let isAvailable = false;
  let adminSql: postgres.Sql | null = null;
  let sharedDb: ReturnType<typeof drizzle<typeof schema>> | null = null;
  let executedScenarioCount = 0;

  // Skip only when the database is genuinely optional. With EXPECT_INTEGRATION_DB=true
  // (or CI) a missing database is a failure, not a silent skip.
  function requireDatabase(t: { skip: (reason: string) => void }): boolean {
    if (isAvailable && sharedDb) return true;
    if (process.env.CI === "true" || EXPECT_INTEGRATION_DB) {
      throw new Error(
        "PostgreSQL not available, but this run requires it (CI or EXPECT_INTEGRATION_DB=true)."
      );
    }
    t.skip("PostgreSQL not available");
    return false;
  }

  const testUserIds: string[] = [];
  const testOrgIds: string[] = [];
  const testOrderIds: string[] = [];

  before(async () => {
    const safety = verifyDisposableDatabase(integrationDbUrl);
    if (!safety.isDisposable) {
      if (process.env.CI === "true") {
        throw new Error(`[CI FAILURE] Disposable database safety check failed in CI: ${safety.reason}`);
      }
      console.log(`\n[PREREQUISITE SKIPPED] Deletion guard integration tests skipped: ${safety.reason}`);
      return;
    }

    try {
      adminSql = postgres(integrationDbUrl, {
        max: 5,
        connect_timeout: 10,
        idle_timeout: 10,
        prepare: false,
      });
      await adminSql`SELECT 1 as connected`;

      sharedDb = drizzle(adminSql, { schema });
      // Serialized against the sibling integration file, which migrates the same
      // database concurrently on a fresh run.
      await migrateUnderLock(sharedDb, integrationDbUrl);

      isAvailable = true;
    } catch (connErr) {
      if (process.env.CI === "true") {
        throw new Error(
          `[CI FAILURE] Deletion guard integration setup failed in CI: ${connErr instanceof Error ? connErr.message : String(connErr)}`
        );
      }
      console.log(`\n[PREREQUISITE SKIPPED] Cannot connect to PostgreSQL: ${connErr instanceof Error ? connErr.message : String(connErr)}`);
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
    try {
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
      console.error("Deletion guard test cleanup error:", cleanupErr);
    } finally {
      await adminSql.end({ timeout: 2 }).catch(() => {});
    }
  });

  /** Creates a user, an organization with the given members, and returns their ids. */
  async function seedOrganization(params: {
    slug: string;
    members: Array<{ id: string; role: string }>;
  }) {
    if (!sharedDb) throw new Error("Database not connected");
    const orgId = `org_${params.slug}`;
    const now = new Date();

    for (const m of params.members) {
      testUserIds.push(m.id);
      await sharedDb
        .insert(user)
        .values({
          id: m.id,
          name: m.id,
          email: `${m.id}@deletion-guard.test`,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing();
    }

    testOrgIds.push(orgId);
    await sharedDb.insert(organization).values({
      id: orgId,
      name: params.slug,
      slug: params.slug,
      createdAt: now,
    });

    for (const m of params.members) {
      await sharedDb.insert(member).values({
        id: `mem_${params.slug}_${m.id}`,
        organizationId: orgId,
        userId: m.id,
        role: m.role,
        createdAt: now,
      });
    }

    return orgId;
  }

  it("blocks a sole owner who still has other members in the workspace", async (t) => {
    if (!requireDatabase(t)) return;
    executedScenarioCount++;
    assert.ok(sharedDb);

    const orgId = await seedOrganization({
      slug: "guard-sole-owner",
      members: [
        { id: "usr_guard_owner", role: "owner" },
        { id: "usr_guard_member", role: "member" },
      ],
    });

    const blockers = await findDeletionBlockers("usr_guard_owner", sharedDb);

    assert.equal(blockers.length, 1);
    assert.equal(blockers[0].reason, "sole_owner");
    assert.equal(blockers[0].organizationId, orgId);
  });

  it("blocks the payer of a live organization plan even when another owner exists", async (t) => {
    if (!requireDatabase(t)) return;
    executedScenarioCount++;
    assert.ok(sharedDb);

    const orgId = await seedOrganization({
      slug: "guard-payer",
      members: [
        { id: "usr_guard_payer", role: "member" },
        { id: "usr_guard_owner2", role: "owner" },
      ],
    });

    const now = new Date();
    const orderId = "ORD-GUARD-PAYER";
    testOrderIds.push(orderId);

    // The payer bought the plan FOR the organization: userId and organizationId both set.
    await sharedDb.insert(order).values({
      id: orderId,
      userId: "usr_guard_payer",
      organizationId: orgId,
      itemType: "subscription",
      planId: "pro",
      billingPeriod: "monthly",
      amount: 149000,
      currency: "IDR",
      status: "settlement",
      createdAt: now,
      updatedAt: now,
    });

    await sharedDb.insert(subscription).values({
      id: "sub_guard_payer",
      orderId,
      userId: "usr_guard_payer",
      organizationId: orgId,
      planId: "pro",
      status: "active",
      billingPeriod: "monthly",
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 3600 * 1000),
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
    });

    const blockers = await findDeletionBlockers("usr_guard_payer", sharedDb);

    assert.equal(blockers.length, 1);
    assert.equal(blockers[0].reason, "organization_payer");
    assert.equal(blockers[0].organizationId, orgId);
  });

  it("allows a member who neither owns nor pays for the shared workspace", async (t) => {
    if (!requireDatabase(t)) return;
    executedScenarioCount++;
    assert.ok(sharedDb);

    await seedOrganization({
      slug: "guard-plain-member",
      members: [
        { id: "usr_guard_plain", role: "member" },
        { id: "usr_guard_owner3", role: "owner" },
      ],
    });

    const blockers = await findDeletionBlockers("usr_guard_plain", sharedDb);
    assert.deepEqual(blockers, []);
  });

  it("unblocks deletion once a second owner is promoted, the escape route the UI offers", async (t) => {
    if (!requireDatabase(t)) return;
    executedScenarioCount++;
    assert.ok(sharedDb);

    const orgId = await seedOrganization({
      slug: "guard-promote",
      members: [
        { id: "usr_guard_promoter", role: "owner" },
        { id: "usr_guard_promoted", role: "member" },
      ],
    });

    const before = await findDeletionBlockers("usr_guard_promoter", sharedDb);
    assert.equal(before.length, 1);
    assert.equal(before[0].reason, "sole_owner");

    // Exactly the write the Organizations page performs when an owner promotes someone.
    await sharedDb
      .update(member)
      .set({ role: "owner" })
      .where(
        and(
          eq(member.organizationId, orgId),
          eq(member.userId, "usr_guard_promoted")
        )
      );

    const after = await findDeletionBlockers("usr_guard_promoter", sharedDb);
    assert.deepEqual(after, []);
  });

  it("allows a former payer once the organization subscription is no longer active", async (t) => {
    if (!requireDatabase(t)) return;
    executedScenarioCount++;
    assert.ok(sharedDb);

    const orgId = await seedOrganization({
      slug: "guard-expired-payer",
      members: [
        { id: "usr_guard_expayer", role: "member" },
        { id: "usr_guard_eowner", role: "owner" },
      ],
    });

    const now = new Date();
    const orderId = "ORD-GUARD-EXPAYER";
    testOrderIds.push(orderId);

    await sharedDb.insert(order).values({
      id: orderId,
      userId: "usr_guard_expayer",
      organizationId: orgId,
      itemType: "subscription",
      planId: "pro",
      billingPeriod: "monthly",
      amount: 149000,
      currency: "IDR",
      status: "settlement",
      createdAt: now,
      updatedAt: now,
    });

    // The subscription lapsed. Nothing of value is left to destroy, so the account
    // must be deletable without hunting for support.
    await sharedDb.insert(subscription).values({
      id: "sub_guard_expayer",
      orderId,
      userId: "usr_guard_expayer",
      organizationId: orgId,
      planId: "pro",
      status: "expired",
      billingPeriod: "monthly",
      currentPeriodStart: new Date(now.getTime() - 60 * 24 * 3600 * 1000),
      currentPeriodEnd: new Date(now.getTime() - 30 * 24 * 3600 * 1000),
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
    });

    const blockers = await findDeletionBlockers("usr_guard_expayer", sharedDb);
    assert.deepEqual(blockers, []);
  });

  it("allows a sole owner whose workspace has no other members", async (t) => {
    if (!requireDatabase(t)) return;
    executedScenarioCount++;
    assert.ok(sharedDb);

    await seedOrganization({
      slug: "guard-solo-org",
      members: [{ id: "usr_guard_solo", role: "owner" }],
    });

    const blockers = await findDeletionBlockers("usr_guard_solo", sharedDb);
    assert.deepEqual(blockers, []);
  });

  it("removes a workspace the user alone belongs to, leaving no orphan organization", async (t) => {
    if (!requireDatabase(t)) return;
    executedScenarioCount++;
    assert.ok(sharedDb);

    const orgId = await seedOrganization({
      slug: "guard-orphan-cleanup",
      members: [{ id: "usr_guard_orphan", role: "owner" }],
    });

    const facts = await collectOrgMembershipFacts("usr_guard_orphan", sharedDb);
    assert.equal(facts.length, 1);

    const removed = await deleteSoleMemberOrganizations(facts, sharedDb);
    assert.deepEqual(removed, [orgId]);

    const remaining = await sharedDb
      .select()
      .from(organization)
      .where(eq(organization.id, orgId));
    assert.equal(remaining.length, 0, "the sole-member workspace must not be left behind");
  });

  it("leaves a shared workspace untouched when its owner deletes a personal account", async (t) => {
    if (!requireDatabase(t)) return;
    executedScenarioCount++;
    assert.ok(sharedDb);

    const orgId = await seedOrganization({
      slug: "guard-shared-untouched",
      members: [
        { id: "usr_guard_shared_a", role: "owner" },
        { id: "usr_guard_shared_b", role: "member" },
      ],
    });

    // The other member deletes their account: nothing about the workspace should change.
    const facts = await collectOrgMembershipFacts("usr_guard_shared_b", sharedDb);
    const removed = await deleteSoleMemberOrganizations(facts, sharedDb);
    assert.deepEqual(removed, []);

    const remaining = await sharedDb
      .select()
      .from(organization)
      .where(eq(organization.id, orgId));
    assert.equal(remaining.length, 1, "a shared workspace must survive a member leaving");
  });

  it("proves the danger the guard prevents: payer deletion cascades the org plan away", async (t) => {
    if (!requireDatabase(t)) return;
    executedScenarioCount++;
    assert.ok(sharedDb);

    const orgId = await seedOrganization({
      slug: "guard-cascade-proof",
      members: [
        { id: "usr_guard_cascade_payer", role: "member" },
        { id: "usr_guard_cascade_other", role: "member" },
      ],
    });

    const now = new Date();
    const orderId = "ORD-GUARD-CASCADE";
    testOrderIds.push(orderId);

    await sharedDb.insert(order).values({
      id: orderId,
      userId: "usr_guard_cascade_payer",
      organizationId: orgId,
      itemType: "subscription",
      planId: "pro",
      billingPeriod: "monthly",
      amount: 149000,
      currency: "IDR",
      status: "settlement",
      createdAt: now,
      updatedAt: now,
    });

    await sharedDb.insert(subscription).values({
      id: "sub_guard_cascade",
      orderId,
      userId: "usr_guard_cascade_payer",
      organizationId: orgId,
      planId: "pro",
      status: "active",
      billingPeriod: "monthly",
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 3600 * 1000),
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
    });

    // The guard refuses this deletion before it can happen.
    const blockers = await findDeletionBlockers("usr_guard_cascade_payer", sharedDb);
    assert.equal(blockers.length, 1);

    // Delete the user directly to show what the guard is holding back.
    await sharedDb.delete(user).where(eq(user.id, "usr_guard_cascade_payer"));

    const remainingOrders = await sharedDb
      .select()
      .from(order)
      .where(eq(order.organizationId, orgId));
    const remainingSubs = await sharedDb
      .select()
      .from(subscription)
      .where(eq(subscription.organizationId, orgId));
    const remainingMembers = await sharedDb
      .select()
      .from(member)
      .where(eq(member.organizationId, orgId));

    assert.equal(remainingOrders.length, 0, "payer deletion cascades the org order away");
    assert.equal(remainingSubs.length, 0, "payer deletion cascades the org subscription away");
    assert.equal(remainingMembers.length, 1, "the other member is left without a plan");
  });

  it("blocks a payer who was removed from the organization but still funds its plan", async (t) => {
    if (!requireDatabase(t)) return;
    executedScenarioCount++;
    assert.ok(sharedDb);

    const orgId = "org_guard_removed_payer";
    const now = new Date();
    const orderId = "ORD-GUARD-REMOVED-PAYER";
    const payerId = "usr_guard_removed_payer";

    testUserIds.push(payerId);
    testUserIds.push("usr_guard_remaining_member");
    testOrgIds.push(orgId);
    testOrderIds.push(orderId);

    await sharedDb
      .insert(user)
      .values([
        { id: payerId, name: payerId, email: `${payerId}@deletion-guard.test`, emailVerified: true, createdAt: now, updatedAt: now },
        { id: "usr_guard_remaining_member", name: "remaining", email: "remaining@deletion-guard.test", emailVerified: true, createdAt: now, updatedAt: now },
      ])
      .onConflictDoNothing();

    await sharedDb.insert(organization).values({
      id: orgId, name: "Removed Payer Org", slug: "guard-removed-payer", createdAt: now,
    });

    // The payer is NOT a member: an owner removed them after they paid.
    await sharedDb.insert(member).values({
      id: "mem_guard_removed_owner", organizationId: orgId, userId: "usr_guard_remaining_member", role: "owner", createdAt: now,
    });

    await sharedDb.insert(order).values({
      id: orderId, userId: payerId, organizationId: orgId,
      itemType: "subscription", planId: "pro", billingPeriod: "monthly",
      amount: 149000, currency: "IDR", status: "settlement", createdAt: now, updatedAt: now,
    });

    await sharedDb.insert(subscription).values({
      id: "sub_guard_removed_payer", orderId, userId: payerId, organizationId: orgId,
      planId: "pro", status: "active", billingPeriod: "monthly",
      currentPeriodStart: now, currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 3600 * 1000),
      cancelAtPeriodEnd: false, createdAt: now, updatedAt: now,
    });

    // Membership alone does not decide the outcome: the cascade follows userId, so the
    // payer's deletion would still destroy the plan the remaining member is using.
    const blockers = await findDeletionBlockers(payerId, sharedDb);
    assert.equal(blockers.length, 1);
    assert.equal(blockers[0].reason, "organization_payer");
    assert.equal(blockers[0].organizationId, orgId);

    // The orphan-workspace cleanup must not touch a payer-only organization: it still
    // has a member, and deleting it here would strand that member's workspace.
    const facts = await collectOrgMembershipFacts(payerId, sharedDb);
    const removed = await deleteSoleMemberOrganizations(facts, sharedDb);
    assert.deepEqual(removed, []);

    const stillThere = await sharedDb
      .select()
      .from(organization)
      .where(eq(organization.id, orgId));
    assert.equal(stillThere.length, 1, "a payer-only workspace must never be removed by cleanup");
  });
});
