# Delivery Report — sitemap.xml route

Outcome:               done
Item:                  `.agents/TASKS.md` backlog — add `src/app/sitemap.ts` so the
                       `Sitemap:` line in `robots.txt` resolves (it pointed at a 404
                       after D-14). Follow-up to issue #15.
Mode sequence run:     planning → backend → qa → review
Files changed:
  - `src/lib/seo.ts` (new) — `PUBLIC_ROUTES`, `PRIVATE_ROUTES`, `getSiteOrigin()`,
    `absoluteUrl()`. The single source for the indexable surface and the site origin.
  - `src/app/sitemap.ts` (new) — `MetadataRoute.Sitemap`; one `{ url }` per public route.
  - `src/app/robots.ts` (changed) — refactored onto `src/lib/seo.ts`; behaviour identical
    (same allow/deny split, same env-derived sitemap URL), now four lines.
  - `tests/sitemap-route.test.ts` (new) — classification and shape guard.
  - `.agents/MEMORY.md` — D-15. `.agents/TASKS.md` — item moved to Done.
  - `.agents/rooms/sitemap-route/REPORT.md` (this file).

Scope decisions (both were open questions in the backlog item):
  1. **Which routes are public → only `/`.** `/login` and `/register` are `Disallow`ed by
     `robots.txt`, so listing them in the sitemap would contradict it. `/dashboard/**` is
     private, enforced by the `proxy.ts` matcher.
  2. **`lastModified` → omitted.** The field means "content last changed". `new Date()`
     would claim every page changed on every deploy; a git date is not reliably available
     (this workspace is a shallow clone; CI checkouts are often shallow; `next build` can
     run with no `.git`). A wrong date is worse than none. `changeFrequency` and `priority`
     are omitted as well — Google ignores them.

Verification (all run, none inferred):
  - `pnpm typecheck` → exit 0
  - `pnpm lint` → exit 0
  - `pnpm test` → tests 176 / pass 176 / fail 0 / skipped 0
  - `pnpm test:integration` → tests 21 / pass 21 / fail 0 / skipped 0
    (real PostgreSQL 16 container, `INTEGRATION_TEST_DATABASE_URL` on database
    `saas_starterkit_test`, pre-migrated, `MIDTRANS_SERVER_KEY` matching the webhook tests)
  - `pnpm build` → exit 0; route table shows `○ /robots.txt` and `○ /sitemap.xml`
  - emitted output read, not just the route table:
    `.next/server/app/sitemap.xml.body` →
      `<?xml version="1.0" encoding="UTF-8"?>`
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`
      `<url><loc>http://localhost:12000/</loc></url></urlset>`
  - **negative controls** (the guard must be able to fail):
    - added `src/app/pricing/page.tsx` → `fail 1`:
      `/pricing has a page.tsx but is classified as neither public nor private in
      src/lib/seo.ts`
    - forced `/login` into `PUBLIC_ROUTES` → `fail 1`:
      `/login is in the sitemap but disallowed by robots.txt`
    - both reverted; suite back to `pass 176 / fail 0`

Notes:
  - `robots.ts` behaviour is unchanged, so `tests/robots-route.test.ts` still passes
    untouched. That test asserts on the emitted object, not on where the values come from,
    which is why the refactor did not need to weaken it.
  - No new env var: the origin still comes from `NEXT_PUBLIC_APP_URL` (D-14).
