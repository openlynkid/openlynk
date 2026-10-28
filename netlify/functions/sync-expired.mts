/**
 * Daily expiry sweep, replacing the Vercel cron in `vercel.json`.
 *
 * Calls the existing route rather than the billing service so the route stays the single
 * place that authenticates the sweep (constant-time CRON_SECRET check, fails closed).
 * Scheduled functions only run on the published production deploy.
 */
const syncExpired = async () => {
  const cronSecret = process.env.CRON_SECRET;
  const origin = process.env.URL || process.env.BETTER_AUTH_URL;

  if (!cronSecret || !origin) {
    console.error("❌ CRON_SECRET or site URL is not configured; skipping the expiry sync.");
    return;
  }

  const res = await fetch(new URL("/api/billing/cron/sync-expired", origin), {
    method: "POST",
    headers: { Authorization: `Bearer ${cronSecret}` },
  });

  if (!res.ok) {
    console.error(`❌ Subscription expiry sync failed with HTTP ${res.status}.`);
    return;
  }

  const body = (await res.json()) as { updatedCount?: number };
  console.log(`✅ Subscription expiry sync updated ${body.updatedCount ?? 0} subscription(s).`);
};

export default syncExpired;

export const config = {
  // Same as the previous Vercel schedule: every day at 00:00 UTC.
  schedule: "0 0 * * *",
};
