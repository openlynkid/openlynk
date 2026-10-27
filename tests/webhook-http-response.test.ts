import "./test-env.ts";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { NextRequest } from "next/server";
import { POST } from "../src/app/api/webhooks/midtrans/route.ts";
import { billingService } from "../src/modules/billing/service.ts";
import { WebhookValidationError } from "../src/modules/billing/types.ts";

describe("Webhook HTTP Response Status & Retry Classification (Task 5 Regression)", () => {
  function createMockRequest(body: unknown, throwOnJson = false) {
    return {
      json: async () => {
        if (throwOnJson) throw new Error("JSON parse failure");
        return body;
      },
    } as unknown as NextRequest;
  }

  it("should return HTTP 400 for malformed JSON request body", async () => {
    const req = createMockRequest(null, true);
    const res = await POST(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.error, "Invalid JSON request body");
  });

  it("should return HTTP 400 for missing required fields", async () => {
    const req = createMockRequest({
      order_id: "ORD-123",
      // missing signature_key, status_code, etc.
    });
    const res = await POST(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /missing required fields/);
  });

  it("should return HTTP 400 for WebhookValidationError (permanent rejection)", async () => {
    const originalMethod = billingService.processWebhookNotification;
    try {
      billingService.processWebhookNotification = async () => {
        throw new WebhookValidationError("Invalid SHA-512 signature for order ORD-123");
      };

      const req = createMockRequest({
        order_id: "ORD-123",
        signature_key: "fake-sig",
        status_code: "200",
        gross_amount: "149000.00",
        transaction_status: "settlement",
      });

      const res = await POST(req);
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.received, false);
      assert.match(data.error, /Invalid SHA-512 signature/);
    } finally {
      billingService.processWebhookNotification = originalMethod;
    }
  });

  it("should return HTTP 500 for unexpected database failures (retryable)", async () => {
    const originalMethod = billingService.processWebhookNotification;
    try {
      billingService.processWebhookNotification = async () => {
        throw new Error("connection to server on socket '/tmp/.s.PGSQL.5432' failed: Connection refused");
      };

      const req = createMockRequest({
        order_id: "ORD-123",
        signature_key: "fake-sig",
        status_code: "200",
        gross_amount: "149000.00",
        transaction_status: "settlement",
      });

      const res = await POST(req);
      assert.equal(res.status, 500);
      const data = await res.json();
      assert.equal(data.received, false);
      // Ensure raw database connection string / internal socket error is NOT exposed to client
      assert.equal(data.error, "Internal processing error");
      assert.equal(data.error.includes("socket"), false);
      assert.equal(data.error.includes("PGSQL"), false);
    } finally {
      billingService.processWebhookNotification = originalMethod;
    }
  });

  it("should return HTTP 200 with duplicate: true for idempotent replay", async () => {
    const originalMethod = billingService.processWebhookNotification;
    try {
      billingService.processWebhookNotification = async () => {
        return {
          success: true,
          orderId: "ORD-123",
          status: "settlement",
          duplicate: true,
        };
      };

      const req = createMockRequest({
        order_id: "ORD-123",
        signature_key: "valid-sig",
        status_code: "200",
        gross_amount: "149000.00",
        transaction_status: "settlement",
      });

      const res = await POST(req);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.received, true);
      assert.equal(data.duplicate, true);
      assert.equal(data.status, "settlement");
    } finally {
      billingService.processWebhookNotification = originalMethod;
    }
  });
});
