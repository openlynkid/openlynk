import type { Metadata } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/reui/badge";
import {
  Frame,
  FrameHeader,
  FrameTitle,
  FrameDescription,
  FramePanel,
} from "@/components/reui/frame";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import {
  BarChart3,
  CreditCard,
  ExternalLink,
  Link2,
  Palette,
  Receipt,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Dashboard Overview",
  description: "Your page, products, and audience at a glance.",
};

async function CreatorStatusCard() {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user;

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border/40 bg-muted/40 p-4 text-xs">
      <span className="font-semibold text-foreground">Signed in as</span>
      <div className="truncate font-mono text-[11px] text-muted-foreground">
        {user?.email ?? "Not signed in"}
      </div>
      <div className="truncate font-mono text-[11px] text-muted-foreground">
        ID: {user?.id ?? "—"}
      </div>
    </div>
  );
}

function CreatorStatusFallback() {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/40 bg-muted/40 p-4">
      <div className="h-3.5 w-24 animate-pulse rounded bg-muted" />
      <div className="h-3 w-44 animate-pulse rounded bg-muted" />
      <div className="h-3 w-36 animate-pulse rounded bg-muted" />
    </div>
  );
}

const QUICK_ACTIONS = [
  {
    href: "/dashboard/links",
    icon: Link2,
    title: "Links & Blocks",
    description: "Arrange the links on your bio page",
  },
  {
    href: "/dashboard/products",
    icon: ShoppingBag,
    title: "Digital Products",
    description: "Publish files, links, or licence keys",
  },
  {
    href: "/dashboard/appearance",
    icon: Palette,
    title: "Appearance",
    description: "Pick a theme and connect a domain",
  },
  {
    href: "/dashboard/analytics",
    icon: BarChart3,
    title: "Analytics",
    description: "See views, clicks, and conversions",
  },
  {
    href: "/dashboard/orders",
    icon: Receipt,
    title: "Orders",
    description: "Review sales and your payout",
  },
  {
    href: "/dashboard/billing",
    icon: CreditCard,
    title: "Billing & Plans",
    description: "Upgrade to unlock more limits",
  },
];

export default function DashboardOverviewPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Welcome to OpenLynk"
        description="One page for everything you create — links, digital products, and the audience that finds them."
        tag="openlynk"
        category="Creator dashboard"
      >
        <Link
          href="/dashboard/products"
          className={buttonVariants({
            variant: "default",
            size: "sm",
            className: "text-xs font-semibold gap-1.5",
          })}
        >
          <ShoppingBag className="size-3.5" />
          Add a product
        </Link>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Your page"
          value="/u/your-handle"
          description="Public link-in-bio address"
          icon={Link2}
          badge="Live"
        />
        <MetricCard
          title="Products"
          value="Sell instantly"
          description="Files, links, or licence keys"
          icon={ShoppingBag}
          badge="Midtrans"
        />
        <MetricCard
          title="Audience"
          value="Views & clicks"
          description="Per-day traffic and conversions"
          icon={BarChart3}
          badge="Analytics"
        />
        <MetricCard
          title="Payments"
          value="QRIS, VA, GoPay"
          description="Local checkout in rupiah"
          icon={CreditCard}
          badge="Snap"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Frame spacing="default" className="card-vercel border border-border/80 shadow-xs">
          <FramePanel className="flex flex-col gap-4">
            <FrameHeader className="flex flex-row items-center justify-between p-0">
              <div>
                <FrameTitle className="text-base font-bold">Quick actions</FrameTitle>
                <FrameDescription className="text-xs">
                  The things creators do most, one tap away.
                </FrameDescription>
              </div>
              <Badge variant="success-light" className="font-mono">
                Ready
              </Badge>
            </FrameHeader>

            <div className="flex flex-col gap-2">
              {QUICK_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="group flex items-center gap-3 rounded-lg border border-border/60 p-3 transition-colors hover:border-primary/50 hover:bg-muted/50"
                  >
                    <div className="rounded-md bg-primary/10 p-2 text-primary">
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{action.title}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {action.description}
                      </div>
                    </div>
                    <ExternalLink className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
                  </Link>
                );
              })}
            </div>
          </FramePanel>
        </Frame>

        <Card className="card-vercel rounded-xl border border-border/80 shadow-xs">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold">Your account</CardTitle>
              <Badge variant="outline" className="font-mono">
                Session
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Your OpenLynk page is tied to this account.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Suspense fallback={<CreatorStatusFallback />}>
              <CreatorStatusCard />
            </Suspense>

            <div className="flex items-start gap-2 rounded-lg border border-border/60 p-3 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Payments are collected by Midtrans, and files are delivered automatically once a
                payment is verified.
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
