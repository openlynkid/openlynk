import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/reui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { StudioBanner } from "@/components/studio-banner";
import { BrandLogo } from "@/components/brand-logo";
import { MobileNav } from "@/components/mobile-nav";
import { NavUserControls } from "@/components/nav-user-controls";
import { PricingSection } from "@/components/pricing-section";
import {
  ArrowRight,
  CreditCard,
  Database,
  Layers,
  Lock,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
  Terminal,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Modern Multi-Tenant SaaS Starter Kit",
  description:
    "Production-grade Next.js App Router template with Better Auth, PostgreSQL, Drizzle ORM, and Midtrans Snap integration.",
};

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground antialiased selection:bg-foreground selection:text-background">
      {/* 1. Top Announcement Bar */}
      <StudioBanner />

      {/* 2. Engineering Sticky Header with Hairline Border */}
      <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 min-[1400px]:border-x border-border/70 relative">
          <span className="grid-cross -bottom-[7px] -left-[7px] hidden min-[1400px]:flex">+</span>
          <span className="grid-cross -bottom-[7px] -right-[7px] hidden min-[1400px]:flex">+</span>

          {/* Logo & Brand */}
          <BrandLogo href="/" size="md" />

          {/* Navigation Pill Menu (Desktop) */}
          <nav className="hidden md:flex items-center gap-1 rounded-full border border-border/80 bg-background/60 px-3 py-1 shadow-xs backdrop-blur-sm">
            <a href="#features" className="rounded-full px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              Features
            </a>
            <a href="#showcase" className="rounded-full px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              Showcase
            </a>
            <a href="#architecture" className="rounded-full px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              Architecture
            </a>
            <a href="#pricing" className="rounded-full px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              Pricing
            </a>
          </nav>

          {/* Right Controls */}
          <div className="flex items-center gap-2">
            {/* Quick search shortcut button */}
            <button
              type="button"
              className="hidden lg:flex items-center gap-2 rounded-md border border-input/60 bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground shadow-xs hover:bg-muted hover:text-foreground transition-colors"
            >
              <Search className="size-3.5" />
              <span>Search docs...</span>
              <kbd className="pointer-events-none ml-2 rounded border border-border/80 bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground shadow-xs">
                ⌘K
              </kbd>
            </button>

            {/* Dark / Light Mode Toggle */}
            <div className="max-sm:hidden">
              <ThemeToggle />
            </div>

            {/* GitHub Link */}
            <a
              href="https://github.com/iwwwan-io/saas-starterkit"
              target="_blank"
              rel="noreferrer"
              className="inline-flex size-9 items-center justify-center rounded-md border border-input/60 bg-background/80 shadow-xs hover:bg-muted hover:text-foreground transition-colors max-sm:hidden"
              aria-label="GitHub Repository"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
                <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                <path d="M9 18c-4.51 2-5-2-7-2" />
              </svg>
            </a>

            <div className="h-4 w-px bg-border/60 max-sm:hidden" />

            {/* Dynamic Auth / Avatar + Active Plan Badge Controls */}
            <NavUserControls />

            {/* Mobile Navigation Drawer */}
            <MobileNav />
          </div>
        </div>
      </header>

      {/* Main Container with Vercel & Runeicon Hairline Guide Grid */}
      <main className="flex-1">
        <div className="mx-auto w-full max-w-7xl min-[1400px]:border-x border-border/70 relative">
          {/* HERO SECTION */}
          <section className="relative overflow-hidden pt-16 pb-20 md:pt-28 md:pb-28 border-b border-border/70 bg-grid-pattern vercel-spotlight">
            <span className="grid-cross -bottom-[7px] -left-[7px] hidden min-[1400px]:flex">+</span>
            <span className="grid-cross -bottom-[7px] -right-[7px] hidden min-[1400px]:flex">+</span>

            <div className="mx-auto flex max-w-5xl flex-col items-center px-4 text-center sm:px-6 lg:px-8 space-y-8 relative z-10">
              {/* Engineering Pill Badge */}
              <div className="inline-flex items-center gap-3 rounded-full border border-border/80 bg-background/80 px-3.5 py-1.5 shadow-xs backdrop-blur-sm">
                <div className="flex -space-x-2">
                  <div className="flex size-6 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-[9px] font-bold text-white ring-2 ring-background">
                    JD
                  </div>
                  <div className="flex size-6 items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 to-rose-500 text-[9px] font-bold text-white ring-2 ring-background">
                    AK
                  </div>
                  <div className="flex size-6 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-500 to-teal-500 text-[9px] font-bold text-white ring-2 ring-background">
                    SR
                  </div>
                  <div className="flex size-6 items-center justify-center rounded-full bg-foreground text-[9px] font-bold text-background ring-2 ring-background">
                    +
                  </div>
                </div>
                <div className="h-3 w-px bg-border/80" />
                <p className="text-xs font-medium text-muted-foreground">
                  Trusted by <span className="font-semibold text-foreground">1,600+</span> developers &amp; founders
                </p>
              </div>

              {/* High-Precision Headline */}
              <h1 className="max-w-4xl text-3xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl lg:leading-[1.12]">
                Build Futuristic SaaS at Warp Speed with{" "}
                <span className="bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-transparent underline decoration-border/80 underline-offset-8">
                  Next.js &amp; Midtrans
                </span>
              </h1>

              {/* High-Impact Subtitle */}
              <p className="max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed">
                Production-grade modular monolith featuring{" "}
                <Link href="#architecture" className="link-animated font-medium text-foreground">
                  Next.js 16 App Router
                </Link>
                ,{" "}
                <Link href="#features" className="link-animated font-medium text-foreground">
                  Better Auth multi-tenancy
                </Link>
                ,{" "}
                <Link href="#features" className="link-animated font-medium text-foreground">
                  Drizzle ORM
                </Link>
                , and a hardened{" "}
                <Link href="#showcase" className="link-animated font-medium text-foreground">
                  Midtrans billing lifecycle
                </Link>
                .
              </p>

              {/* Dual Action Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <Link
                  href="/register"
                  className="btn-vercel h-11 px-6 text-sm font-semibold rounded-lg flex items-center gap-2"
                >
                  <Sparkles className="size-4" />
                  Get All Access
                </Link>
                <Link
                  href="/dashboard"
                  className={buttonVariants({
                    variant: "secondary",
                    size: "lg",
                    className: "h-11 px-6 text-sm font-semibold gap-2 rounded-lg border border-border/80 shadow-xs hover:border-foreground/30 transition-colors",
                  })}
                >
                  Explore Live Dashboard
                  <ArrowRight className="size-4" />
                </Link>
              </div>

              {/* Technology Logo / Pill Strip with Monospace Typography */}
              <div className="pt-8 flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 text-xs text-muted-foreground">
                <span className="rounded-md border border-border/70 bg-card/60 px-2.5 py-1 font-mono text-[11px] shadow-2xs">Next.js 16</span>
                <span className="rounded-md border border-border/70 bg-card/60 px-2.5 py-1 font-mono text-[11px] shadow-2xs">TypeScript 5</span>
                <span className="rounded-md border border-border/70 bg-card/60 px-2.5 py-1 font-mono text-[11px] shadow-2xs">Better Auth</span>
                <span className="rounded-md border border-border/70 bg-card/60 px-2.5 py-1 font-mono text-[11px] shadow-2xs">Drizzle ORM</span>
                <span className="rounded-md border border-border/70 bg-card/60 px-2.5 py-1 font-mono text-[11px] shadow-2xs">PostgreSQL</span>
                <span className="rounded-md border border-border/70 bg-card/60 px-2.5 py-1 font-mono text-[11px] shadow-2xs">Midtrans Snap</span>
                <span className="rounded-md border border-border/70 bg-card/60 px-2.5 py-1 font-mono text-[11px] shadow-2xs">Tailwind CSS v4</span>
              </div>
            </div>
          </section>

          {/* 3. SHOWCASE MARQUEE (Interactive Blueprint Cards) */}
          <section id="showcase" className="py-14 border-b border-border/70 overflow-hidden bg-muted/20 relative">
            <span className="grid-cross -bottom-[7px] -left-[7px] hidden min-[1400px]:flex">+</span>
            <span className="grid-cross -bottom-[7px] -right-[7px] hidden min-[1400px]:flex">+</span>

            <div className="px-4 sm:px-6 lg:px-8 mb-6 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">[02] Interactive Architecture</p>
                <h2 className="text-xl font-bold tracking-tight">Production Modules in Action</h2>
              </div>
              <Badge variant="outline" className="font-mono text-[11px] hidden sm:inline-flex border-border/80">
                Hover to pause stream
              </Badge>
            </div>

            {/* Marquee Row with Precision Vercel Cards */}
            <div className="relative w-full overflow-hidden">
              <div className="flex w-max gap-4 animate-marquee p-2">
                {/* CARD 1: Midtrans Snap Payment Simulator */}
                <div className="card-vercel w-84 shrink-0 rounded-xl p-4 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="size-4 text-foreground" />
                      <span className="text-xs font-semibold">Midtrans Snap Checkout</span>
                    </div>
                    <Badge variant="success-light" className="font-mono">
                      Live Gateway
                    </Badge>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/50 p-2.5 text-xs space-y-1.5 font-mono">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Gross Amount:</span>
                      <span className="font-bold text-foreground">Rp 149.000</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Channels:</span>
                      <span className="text-foreground">QRIS, VA, CC, GoPay</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Signature:</span>
                      <span className="text-success-foreground dark:text-success truncate max-w-[120px]">SHA-512 OK</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                    <span>Terminal Status Machine</span>
                    <span className="text-foreground font-medium">Auto-Settlement</span>
                  </div>
                </div>

                {/* CARD 2: Subscription & Lifecycle Hardening */}
                <div className="card-vercel w-84 shrink-0 rounded-xl p-4 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="size-4 text-foreground" />
                      <span className="text-xs font-semibold">Lifecycle &amp; Entitlement</span>
                    </div>
                    <Badge variant="secondary" className="text-[10px] font-mono bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                      Phase 2.4.1
                    </Badge>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/50 p-2.5 text-xs space-y-1.5 font-mono">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Status:</span>
                      <span className="text-success-foreground dark:text-success font-bold">active</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Renewal Engine:</span>
                      <span className="text-foreground">UTC Calendar Clamping</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Full Refund:</span>
                      <span className="text-destructive-foreground dark:text-destructive">Auto-Revocation</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                    <span>Row Lock Guard</span>
                    <span className="font-medium text-foreground">SELECT FOR UPDATE</span>
                  </div>
                </div>

                {/* CARD 3: Multi-Tenant Organizations */}
                <div className="card-vercel w-84 shrink-0 rounded-xl p-4 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="size-4 text-foreground" />
                      <span className="text-xs font-semibold">Multi-Tenant Workspaces</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      Better Auth
                    </Badge>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/50 p-2.5 text-xs space-y-1.5 font-mono">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Current Org:</span>
                      <span className="text-foreground font-semibold">Acme Labs Inc</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Member Role:</span>
                      <span className="text-foreground">Owner / Billing Admin</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Isolation:</span>
                      <span className="text-success-foreground dark:text-success">100% Tenant Scoped</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                    <span>Role Verification</span>
                    <span className="font-medium text-foreground">Strict 403 Guards</span>
                  </div>
                </div>

                {/* CARD 4: Drizzle ORM & Postgres Migrations */}
                <div className="card-vercel w-84 shrink-0 rounded-xl p-4 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Database className="size-4 text-foreground" />
                      <span className="text-xs font-semibold">Drizzle ORM Engine</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      PostgreSQL
                    </Badge>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/50 p-2.5 text-xs space-y-1.5 font-mono">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Pooler Mode:</span>
                      <span className="text-foreground">prepare: false</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Migrations:</span>
                      <span className="text-foreground">Journaled (0000-0002)</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Serverless Sync:</span>
                      <span className="text-success-foreground dark:text-success">PgBouncer Safe</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                    <span>Zero Data Leaks</span>
                    <span className="font-medium text-foreground">100% Type-Safe</span>
                  </div>
                </div>

                {/* DUPLICATE SET FOR SEAMLESS CONTINUOUS MARQUEE LOOP */}
                <div className="card-vercel w-84 shrink-0 rounded-xl p-4 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="size-4 text-foreground" />
                      <span className="text-xs font-semibold">Midtrans Snap Checkout</span>
                    </div>
                    <Badge variant="success-light" className="font-mono">
                      Live Gateway
                    </Badge>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/50 p-2.5 text-xs space-y-1.5 font-mono">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Gross Amount:</span>
                      <span className="font-bold text-foreground">Rp 149.000</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Channels:</span>
                      <span className="text-foreground">QRIS, VA, CC, GoPay</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Signature:</span>
                      <span className="text-success-foreground dark:text-success truncate max-w-[120px]">SHA-512 OK</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                    <span>Terminal Status Machine</span>
                    <span className="text-foreground font-medium">Auto-Settlement</span>
                  </div>
                </div>

                <div className="card-vercel w-84 shrink-0 rounded-xl p-4 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="size-4 text-foreground" />
                      <span className="text-xs font-semibold">Lifecycle &amp; Entitlement</span>
                    </div>
                    <Badge variant="secondary" className="text-[10px] font-mono bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                      Phase 2.4.1
                    </Badge>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/50 p-2.5 text-xs space-y-1.5 font-mono">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Status:</span>
                      <span className="text-success-foreground dark:text-success font-bold">active</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Renewal Engine:</span>
                      <span className="text-foreground">UTC Calendar Clamping</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Full Refund:</span>
                      <span className="text-destructive-foreground dark:text-destructive">Auto-Revocation</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                    <span>Row Lock Guard</span>
                    <span className="font-medium text-foreground">SELECT FOR UPDATE</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 4. FEATURES BENTO GRID (Precision Layout Lines) */}
          <section id="features" className="py-20 border-b border-border/70 relative">
            <span className="grid-cross -bottom-[7px] -left-[7px] hidden min-[1400px]:flex">+</span>
            <span className="grid-cross -bottom-[7px] -right-[7px] hidden min-[1400px]:flex">+</span>

            <div className="px-4 sm:px-6 lg:px-8 space-y-12">
              <div className="text-center space-y-3 max-w-3xl mx-auto">
                <div className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  <span>[01]</span>
                  <span>Production Engineering</span>
                </div>
                <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                  Engineered for Real-World SaaS Reliability
                </h2>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Stop reinventing payment webhooks, database row locking, session security, and organization hierarchies.
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card className="card-vercel shadow-xs group">
                  <CardHeader>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-foreground/5 text-foreground group-hover:scale-105 transition-transform">
                        <CreditCard className="size-5" />
                      </div>
                      <span className="font-mono text-[10px] text-muted-foreground/60">[01.1]</span>
                    </div>
                    <CardTitle className="text-lg">Midtrans Snap Payment Gateway</CardTitle>
                    <CardDescription className="text-xs leading-relaxed">
                      Complete integration for Virtual Accounts, QRIS, GoPay, and Credit Cards. Automated SHA-512 signature verification and idempotent webhook processing.
                    </CardDescription>
                  </CardHeader>
                </Card>

                <Card className="card-vercel shadow-xs group">
                  <CardHeader>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-foreground/5 text-foreground group-hover:scale-105 transition-transform">
                        <Lock className="size-5" />
                      </div>
                      <span className="font-mono text-[10px] text-muted-foreground/60">[01.2]</span>
                    </div>
                    <CardTitle className="text-lg">Better Auth Security Suite</CardTitle>
                    <CardDescription className="text-xs leading-relaxed">
                      Rock-solid cookie-based session management, password hashing, and token rotation. Multi-tenant workspace support with strict role-based access control.
                    </CardDescription>
                  </CardHeader>
                </Card>

                <Card className="card-vercel shadow-xs group">
                  <CardHeader>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-foreground/5 text-foreground group-hover:scale-105 transition-transform">
                        <ShieldCheck className="size-5" />
                      </div>
                      <span className="font-mono text-[10px] text-muted-foreground/60">[01.3]</span>
                    </div>
                    <CardTitle className="text-lg">Lifecycle &amp; Refund Protection</CardTitle>
                    <CardDescription className="text-xs leading-relaxed">
                      Full refund immediately revokes entitlement and prevents reactivation from late settlement payloads. Deterministic UTC renewal extension with month-end clamping.
                    </CardDescription>
                  </CardHeader>
                </Card>

                <Card className="card-vercel shadow-xs group">
                  <CardHeader>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-foreground/5 text-foreground group-hover:scale-105 transition-transform">
                        <Database className="size-5" />
                      </div>
                      <span className="font-mono text-[10px] text-muted-foreground/60">[01.4]</span>
                    </div>
                    <CardTitle className="text-lg">Drizzle ORM &amp; Migrations</CardTitle>
                    <CardDescription className="text-xs leading-relaxed">
                      Strictly typed SQL schema, automated migration journal, and connection pooling prepared for Prisma Postgres, Supabase, Neon, and AWS RDS.
                    </CardDescription>
                  </CardHeader>
                </Card>

                <Card className="card-vercel shadow-xs group">
                  <CardHeader>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-foreground/5 text-foreground group-hover:scale-105 transition-transform">
                        <Layers className="size-5" />
                      </div>
                      <span className="font-mono text-[10px] text-muted-foreground/60">[01.5]</span>
                    </div>
                    <CardTitle className="text-lg">Modular Monolith Architecture</CardTitle>
                    <CardDescription className="text-xs leading-relaxed">
                      Domain logic is segregated cleanly under <code>src/modules/</code>, decoupling business workflows from UI presentation and routing.
                    </CardDescription>
                  </CardHeader>
                </Card>

                <Card className="card-vercel shadow-xs group">
                  <CardHeader>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-foreground/5 text-foreground group-hover:scale-105 transition-transform">
                        <Zap className="size-5" />
                      </div>
                      <span className="font-mono text-[10px] text-muted-foreground/60">[01.6]</span>
                    </div>
                    <CardTitle className="text-lg">Zero-Config Deployment</CardTitle>
                    <CardDescription className="text-xs leading-relaxed">
                      Next.js 16 with Turbopack, Zod runtime environment variable validation, and complete GitHub Actions CI with ephemeral PostgreSQL integration tests.
                    </CardDescription>
                  </CardHeader>
                </Card>
              </div>
            </div>
          </section>

          {/* 5. ARCHITECTURE SPEC & CODE PREVIEW (Runeicon / Developer Terminal Style) */}
          <section id="architecture" className="py-20 border-b border-border/70 bg-muted/10 relative">
            <span className="grid-cross -bottom-[7px] -left-[7px] hidden min-[1400px]:flex">+</span>
            <span className="grid-cross -bottom-[7px] -right-[7px] hidden min-[1400px]:flex">+</span>

            <div className="px-4 sm:px-6 lg:px-8 space-y-10">
              <div className="max-w-3xl space-y-3">
                <div className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  <span>[03]</span>
                  <span>Clean Architecture</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  Modular Domain Layering
                </h2>
                <p className="text-sm text-muted-foreground">
                  Every feature has a home. Business operations remain testable, isolated, and safe from unintended side effects.
                </p>
              </div>

              {/* Developer Terminal Window with Precision Border */}
              <div className="rounded-xl border border-border/80 bg-card shadow-sm overflow-hidden font-mono text-xs card-vercel">
                <div className="flex items-center justify-between border-b border-border/70 bg-muted/40 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full bg-rose-500/80 inline-block" />
                    <span className="size-2.5 rounded-full bg-amber-500/80 inline-block" />
                    <span className="size-2.5 rounded-full bg-emerald-500/80 inline-block" />
                    <span className="ml-2 text-muted-foreground text-[11px] font-mono">saas-starterkit / src / modules / billing / service.ts</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Terminal className="size-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground font-mono">TypeScript</span>
                  </div>
                </div>
                <div className="p-4 sm:p-6 overflow-x-auto text-muted-foreground leading-relaxed space-y-1 font-mono text-[12px]">
                  <p className="text-indigo-400">export class <span className="text-foreground font-semibold">BillingService</span> &#123;</p>
                  <p className="pl-4 text-muted-foreground/70">&#47;&#47; Centralized entitlement check enforcing strict UTC expiration</p>
                  <p className="pl-4"><span className="text-blue-400">async</span> <span className="text-amber-300">checkEntitlement</span>(params: &#123; userId?: string; organizationId?: string &#125;) &#123;</p>
                  <p className="pl-8"><span className="text-blue-400">const</span> sub = <span className="text-blue-400">await</span> <span className="text-foreground">this</span>.getActiveSubscription(params);</p>
                  <p className="pl-8"><span className="text-purple-400">return</span> &#123; hasAccess: !!sub, planId: sub?.planId ?? <span className="text-rose-400">null</span> &#125;;</p>
                  <p className="pl-4">&#125;</p>
                  <p className="pl-4 text-muted-foreground/70">&#47;&#47; Midtrans Webhook processor with row-level locking &amp; idempotency</p>
                  <p className="pl-4"><span className="text-blue-400">async</span> <span className="text-amber-300">processWebhookNotification</span>(payload: MidtransNotificationPayload) &#123;</p>
                  <p className="pl-8"><span className="text-blue-400">return</span> <span className="text-blue-400">await</span> <span className="text-foreground">this</span>.db.transaction(<span className="text-blue-400">async</span> (tx) =&gt; &#123;</p>
                  <p className="pl-12 text-emerald-400">&#47;&#47; SELECT ... FOR UPDATE prevents race conditions on concurrent webhooks</p>
                  <p className="pl-12"><span className="text-blue-400">const</span> [order] = <span className="text-blue-400">await</span> tx.select().from(orderTable).where(...).for(<span className="text-emerald-300">&quot;update&quot;</span>);</p>
                  <p className="pl-12 text-muted-foreground/60">...</p>
                  <p className="pl-8">&#125;);</p>
                  <p className="pl-4">&#125;</p>
                  <p className="text-indigo-400">&#125;</p>
                </div>
              </div>
            </div>
          </section>

          {/* 6. PRICING SECTION (Vercel Precision Pricing Cards) */}
          <PricingSection />

          {/* 7. ENGINEERING FOOTER */}
          <footer className="py-12 px-4 sm:px-6 lg:px-8 text-xs text-muted-foreground">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-success inline-block animate-pulse" />
                <span>All systems operational</span>
                <span className="text-border">|</span>
                <span className="font-mono text-[11px]">saas/studio v2.4</span>
              </div>
              <div className="flex items-center gap-4">
                <Link href="/dashboard" className="hover:text-foreground transition-colors">
                  Dashboard
                </Link>
                <Link href="/login" className="hover:text-foreground transition-colors">
                  Sign In
                </Link>
                <Link href="/register" className="hover:text-foreground transition-colors">
                  Sign Up
                </Link>
                <a
                  href="https://github.com/iwwwan-io/saas-starterkit"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-foreground transition-colors"
                >
                  GitHub
                </a>
              </div>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}
