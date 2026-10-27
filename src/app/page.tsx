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
  BarChart3,
  FileDown,
  Globe,
  Layers,
  Link2,
  Palette,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
} from "lucide-react";

export const metadata: Metadata = {
  title: "OpenLynk — Link-in-Bio & Digital Product Store for Creators",
  description:
    "Build a link-in-bio page and sell digital products in one place. Share links, deliver files, and grow your audience with OpenLynk.",
};

/**
 * The showcase cards are declared as data so the marquee can render the same list twice —
 * the second copy is what makes the CSS animation loop seamlessly, and duplicating JSX by
 * hand is how the two copies drift apart.
 */
const SHOWCASE_CARDS = [
  {
    icon: Link2,
    title: "Link-in-Bio Page",
    badge: "Drag to reorder",
    badgeVariant: "outline" as const,
    rows: [
      ["Page handle", "openlynk.id/u/kamu"],
      ["Links", "Unlimited blocks"],
      ["Blocks", "Header, link, divider"],
    ],
    footer: ["Live preview", "Mobile-first"],
  },
  {
    icon: ShoppingBag,
    title: "Digital Product Store",
    badge: "Midtrans Snap",
    badgeVariant: "success-light" as const,
    rows: [
      ["Checkout", "QRIS, VA, GoPay"],
      ["Delivery", "File, link, or code"],
      ["Licence key", "Auto-generated"],
    ],
    footer: ["Guest checkout", "Instant delivery"],
  },
  {
    icon: BarChart3,
    title: "Audience Analytics",
    badge: "Realtime",
    badgeVariant: "secondary" as const,
    rows: [
      ["Page views", "30-day trend"],
      ["Top links", "Click ranking"],
      ["Audience", "Device & country"],
    ],
    footer: ["Conversion rate", "Revenue per product"],
  },
  {
    icon: Palette,
    title: "Themes & Custom Domain",
    badge: "Pro",
    badgeVariant: "outline" as const,
    rows: [
      ["Presets", "5 ready themes"],
      ["Branding", "Custom accent colour"],
      ["Domain", "links.namamu.com"],
    ],
    footer: ["Remove OpenLynk badge", "SEO ready"],
  },
];

const FEATURE_CARDS = [
  {
    icon: Link2,
    index: "[01.1]",
    title: "A link-in-bio page that loads fast",
    description:
      "Build a page of links, headers and dividers, then drag them into the order you want. Every change is live the moment you save it.",
  },
  {
    icon: ShoppingBag,
    index: "[01.2]",
    title: "Sell digital products instantly",
    description:
      "Upload files, share a private link, or hand out licence keys. Buyers pay with QRIS, virtual account, e-wallet or card through Midtrans Snap.",
  },
  {
    icon: FileDown,
    index: "[01.3]",
    title: "Delivery happens automatically",
    description:
      "A verified payment creates the buyer's entitlement, mints the licence key, and unlocks a secure download link. No manual step for you.",
  },
  {
    icon: BarChart3,
    index: "[01.4]",
    title: "Know what your audience clicks",
    description:
      "See page views, your best-performing links, which products sell, and where visitors come from — measured per day, not in aggregate.",
  },
  {
    icon: Palette,
    index: "[01.5]",
    title: "A page that looks like your brand",
    description:
      "Pick a theme preset, set your accent colour, and drop the OpenLynk badge on Pro. Your page, not a template with your name on it.",
  },
  {
    icon: ShieldCheck,
    index: "[01.6]",
    title: "Secure payments by default",
    description:
      "Signature-verified webhooks, idempotent fulfilment, and row-level locking mean a replayed notification can never charge or deliver twice.",
  },
];

const STEPS = [
  {
    step: "01",
    icon: Globe,
    title: "Claim your handle",
    body: "Choose openlynk.id/u/yourname, or connect your own domain on Pro. Reserved platform names are blocked so nobody can impersonate OpenLynk.",
  },
  {
    step: "02",
    icon: Layers,
    title: "Arrange your page",
    body: "Add links, headers and dividers, then drag them into order. Pick a theme preset and an accent colour that matches your brand.",
  },
  {
    step: "03",
    icon: ShoppingBag,
    title: "Sell and get paid",
    body: "Publish a product, set the price in rupiah, and share the link. Midtrans collects the payment and OpenLynk delivers the file automatically.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground antialiased selection:bg-foreground selection:text-background">
      {/* 1. Top Announcement Bar */}
      <StudioBanner />

      {/* 2. Sticky Header with Hairline Border */}
      <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 min-[1400px]:border-x border-border/70 relative">
          <span className="grid-cross -bottom-[7px] -left-[7px] hidden min-[1400px]:flex">+</span>
          <span className="grid-cross -bottom-[7px] -right-[7px] hidden min-[1400px]:flex">+</span>

          <BrandLogo href="/" size="md" />

          <nav className="hidden md:flex items-center gap-1 rounded-full border border-border/80 bg-background/60 px-3 py-1 shadow-xs backdrop-blur-sm">
            <a href="#features" className="rounded-full px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              Features
            </a>
            <a href="#showcase" className="rounded-full px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              Product
            </a>
            <a href="#creators" className="rounded-full px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              Creators
            </a>
            <a href="#pricing" className="rounded-full px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              Pricing
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <div className="max-sm:hidden">
              <ThemeToggle />
            </div>

            <div className="h-4 w-px bg-border/60 max-sm:hidden" />

            <NavUserControls />

            <MobileNav />
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto w-full max-w-7xl min-[1400px]:border-x border-border/70 relative">
          {/* HERO SECTION */}
          <section className="relative overflow-hidden pt-16 pb-20 md:pt-28 md:pb-28 border-b border-border/70 bg-grid-pattern vercel-spotlight">
            <span className="grid-cross -bottom-[7px] -left-[7px] hidden min-[1400px]:flex">+</span>
            <span className="grid-cross -bottom-[7px] -right-[7px] hidden min-[1400px]:flex">+</span>

            <div className="mx-auto flex max-w-5xl flex-col items-center px-4 text-center sm:px-6 lg:px-8 space-y-8 relative z-10">
              <div className="inline-flex items-center gap-3 rounded-full border border-border/80 bg-background/80 px-3.5 py-1.5 shadow-xs backdrop-blur-sm">
                <div className="flex -space-x-2">
                  <div className="flex size-6 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-[9px] font-bold text-white ring-2 ring-background">
                    RA
                  </div>
                  <div className="flex size-6 items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 to-rose-500 text-[9px] font-bold text-white ring-2 ring-background">
                    DP
                  </div>
                  <div className="flex size-6 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-500 to-teal-500 text-[9px] font-bold text-white ring-2 ring-background">
                    SN
                  </div>
                  <div className="flex size-6 items-center justify-center rounded-full bg-foreground text-[9px] font-bold text-background ring-2 ring-background">
                    +
                  </div>
                </div>
                <div className="h-3 w-px bg-border/80" />
                <p className="text-xs font-medium text-muted-foreground">
                  Trusted by <span className="font-semibold text-foreground">2,400+</span> creators
                </p>
              </div>

              <h1 className="max-w-4xl text-3xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl lg:leading-[1.12]">
                One link for everything you create —{" "}
                <span className="bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-transparent underline decoration-border/80 underline-offset-8">
                  and everything you sell
                </span>
              </h1>

              <p className="max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed">
                OpenLynk gives you a{" "}
                <Link href="#showcase" className="link-animated font-medium text-foreground">
                  link-in-bio page
                </Link>
                , a{" "}
                <Link href="#features" className="link-animated font-medium text-foreground">
                  digital product store
                </Link>
                , and the{" "}
                <Link href="#creators" className="link-animated font-medium text-foreground">
                  analytics
                </Link>{" "}
                to grow your audience. Payments are handled locally by Midtrans — QRIS, virtual
                account, e-wallet, and card.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <Link
                  href="/register"
                  className="btn-vercel h-11 px-6 text-sm font-semibold rounded-lg flex items-center gap-2"
                >
                  <Sparkles className="size-4" />
                  Claim your handle
                </Link>
                <Link
                  href="#pricing"
                  className={buttonVariants({
                    variant: "secondary",
                    size: "lg",
                    className: "h-11 px-6 text-sm font-semibold gap-2 rounded-lg border border-border/80 shadow-xs hover:border-foreground/30 transition-colors",
                  })}
                >
                  See pricing
                  <ArrowRight className="size-4" />
                </Link>
              </div>

              <div className="pt-8 flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 text-xs text-muted-foreground">
                <span className="rounded-md border border-border/70 bg-card/60 px-2.5 py-1 font-mono text-[11px] shadow-2xs">Link-in-bio</span>
                <span className="rounded-md border border-border/70 bg-card/60 px-2.5 py-1 font-mono text-[11px] shadow-2xs">Digital products</span>
                <span className="rounded-md border border-border/70 bg-card/60 px-2.5 py-1 font-mono text-[11px] shadow-2xs">QRIS &amp; VA</span>
                <span className="rounded-md border border-border/70 bg-card/60 px-2.5 py-1 font-mono text-[11px] shadow-2xs">Instant delivery</span>
                <span className="rounded-md border border-border/70 bg-card/60 px-2.5 py-1 font-mono text-[11px] shadow-2xs">Custom domain</span>
                <span className="rounded-md border border-border/70 bg-card/60 px-2.5 py-1 font-mono text-[11px] shadow-2xs">Audience analytics</span>
              </div>
            </div>
          </section>

          {/* 3. SHOWCASE MARQUEE */}
          <section id="showcase" className="py-14 border-b border-border/70 overflow-hidden bg-muted/20 relative">
            <span className="grid-cross -bottom-[7px] -left-[7px] hidden min-[1400px]:flex">+</span>
            <span className="grid-cross -bottom-[7px] -right-[7px] hidden min-[1400px]:flex">+</span>

            <div className="px-4 sm:px-6 lg:px-8 mb-6 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">[02] What you get</p>
                <h2 className="text-xl font-bold tracking-tight">Your page, store, and stats in one place</h2>
              </div>
              <Badge variant="outline" className="font-mono text-[11px] hidden sm:inline-flex border-border/80">
                Hover to pause
              </Badge>
            </div>

            <div className="relative w-full overflow-hidden">
              <div className="flex w-max gap-4 animate-marquee p-2">
                {[...SHOWCASE_CARDS, ...SHOWCASE_CARDS].map((card, cardIndex) => {
                  const Icon = card.icon;
                  return (
                    <div
                      key={`${card.title}-${cardIndex}`}
                      className="card-vercel w-84 shrink-0 rounded-xl p-4 shadow-xs space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="size-4 text-foreground" />
                          <span className="text-xs font-semibold">{card.title}</span>
                        </div>
                        <Badge variant={card.badgeVariant} className="font-mono text-[10px]">
                          {card.badge}
                        </Badge>
                      </div>
                      <div className="rounded-lg border border-border/60 bg-background/50 p-2.5 text-xs space-y-1.5 font-mono">
                        {card.rows.map(([label, value]) => (
                          <div key={label} className="flex justify-between text-muted-foreground">
                            <span>{label}:</span>
                            <span className="text-foreground truncate max-w-[150px]">{value}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                        <span>{card.footer[0]}</span>
                        <span className="text-foreground font-medium">{card.footer[1]}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* 4. FEATURES GRID */}
          <section id="features" className="py-20 border-b border-border/70 relative">
            <span className="grid-cross -bottom-[7px] -left-[7px] hidden min-[1400px]:flex">+</span>
            <span className="grid-cross -bottom-[7px] -right-[7px] hidden min-[1400px]:flex">+</span>

            <div className="px-4 sm:px-6 lg:px-8 space-y-12">
              <div className="text-center space-y-3 max-w-3xl mx-auto">
                <div className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  <span>[01]</span>
                  <span>Built for creators</span>
                </div>
                <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                  Everything you need to publish and get paid
                </h2>
                <p className="text-sm sm:text-base text-muted-foreground">
                  No plugins, no integrations to wire up, and no payment processor abroad.
                  Just your page, your products, and your money.
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {FEATURE_CARDS.map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <Card key={feature.index} className="card-vercel shadow-xs group">
                      <CardHeader>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex size-10 items-center justify-center rounded-lg bg-foreground/5 text-foreground group-hover:scale-105 transition-transform">
                            <Icon className="size-5" />
                          </div>
                          <span className="font-mono text-[10px] text-muted-foreground/60">{feature.index}</span>
                        </div>
                        <CardTitle className="text-lg">{feature.title}</CardTitle>
                        <CardDescription className="text-xs leading-relaxed">
                          {feature.description}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  );
                })}
              </div>
            </div>
          </section>

          {/* 5. HOW IT WORKS */}
          <section id="creators" className="py-20 border-b border-border/70 bg-muted/10 relative">
            <span className="grid-cross -bottom-[7px] -left-[7px] hidden min-[1400px]:flex">+</span>
            <span className="grid-cross -bottom-[7px] -right-[7px] hidden min-[1400px]:flex">+</span>

            <div className="px-4 sm:px-6 lg:px-8 space-y-10">
              <div className="max-w-3xl space-y-3">
                <div className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  <span>[03]</span>
                  <span>Three steps</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  Live in minutes, not weekends
                </h2>
                <p className="text-sm text-muted-foreground">
                  Claim your handle, arrange your links and products, then share one address
                  everywhere you already post.
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                {STEPS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Card key={item.step} className="card-vercel shadow-xs">
                      <CardHeader>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-mono text-[11px] text-muted-foreground">{item.step}</span>
                          <div className="flex size-9 items-center justify-center rounded-lg bg-foreground/5 text-foreground">
                            <Icon className="size-4" />
                          </div>
                        </div>
                        <CardTitle className="text-base">{item.title}</CardTitle>
                        <CardDescription className="text-xs leading-relaxed">
                          {item.body}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  );
                })}
              </div>
            </div>
          </section>

          {/* 6. PRICING SECTION */}
          <PricingSection />

          {/* 7. FOOTER */}
          <footer className="py-12 px-4 sm:px-6 lg:px-8 text-xs text-muted-foreground">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-success inline-block animate-pulse" />
                <span>All systems operational</span>
                <span className="text-border">|</span>
                <span className="font-mono text-[11px]">OpenLynk v1.0</span>
              </div>
              <div className="flex items-center gap-4">
                <Link href="/dashboard" className="hover:text-foreground transition-colors">
                  Dashboard
                </Link>
                <Link href="/library" className="hover:text-foreground transition-colors">
                  My Library
                </Link>
                <Link href="/login" className="hover:text-foreground transition-colors">
                  Sign In
                </Link>
                <Link href="/register" className="hover:text-foreground transition-colors">
                  Sign Up
                </Link>
              </div>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}
