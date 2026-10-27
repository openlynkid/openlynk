# OpenLynk

A link-in-bio platform for selling digital products, in the spirit of openbio.app and
lynk.id. Creators get one page for their links and their storefront: buyers can claim free
products, pay for paid ones through Midtrans, and download what they own.

Built as a modular monolith with end-to-end TypeScript on top of the
[`iwwwan-io/saas-starterkit`](https://github.com/iwwwan-io/saas-starterkit) template.

## Features

**Creator side**
- One public page per handle at `/u/<username>`, with custom themes and presets.
- Links with drag-order, dividers, headers, thumbnails and click tracking.
- Digital products: free, paid, or link/code delivery, with file assets and sales counts.
- Traffic analytics: views, link clicks, product views, purchases, conversion and revenue.
- Orders and payouts view.
- Appearance editor; custom colours and custom domains are paid features.

**Buyer side**
- Storefront product pages with checkout through Midtrans Snap.
- Free-product claims that issue a download token and license key.
- A library at `/library` listing everything the buyer owns.
- Token-based downloads; bad or foreign tokens are rejected.

**Platform**
- Better Auth (email + password) with session cookies, plus the organizations plugin.
- Plan entitlements enforced server-side, not just in the UI.
- Midtrans webhooks verified with the SHA-512 signature and deduplicated by fingerprint.

## Plans

Plan ids and prices are load-bearing — checkout and webhooks reference them by id, so they
are not renamed. Only the display copy is OpenLynk's.

| Plan | Price | Links | Products | Analytics | Custom domain | Remove branding |
| --- | --- | --- | --- | --- | --- | --- |
| `free` | Rp 0 | 5 | 1 | none | no | no |
| `starter` | Rp 149,000/mo | 50 | 10 | basic | no | no |
| `pro` | Rp 499,000/mo | unlimited | 100 | advanced | yes | yes |

## Tech stack

- **Next.js 16** (App Router, Route Handlers, Cache Components, Partial Prefetching)
- **TypeScript 5** in strict mode
- **PostgreSQL + Drizzle ORM** with checked-in migrations
- **Better Auth** for sessions
- **Midtrans** for payments
- **Tailwind CSS v4** with shadcn/ui and ReUI components
- **Zod** for environment and payload validation
- **pnpm** as the package manager

## Getting started

```bash
pnpm install
cp .env.example .env.local   # then fill in the values below
pnpm db:migrate
pnpm dev
```

Required environment variables:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Session signing secret |
| `BETTER_AUTH_URL` | Public base URL |
| `CRON_SECRET` | Bearer token for the subscription sync cron |
| `MIDTRANS_SERVER_KEY` | Midtrans server key |
| `MIDTRANS_IS_PRODUCTION` | `false` for sandbox |
| `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` | Midtrans client key |
| `NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION` | Client-side sandbox flag |
| `NEXT_PUBLIC_APP_URL` | Public app URL used for links |

`src/env.ts` validates these at boot, so a missing value fails fast rather than at the
first request that needs it.

## Routes

Public pages: `/`, `/login`, `/register`, `/u/<username>`, `/u/<username>/<slug>`,
`/library`.

Dashboard: `/dashboard` plus `links`, `products`, `orders`, `analytics`, `appearance`,
`billing`, `settings`, `organizations`.

API: `/api/creator/*` for the dashboard, `/api/store/*` for checkout, claims and
downloads, `/api/events/link` for anonymous storefront tracking, `/api/library` for the
buyer's owned products, and `/api/webhooks/midtrans` for payment notifications.

## Scripts

```bash
pnpm dev          # development server
pnpm build        # production build
pnpm start        # serve the production build
pnpm lint         # eslint
pnpm typecheck    # tsc --noEmit
pnpm test         # node:test suite
pnpm db:migrate   # apply Drizzle migrations
pnpm db:generate  # generate a migration from schema changes
```

## Storefront caching

Public pages are cached with `use cache` and tagged per handle. Creator writes drop the
tag through `src/lib/storefront-cache.ts`, so an edit shows up on the next request instead
of waiting out `cacheLife`. The tag names live in that module so the read side and the
write side cannot drift apart.

