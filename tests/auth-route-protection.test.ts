import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { proxy } from "../src/proxy";
import { NextRequest } from "next/server";

function createMockRequest(url: string, cookies: Record<string, string> = {}) {
  const req = new NextRequest(new URL(url, "http://localhost:3000"));
  for (const [key, val] of Object.entries(cookies)) {
    req.cookies.set(key, val);
  }
  return req;
}

describe("Auth Route Protection (Proxy & Session Guards)", () => {
  describe("Unauthenticated Access Restrictions", () => {
    it("should redirect unauthenticated access on /dashboard to /login with redirect param", () => {
      const req = createMockRequest("/dashboard");
      const res = proxy(req);

      assert.equal(res.status, 307);
      const location = res.headers.get("location");
      assert.ok(location);
      const targetUrl = new URL(location);
      assert.equal(targetUrl.pathname, "/login");
      assert.equal(targetUrl.searchParams.get("redirect"), "/dashboard");
    });

    it("should redirect unauthenticated access on /dashboard/billing to /login with redirect param", () => {
      const req = createMockRequest("/dashboard/billing");
      const res = proxy(req);

      assert.equal(res.status, 307);
      const location = res.headers.get("location");
      assert.ok(location);
      const targetUrl = new URL(location);
      assert.equal(targetUrl.pathname, "/login");
      assert.equal(targetUrl.searchParams.get("redirect"), "/dashboard/billing");
    });

    it("should redirect unauthenticated access on /dashboard/organizations to /login with redirect param", () => {
      const req = createMockRequest("/dashboard/organizations");
      const res = proxy(req);

      assert.equal(res.status, 307);
      const location = res.headers.get("location");
      assert.ok(location);
      const targetUrl = new URL(location);
      assert.equal(targetUrl.pathname, "/login");
      assert.equal(targetUrl.searchParams.get("redirect"), "/dashboard/organizations");
    });

    it("should redirect unauthenticated access on /dashboard/settings to /login with redirect param", () => {
      const req = createMockRequest("/dashboard/settings");
      const res = proxy(req);

      assert.equal(res.status, 307);
      const location = res.headers.get("location");
      assert.ok(location);
      const targetUrl = new URL(location);
      assert.equal(targetUrl.pathname, "/login");
      assert.equal(targetUrl.searchParams.get("redirect"), "/dashboard/settings");
    });

    it("should redirect unauthenticated access on /dashboard/studio to /login with redirect param", () => {
      const req = createMockRequest("/dashboard/studio");
      const res = proxy(req);

      assert.equal(res.status, 307);
      const location = res.headers.get("location");
      assert.ok(location);
      const targetUrl = new URL(location);
      assert.equal(targetUrl.pathname, "/login");
      assert.equal(targetUrl.searchParams.get("redirect"), "/dashboard/studio");
    });

    it("should permit unauthenticated access to /login", () => {
      const req = createMockRequest("/login");
      const res = proxy(req);

      // NextResponse.next() returns 200 without redirect location
      assert.equal(res.status, 200);
      assert.equal(res.headers.get("location"), null);
    });

    it("should permit unauthenticated access to /register", () => {
      const req = createMockRequest("/register");
      const res = proxy(req);

      assert.equal(res.status, 200);
      assert.equal(res.headers.get("location"), null);
    });
  });

  describe("Authenticated Access Restrictions", () => {
    it("should permit authenticated access to /dashboard when better-auth.session_token is present", () => {
      const req = createMockRequest("/dashboard", {
        "better-auth.session_token": "valid_test_token_123",
      });
      const res = proxy(req);

      assert.equal(res.status, 200);
      assert.equal(res.headers.get("location"), null);
    });

    it("should permit authenticated access to /dashboard when __Secure-better-auth.session_token is present", () => {
      const req = createMockRequest("/dashboard/billing", {
        "__Secure-better-auth.session_token": "valid_secure_token_456",
      });
      const res = proxy(req);

      assert.equal(res.status, 200);
      assert.equal(res.headers.get("location"), null);
    });

    it("should redirect authenticated user from /login to /dashboard", () => {
      const req = createMockRequest("/login", {
        "better-auth.session_token": "valid_test_token_123",
      });
      const res = proxy(req);

      assert.equal(res.status, 307);
      const location = res.headers.get("location");
      assert.ok(location);
      const targetUrl = new URL(location);
      assert.equal(targetUrl.pathname, "/dashboard");
    });

    it("should redirect authenticated user from /register to /dashboard", () => {
      const req = createMockRequest("/register", {
        "__Secure-better-auth.session_token": "valid_secure_token_456",
      });
      const res = proxy(req);

      assert.equal(res.status, 307);
      const location = res.headers.get("location");
      assert.ok(location);
      const targetUrl = new URL(location);
      assert.equal(targetUrl.pathname, "/dashboard");
    });

    it("should NOT redirect authenticated user from /login when explicit redirect parameter is present (loop prevention)", () => {
      const req = createMockRequest("/login?redirect=/dashboard", {
        "better-auth.session_token": "stale_token_123",
      });
      const res = proxy(req);

      assert.equal(res.status, 200);
      assert.equal(res.headers.get("location"), null);
    });
  });
});
