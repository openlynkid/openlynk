import "./test-env.ts";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { MidtransClient } from "../src/modules/billing/midtrans-client.ts";

describe("Midtrans Signature Verification", () => {
  const serverKey = "SB-Mid-server-test-secret-key-12345";
  const client = new MidtransClient({
    serverKey,
    clientKey: "SB-Mid-client-test-key",
    isProduction: false,
  });

  const orderId = "ORD-TEST-12345";
  const statusCode = "200";
  const grossAmount = "149000.00";

  // Compute reference SHA-512
  const raw = `${orderId}${statusCode}${grossAmount}${serverKey}`;
  const validSignature = crypto.createHash("sha512").update(raw).digest("hex");

  it("should verify valid signature successfully", () => {
    const result = client.verifySignature(orderId, statusCode, grossAmount, validSignature);
    assert.equal(result, true);
  });

  it("should handle uppercase signature correctly", () => {
    const result = client.verifySignature(
      orderId,
      statusCode,
      grossAmount,
      validSignature.toUpperCase()
    );
    assert.equal(result, true);
  });

  it("should handle grossAmount as number correctly", () => {
    const numAmount = 149000.0;
    const result = client.verifySignature(orderId, statusCode, numAmount, validSignature);
    assert.equal(result, true);
  });

  it("should reject tampered signature", () => {
    const tampered = validSignature.substring(0, 126) + "00";
    const result = client.verifySignature(orderId, statusCode, grossAmount, tampered);
    assert.equal(result, false);
  });

  it("should reject signature with wrong orderId or statusCode or amount", () => {
    assert.equal(
      client.verifySignature("ORD-OTHER", statusCode, grossAmount, validSignature),
      false
    );
    assert.equal(
      client.verifySignature(orderId, "201", grossAmount, validSignature),
      false
    );
    assert.equal(
      client.verifySignature(orderId, statusCode, "200000.00", validSignature),
      false
    );
  });

  it("should safely reject non-hex signature without throwing", () => {
    const badHex = "Z".repeat(128);
    const result = client.verifySignature(orderId, statusCode, grossAmount, badHex);
    assert.equal(result, false);
  });

  it("should safely reject signature with invalid length without throwing", () => {
    assert.equal(client.verifySignature(orderId, statusCode, grossAmount, "abcd"), false);
    assert.equal(client.verifySignature(orderId, statusCode, grossAmount, "a".repeat(130)), false);
    assert.equal(client.verifySignature(orderId, statusCode, grossAmount, ""), false);
  });

  it("should safely reject null/undefined/non-string signature without throwing", () => {
    assert.equal(client.verifySignature(orderId, statusCode, grossAmount, null as unknown as string), false);
    assert.equal(client.verifySignature(orderId, statusCode, grossAmount, undefined as unknown as string), false);
    assert.equal(client.verifySignature(orderId, statusCode, grossAmount, 12345 as unknown as string), false);
    assert.equal(client.verifySignature(orderId, statusCode, grossAmount, {} as unknown as string), false);
  });

  it("should safely reject when serverKey is missing", () => {
    const clientNoKey = new MidtransClient({ serverKey: "" });
    const result = clientNoKey.verifySignature(orderId, statusCode, grossAmount, validSignature);
    assert.equal(result, false);
  });
});
