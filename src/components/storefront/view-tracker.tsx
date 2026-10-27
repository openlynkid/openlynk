"use client";

import { useEffect } from "react";

/**
 * Fire-and-forget storefront page-view tracking.
 *
 * Rendered as a zero-size client component inside a server-rendered page so the page
 * itself stays static. The request is deliberately not awaited and errors are swallowed:
 * a failed analytics call must never affect what the visitor sees.
 *
 * The abort on unmount keeps React's development double-mount from leaving a stray
 * request behind.
 */
export function ViewTracker({ username }: { username: string }) {
  useEffect(() => {
    if (!username) return;
    const controller = new AbortController();
    void fetch("/api/events/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, type: "profile_view" }),
      signal: controller.signal,
      keepalive: true,
    }).catch(() => {});

    return () => controller.abort();
  }, [username]);

  return null;
}

/**
 * Records that a visitor opened a product page.
 *
 * Separate from `ViewTracker` because the payload differs: a product view carries the
 * product id, which the events route checks against the creator's own products before
 * counting it.
 */
export function ProductViewTracker({
  username,
  productId,
}: {
  username: string;
  productId: string;
}) {
  useEffect(() => {
    if (!username || !productId) return;
    const controller = new AbortController();
    void fetch("/api/events/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, type: "product_view", targetId: productId }),
      signal: controller.signal,
      keepalive: true,
    }).catch(() => {});

    return () => controller.abort();
  }, [username, productId]);

  return null;
}
