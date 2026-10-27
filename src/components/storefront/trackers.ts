/**
 * Tracks a click on one of the creator's links.
 *
 * Sent with `keepalive` because the very next thing that happens is the browser opening
 * the link, and a normal fetch would be cancelled mid-flight. The anchor's own
 * navigation is never intercepted, so a blocked analytics endpoint cannot break the link.
 */
export function trackLinkClick(username: string, linkId: string) {
  void fetch("/api/events/link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, type: "link_click", targetId: linkId }),
    keepalive: true,
  }).catch(() => {});
}

/** Records that a visitor opened a product page. */
export function trackProductView(username: string) {
  void fetch("/api/events/link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, type: "product_view" }),
    keepalive: true,
  }).catch(() => {});
}
