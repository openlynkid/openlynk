import "./test-env.ts";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeWebhookFingerprint,
  determinePaymentStatus,
  shouldUpdateOrderStatus,
} from "../src/modules/billing/service.ts";

describe("Webhook Idempotency & Payment State Machine (Production Service)", () => {
  it("should generate identical eventId for duplicate deliveries of the same webhook", () => {
    const payload = {
      transaction_id: "trx-uuid-1111",
      order_id: "ORD-20261018-001",
      transaction_status: "settlement",
      status_code: "200",
      fraud_status: "accept",
      gross_amount: "149000.00",
    };

    const res1 = computeWebhookFingerprint(payload);
    const res2 = computeWebhookFingerprint({ ...payload });

    assert.equal(res1.eventId, res2.eventId);
    assert.match(res1.eventId, /^wh_[0-9a-f]{64}$/);
  });

  it("should normalize gross_amount so semantically equivalent monetary values share fingerprint", () => {
    const payloadDecimal = {
      transaction_id: "trx-uuid-1111",
      order_id: "ORD-20261018-001",
      transaction_status: "settlement",
      status_code: "200",
      fraud_status: "accept",
      gross_amount: "149000.00",
    };

    const payloadInteger = {
      ...payloadDecimal,
      gross_amount: "149000",
    };

    const resDecimal = computeWebhookFingerprint(payloadDecimal);
    const resInteger = computeWebhookFingerprint(payloadInteger);

    assert.equal(resDecimal.eventId, resInteger.eventId);
  });

  it("should generate different eventIds for status transitions (pending -> settlement)", () => {
    const pendingPayload = {
      transaction_id: "trx-uuid-1111",
      order_id: "ORD-20261018-001",
      transaction_status: "pending",
      status_code: "201",
      gross_amount: "149000.00",
    };

    const settlementPayload = {
      transaction_id: "trx-uuid-1111",
      order_id: "ORD-20261018-001",
      transaction_status: "settlement",
      status_code: "200",
      fraud_status: "accept",
      gross_amount: "149000.00",
    };

    const pendingId = computeWebhookFingerprint(pendingPayload).eventId;
    const settlementId = computeWebhookFingerprint(settlementPayload).eventId;

    assert.notEqual(pendingId, settlementId);
  });

  it("should generate different eventIds if fraud_status changes", () => {
    const challengePayload = {
      transaction_id: "trx-uuid-1111",
      order_id: "ORD-20261018-001",
      transaction_status: "capture",
      status_code: "200",
      fraud_status: "challenge",
      gross_amount: "149000.00",
    };

    const acceptPayload = {
      transaction_id: "trx-uuid-1111",
      order_id: "ORD-20261018-001",
      transaction_status: "capture",
      status_code: "200",
      fraud_status: "accept",
      gross_amount: "149000.00",
    };

    assert.notEqual(
      computeWebhookFingerprint(challengePayload).eventId,
      computeWebhookFingerprint(acceptPayload).eventId
    );
  });

  describe("Status Semantics & State Machine Transitions", () => {
    it("should correctly evaluate capture vs settlement success semantics", () => {
      assert.deepEqual(determinePaymentStatus("settlement"), {
        isSuccess: true,
        finalStatus: "settlement",
      });
      assert.deepEqual(determinePaymentStatus("capture", "accept"), {
        isSuccess: true,
        finalStatus: "settlement",
      });
      assert.deepEqual(determinePaymentStatus("capture", "challenge"), {
        isSuccess: false,
        finalStatus: "challenge",
      });
      assert.deepEqual(determinePaymentStatus("refund"), {
        isSuccess: false,
        finalStatus: "refund",
      });
      assert.deepEqual(determinePaymentStatus("partial_refund"), {
        isSuccess: false,
        finalStatus: "refund",
      });
      assert.deepEqual(determinePaymentStatus("expire"), {
        isSuccess: false,
        finalStatus: "expire",
      });
      assert.deepEqual(determinePaymentStatus("deny"), {
        isSuccess: false,
        finalStatus: "deny",
      });
      assert.deepEqual(determinePaymentStatus("cancel"), {
        isSuccess: false,
        finalStatus: "cancel",
      });
    });

    it("should ensure delayed pending, expire, deny notifications do not revert settlement", () => {
      assert.equal(shouldUpdateOrderStatus("settlement", "pending"), false);
      assert.equal(shouldUpdateOrderStatus("settlement", "expire"), false);
      assert.equal(shouldUpdateOrderStatus("settlement", "deny"), false);
      assert.equal(shouldUpdateOrderStatus("settlement", "cancel"), false);
      assert.equal(shouldUpdateOrderStatus("settlement", "challenge"), false);
    });

    it("should permit legitimate refund notifications to update a settled order", () => {
      assert.equal(shouldUpdateOrderStatus("settlement", "refund"), true);
    });

    it("should permit repeated settlement notifications idempotently", () => {
      assert.equal(shouldUpdateOrderStatus("settlement", "settlement"), true);
    });

    it("should permit standard progression from pending to settlement or terminal failure", () => {
      assert.equal(shouldUpdateOrderStatus("pending", "settlement"), true);
      assert.equal(shouldUpdateOrderStatus("pending", "expire"), true);
      assert.equal(shouldUpdateOrderStatus("pending", "deny"), true);
      assert.equal(shouldUpdateOrderStatus("pending", "cancel"), true);
    });
  });
});
