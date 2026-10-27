import "./test-env.ts";
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import type { NextRequest } from "next/server";
import { POST } from "../src/app/api/billing/cron/sync-expired/route.ts";
import { billingService } from "../src/modules/billing/service.ts";

describe("Cron endpoint authentication (fail-closed)", () => {
  const originalSecret = process.env.CRON_SECRET;
  const originalSync = billingService.syncExpiredSubscriptions;

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalSecret;
    }
    billingService.syncExpiredSubscriptions = originalSync;
  });

  function createRequest(authorization?: string) {
    return {
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "authorization" ? authorization ?? null : null,
      },
    } as unknown as NextRequest;
  }

  /** Records whether the sweep actually ran, so auth tests prove state was untouched. */
  function stubSync() {
    let called = false;
    billingService.syncExpiredSubscriptions = async () => {
      called = true;
      return { updatedCount: 0, expiredSubscriptionIds: [] };
    };
    return () => called;
  }

  it("returns 500 and does not run the sweep when CRON_SECRET is missing", async () => {
    delete process.env.CRON_SECRET;
    const wasCalled = stubSync();

    const res = await POST(createRequest());

    assert.equal(res.status, 500);
    assert.equal(wasCalled(), false);
    const data = await res.json();
    assert.match(data.error, /not configured/i);
  });

  it("returns 401 when the Authorization header is absent", async () => {
    process.env.CRON_SECRET = "cron-secret-for-tests-at-least-32-chars!!";
    const wasCalled = stubSync();

    const res = await POST(createRequest());

    assert.equal(res.status, 401);
    assert.equal(wasCalled(), false);
  });

  it("returns 401 for a wrong secret of the same length", async () => {
    process.env.CRON_SECRET = "cron-secret-for-tests-at-least-32-chars!!";
    const wasCalled = stubSync();

    const res = await POST(
      createRequest("Bearer cron-secret-for-tests-at-least-32-charsXX")
    );

    assert.equal(res.status, 401);
    assert.equal(wasCalled(), false);
  });

  it("returns 401 for a secret of a different length", async () => {
    process.env.CRON_SECRET = "cron-secret-for-tests-at-least-32-chars!!";
    const wasCalled = stubSync();

    const res = await POST(createRequest("Bearer short"));

    assert.equal(res.status, 401);
    assert.equal(wasCalled(), false);
  });

  it("returns 401 when the Bearer prefix is missing", async () => {
    process.env.CRON_SECRET = "cron-secret-for-tests-at-least-32-chars!!";
    const wasCalled = stubSync();

    const res = await POST(
      createRequest("cron-secret-for-tests-at-least-32-chars!!")
    );

    assert.equal(res.status, 401);
    assert.equal(wasCalled(), false);
  });

  it("runs the sweep and returns 200 with the correct secret", async () => {
    process.env.CRON_SECRET = "cron-secret-for-tests-at-least-32-chars!!";
    const wasCalled = stubSync();

    const res = await POST(
      createRequest("Bearer cron-secret-for-tests-at-least-32-chars!!")
    );

    assert.equal(res.status, 200);
    assert.equal(wasCalled(), true);
    const data = await res.json();
    assert.equal(data.success, true);
  });
});
