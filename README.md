# Reusable SaaS Starter Kit (Next.js, Better Auth, Drizzle, Midtrans)

A production-ready **GitHub Template Repository** designed to launch modern SaaS applications in record time. Built as a **modular monolith** with end-to-end TypeScript, optional multi-tenancy, and Indonesian payment gateway support via Midtrans.

---

## 🚀 Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router, Server Actions, Route Handlers)
- **Language:** TypeScript 5 (Strict Mode)
- **Package Manager:** `pnpm`
- **UI Components:** [shadcn/ui](https://ui.shadcn.com/) + Tailwind CSS v4 + Lucide Icons
- **Database & ORM:** PostgreSQL + [Drizzle ORM](https://orm.drizzle.team/) + Drizzle Kit
- **Authentication:** [Better Auth](https://better-auth.com/) (Email & Password, Session Cookies, Multi-Tenant Organizations Plugin)
- **Payment Gateway:** [Midtrans](https://midtrans.com/) (Snap API & Core Webhooks with SHA-512 signature verification)
- **Validation:** [Zod](https://zod.dev/) for environment and request payloads
- **Deployment:** Vercel (Edge/Serverless-optimized connection pooling)

---

## 📁 Modular Monolith Architecture

The repository enforces clean domain boundaries to prevent tangled dependencies:

```text
src/
├── app/                             # Next.js App Router (Routes & Layouts)
│   ├── api/
│   │   ├── auth/[...all]/           # Better Auth Catch-All API Handler
│   │   ├── billing/
│   │   │   ├── checkout/            # Checkout Session Creation Route
│   │   │   └── subscription/        # Active Subscription Query Route
│   │   └── webhooks/
│   │       └── midtrans/            # Idempotent Midtrans Webhook Handler
│   ├── dashboard/                   # Authenticated SaaS Dashboard
│   │   ├── billing/                 # Midtrans Snap Payment & Plan Management
│   │   ├── organizations/           # Multi-tenant Team & Member Management
│   │   └── page.tsx                 # Overview & KPI Metrics
│   ├── login/                       # Sign In Page
│   ├── register/                    # Sign Up Page
│   └── page.tsx                     # High-Converting SaaS Landing Page
├── components/
│   └── ui/                          # shadcn/ui Primitives (Button, Card, Dialog, etc.)
├── env.ts                           # Typed Zod Environment Schema Validation
├── lib/
│   ├── auth-client.ts               # Better Auth Client Hooks & Plugins
│   └── utils.ts                     # UI Classname Merging (cn)
├── modules/                         # Core Business Domains
│   └── billing/
│       ├── midtrans-client.ts       # Midtrans Snap & Core API Client
│       ├── plans.ts                 # Pricing Tier Configurations (IDR)
│       ├── service.ts               # Order Generation & Webhook Processing
│       ├── snap-script.tsx          # Midtrans Snap Script Loader
│       └── types.ts                 # Domain Type Definitions
└── server/
    ├── auth/                        # Better Auth Server Configuration
    └── db/
        ├── index.ts                 # Drizzle Client + Serverless Connection Pool
        ├── migrations/              # SQL Migration Files
        └── schema/                  # Modular DB Tables (auth, orgs, billing)
```

---

## ⚡ Quick Start

### 1. Prerequisites
- **Node.js**: `v22.x` (LTS recommended)
- **pnpm**: `v12.x`
- **PostgreSQL**: Local instance, Neon, Supabase, or AWS RDS

### 2. Clone and Install Dependencies

```bash
git clone <your-repo-url> my-saas-app
cd my-saas-app
pnpm install
```

### 3. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env.local
```

Update `.env.local` with your credentials:

```ini
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
BETTER_AUTH_SECRET=generate_with_openssl_rand_base64_32

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/saas_starterkit

MIDTRANS_SERVER_KEY=SB-Mid-server-xxxxxxxxxxxx
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxxxxxxxxxx
MIDTRANS_IS_PRODUCTION=false
```

### 4. Database Setup & Migrations

Generate and run migrations against your PostgreSQL database:

```bash
# Push schema directly in development:
pnpm run db:push

# Or generate and run versioned migrations:
pnpm run db:generate
pnpm run db:migrate

# Open Drizzle Studio to inspect data:
pnpm run db:studio
```

### 5. Run Development Server

```bash
pnpm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to view the landing page and register an account.

---

## 💳 Midtrans Payment Gateway Integration

### Midtrans Sandbox Setup
1. Register at [Midtrans Merchant Dashboard](https://dashboard.midtrans.com/).
2. Switch to **Sandbox** mode.
3. Obtain your **Server Key** and **Client Key** under *Settings > Access Keys*.
4. Set your Payment Notification Webhook URL in Midtrans Dashboard (*Settings > Configuration*):
   ```text
   https://<your-domain-or-ngrok>/api/webhooks/midtrans
   ```

### Webhook Signature Verification
The webhook handler (`src/app/api/webhooks/midtrans/route.ts`) cryptographically validates notifications:
$$\text{Signature} = \text{SHA512}(\text{order\_id} + \text{status\_code} + \text{gross\_amount} + \text{ServerKey})$$

If the signature fails, the request is rejected with HTTP 400. All raw notifications are logged in the `webhook_event` table for auditability and idempotency.

### Testing in Sandbox
- **Credit Card:** Use test card `4811 1111 1111 1114`, CVV `123`, OTP `112233`.
- **Bank Virtual Accounts:** Use the [Midtrans Payment Simulator](https://simulator.sandbox.midtrans.com/openapi/va/index).
- **QRIS / GoPay:** Use the Midtrans QRIS Simulator simulator to approve payments.

---

## 🛡️ Multi-Tenancy & Authorization

- **Personal Accounts:** By default, every user has an independent workspace for personal projects.
- **Organizations:** Users can optionally create organizations under `/dashboard/organizations`, invite team members via email, and assign roles (`owner`, `admin`, `member`).
- **Flexible Billing:** Subscriptions can belong either directly to an individual user or to a shared organization workspace.

---

## ☁️ Deployment on Vercel

1. Push your repository to GitHub.
2. Import the repository into [Vercel](https://vercel.com).
3. Set the Environment Variables (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `MIDTRANS_SERVER_KEY`, `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`, `MIDTRANS_IS_PRODUCTION`, `CRON_SECRET`).
4. Ensure your PostgreSQL connection string utilizes a pooler (e.g., Neon or Supabase Transaction Pooler on port 6543) to avoid connection exhaustion in serverless functions.
5. Apply the database migrations before the app serves traffic (see below).
6. Deploy!

### Database migrations

A build can succeed while the database is still empty, so the schema is not applied
for you. Run the migrations against the target database before or during the release:

```sh
DATABASE_URL="<target database>" pnpm db:migrate
```

Recommended setups, best first:

- **CI/CD step**: run `pnpm db:migrate` in your pipeline after the build and before
  promoting the deployment. Migrations are additive and tracked in
  `src/server/db/migrations/meta`, so re-running them is safe.
- **Vercel**: add the same command as a release step in your pipeline, or run it once
  from a machine that can reach the database. Prefer a dedicated deploy job over
  putting it in `pnpm build`, which runs in the build container on every deploy.

`pnpm db:push` is for local prototyping only: it writes the schema directly and
skips the migration history, which will drift from what production has applied.

### Cron

`vercel.json` schedules `/api/billing/cron/sync-expired` daily. Vercel sends the
`CRON_SECRET` as a Bearer token when that variable is set on the project; without
it the endpoint returns HTTP 500 rather than running unauthenticated.

---

## 📜 Scripts

| Command | Description |
| :--- | :--- |
| `pnpm dev` | Run development server with Turbopack |
| `pnpm build` | Create optimized production build |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint checks |
| `pnpm typecheck` | Run TypeScript compiler type checking |
| `pnpm db:generate` | Generate SQL migrations from Drizzle schemas |
| `pnpm db:migrate` | Execute pending Drizzle migrations |
| `pnpm db:push` | Sync schema definitions directly to database |
| `pnpm db:studio` | Launch Drizzle Studio web GUI |

---

## License

MIT License. Free to use as a template for commercial and open-source SaaS products.
