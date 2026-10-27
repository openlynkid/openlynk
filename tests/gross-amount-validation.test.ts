import "./test-env.ts";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateGrossAmount } from "../src/modules/billing/service.ts";

describe("Deterministic Gross Amount Validation (Production Service)", () => {
  it("should accept exact integer string match", () => {
    assert.equal(validateGrossAmount("149000", 149000).valid, true);
    assert.equal(validateGrossAmount("499000", 499000).valid, true);
    assert.equal(validateGrossAmount("2499000", 2499000).valid, true);
    assert.equal(validateGrossAmount("149000", 149000).normalizedAmount, "149000");
  });

  it("should accept valid decimal representation (.00 and .0)", () => {
    assert.equal(validateGrossAmount("149000.00", 149000).valid, true);
    assert.equal(validateGrossAmount("149000.0", 149000).valid, true);
    assert.equal(validateGrossAmount("149000.00", 149000).normalizedAmount, "149000");
  });

  it("should reject amount value mismatch", () => {
    assert.equal(validateGrossAmount("149001", 149000).valid, false);
    assert.equal(validateGrossAmount("149000.00", 149001).valid, false);
    assert.equal(validateGrossAmount("0", 149000).valid, false);
    assert.equal(validateGrossAmount("1000", 149000).valid, false);
  });

  it("should reject fractional cents for IDR", () => {
    assert.equal(validateGrossAmount("149000.50", 149000).valid, false);
    assert.equal(validateGrossAmount("149000.99", 149000).valid, false);
  });

  it("should reject malformed numeric inputs", () => {
    assert.equal(validateGrossAmount("149000abc", 149000).valid, false);
    assert.equal(validateGrossAmount("-149000", 149000).valid, false);
    assert.equal(validateGrossAmount("+149000", 149000).valid, false);
    assert.equal(validateGrossAmount("1.49e5", 149000).valid, false);
    assert.equal(validateGrossAmount("0149000", 149000).valid, false); // leading zero
    assert.equal(validateGrossAmount("149,000", 149000).valid, false);
    assert.equal(validateGrossAmount("149000.000", 149000).valid, false);
    assert.equal(validateGrossAmount("NaN", 149000).valid, false);
    assert.equal(validateGrossAmount("Infinity", 149000).valid, false);
    assert.equal(validateGrossAmount("", 149000).valid, false);
    assert.equal(validateGrossAmount(null, 149000).valid, false);
    assert.equal(validateGrossAmount(undefined, 149000).valid, false);
  });
});
