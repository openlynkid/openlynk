import "./test-env.ts";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateEnv, serverSchema } from "../src/env.ts";

describe("Environment & Secret Validation (Task 1 Regression)", () => {
  const baseValidServerEnv = {
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/test_db",
    BETTER_AUTH_SECRET: "a-valid-secret-that-is-at-least-32-chars-long",
    BETTER_AUTH_URL: "http://localhost:3000",
    MIDTRANS_SERVER_KEY: "SB-Mid-server-test",
    MIDTRANS_IS_PRODUCTION: "false",
  };

  const baseValidClientEnv = {
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    NEXT_PUBLIC_MIDTRANS_CLIENT_KEY: "SB-Mid-client-test",
    NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION: "false",
  };

  it("should fail validation if BETTER_AUTH_SECRET is missing", () => {
    assert.throws(
      () => {
        validateEnv({
          server: {
            ...baseValidServerEnv,
            BETTER_AUTH_SECRET: undefined,
          },
          client: baseValidClientEnv,
        });
      },
      /Invalid server environment variables/
    );
  });

  it("should fail validation if BETTER_AUTH_SECRET is shorter than 32 characters", () => {
    assert.throws(
      () => {
        validateEnv({
          server: {
            ...baseValidServerEnv,
            BETTER_AUTH_SECRET: "too-short-secret-only-24", // 24 chars
          },
          client: baseValidClientEnv,
        });
      },
      /BETTER_AUTH_SECRET must be at least 32 characters/
    );
  });

  it("should succeed when BETTER_AUTH_SECRET is 32 characters or longer", () => {
    const secret32 = "12345678901234567890123456789012"; // exactly 32 chars
    const parsed = serverSchema.safeParse({
      ...baseValidServerEnv,
      BETTER_AUTH_SECRET: secret32,
    });
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.BETTER_AUTH_SECRET, secret32);
    }
  });

  describe("Midtrans Gateway Environment Flag Hardening (Phase 2.3.1)", () => {
    const serverWithoutFlag: Partial<typeof baseValidServerEnv> = { ...baseValidServerEnv };
    delete serverWithoutFlag.MIDTRANS_IS_PRODUCTION;

    const clientWithoutFlag: Partial<typeof baseValidClientEnv> = { ...baseValidClientEnv };
    delete clientWithoutFlag.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION;

    it("should pass when both flags are set to true", () => {
      const result = validateEnv({
        server: { ...serverWithoutFlag, MIDTRANS_IS_PRODUCTION: "true" },
        client: { ...clientWithoutFlag, NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION: "true" },
      });
      assert.equal(result.MIDTRANS_IS_PRODUCTION, true);
      assert.equal(result.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION, true);
    });

    it("should pass when both flags are set to false", () => {
      const result = validateEnv({
        server: { ...serverWithoutFlag, MIDTRANS_IS_PRODUCTION: "false" },
        client: { ...clientWithoutFlag, NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION: "false" },
      });
      assert.equal(result.MIDTRANS_IS_PRODUCTION, false);
      assert.equal(result.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION, false);
    });

    it("should fail when server flag is true and client flag is omitted", () => {
      assert.throws(
        () => {
          validateEnv({
            server: { ...serverWithoutFlag, MIDTRANS_IS_PRODUCTION: "true" },
            client: clientWithoutFlag,
          });
        },
        /Gateway environment conflict: MIDTRANS_IS_PRODUCTION \(true\) and NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION \(omitted\) must agree/
      );
    });

    it("should pass when server flag is false and client flag is omitted (resolving to sandbox)", () => {
      const result = validateEnv({
        server: { ...serverWithoutFlag, MIDTRANS_IS_PRODUCTION: "false" },
        client: clientWithoutFlag,
      });
      assert.equal(result.MIDTRANS_IS_PRODUCTION, false);
      assert.equal(result.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION, false);
    });

    it("should fail when server flag is omitted and client flag is true", () => {
      assert.throws(
        () => {
          validateEnv({
            server: serverWithoutFlag,
            client: { ...clientWithoutFlag, NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION: "true" },
          });
        },
        /Gateway environment conflict: MIDTRANS_IS_PRODUCTION \(omitted\) and NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION \(true\) must agree/
      );
    });

    it("should pass when both flags are omitted (defaulting to sandbox)", () => {
      const result = validateEnv({
        server: serverWithoutFlag,
        client: clientWithoutFlag,
      });
      assert.equal(result.MIDTRANS_IS_PRODUCTION, false);
      assert.equal(result.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION, false);
    });

    it("should fail when server is true and client is false", () => {
      assert.throws(
        () => {
          validateEnv({
            server: { ...serverWithoutFlag, MIDTRANS_IS_PRODUCTION: "true" },
            client: { ...clientWithoutFlag, NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION: "false" },
          });
        },
        /Gateway environment conflict: MIDTRANS_IS_PRODUCTION \(true\) and NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION \(false\) must agree/
      );
    });

    it("should fail when server is false and client is true", () => {
      assert.throws(
        () => {
          validateEnv({
            server: { ...serverWithoutFlag, MIDTRANS_IS_PRODUCTION: "false" },
            client: { ...clientWithoutFlag, NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION: "true" },
          });
        },
        /Gateway environment conflict: MIDTRANS_IS_PRODUCTION \(false\) and NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION \(true\) must agree/
      );
    });
  });
});
