"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/reui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/reui/alert";
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { MetricCard } from "@/components/metric-card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3,
  Eye,
  MousePointerClick,
  Package,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";

interface AnalyticsSummary {
  rangeDays: number;
  views: number;
  linkClicks: number;
  productViews: number;
  purchases: number;
  conversionRate: number;
  revenue: number;
  viewsByDay: { date: string; views: number }[];
  topLinks: { id: string; title: string; clicks: number }[];
  topProducts: { id: string; title: string; sales: number; revenue: number }[];
  devices: { device: string; count: number }[];
  countries: { country: string; count: number }[];
}

interface AnalyticsResponse {
  gated?: boolean;
  message?: string;
  summary?: AnalyticsSummary | null;
  error?: string;
}

const formatIDR = (amount: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);

const formatDay = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });

/**
 * A hand-rolled bar chart.
 *
 * No charting library is installed, and one bar per day over a fixed window is simple
 * enough that adding a dependency for it would cost more than it saves. Height is a
 * percentage of the window's peak so the tallest day always fills the frame.
 */
function ViewsChart({ data }: { data: { date: string; views: number }[] }) {
  const peak = Math.max(1, ...data.map((point) => point.views));

  return (
    <div className="flex h-40 items-end gap-1" role="img" aria-label="Page views per day">
      {data.map((point) => (
        <div key={point.date} className="group relative flex flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-t-sm bg-foreground/70 transition-colors group-hover:bg-foreground"
            style={{ height: `${Math.max(2, (point.views / peak) * 100)}%` }}
          />
          <span className="hidden text-[9px] text-muted-foreground sm:inline">
            {formatDay(point.date)}
          </span>
          {/* The exact count is available on hover and to assistive tech, so the bar
              height is not the only way to read the value. */}
          <span className="sr-only">
            {formatDay(point.date)}: {point.views} views
          </span>
        </div>
      ))}
    </div>
  );
}

function RankedList({
  title,
  emptyLabel,
  rows,
}: {
  title: string;
  emptyLabel: string;
  rows: { key: string; label: string; value: string }[];
}) {
  return (
    <Frame spacing="default" className="card-vercel border border-border/80 shadow-xs">
      <FramePanel className="flex flex-col gap-3">
        <FrameTitle className="text-sm font-bold">{title}</FrameTitle>
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">{emptyLabel}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map((row) => (
              <div key={row.key} className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate text-muted-foreground">{row.label}</span>
                <span className="shrink-0 font-medium tabular-nums">{row.value}</span>
              </div>
            ))}
          </div>
        )}
      </FramePanel>
    </Frame>
  );
}

export function AnalyticsClient() {
  const [days, setDays] = useState("30");
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async (range: string) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/creator/analytics?days=${range}`);
      const payload = (await res.json()) as AnalyticsResponse;
      if (!res.ok) throw new Error(payload.error ?? "Could not load your analytics.");
      setData(payload);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load your analytics.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await load(days);
    })();
  }, [days, load]);

  const summary = data?.summary ?? null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Analytics"
        description="How many people visit your page, what they click, and what they buy."
        tag="openlynk"
        category="Audience insight"
      >
        <Tabs value={days} onValueChange={setDays}>
          <TabsList className="bg-card border border-border/80 rounded-xl">
            <TabsTrigger value="7" className="px-3 text-xs">
              7 days
            </TabsTrigger>
            <TabsTrigger value="30" className="px-3 text-xs">
              30 days
            </TabsTrigger>
            <TabsTrigger value="90" className="px-3 text-xs">
              90 days
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </PageHeader>

      {isLoading ? (
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-28 w-full rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : loadError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load your analytics</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>{loadError}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void load(days)}
              className="w-fit"
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : data?.gated ? (
        <Frame spacing="default" className="card-vercel border border-border/80 shadow-xs">
          <FramePanel className="flex flex-col items-center gap-3 p-8 text-center">
            <div className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <BarChart3 className="size-5" />
            </div>
            <div className="flex flex-col gap-1">
              <FrameTitle className="text-base font-bold">Analytics are a paid feature</FrameTitle>
              <FrameDescription className="text-xs">
                {data.message ?? "Upgrade to see who visits your page and what they click."}
              </FrameDescription>
            </div>
            <Badge variant="outline" className="mt-2 gap-1.5">
              <Sparkles className="size-3" />
              Included from Starter
            </Badge>
            <Link href="/dashboard/billing" className="text-xs underline underline-offset-4">
              Compare plans
            </Link>
          </FramePanel>
        </Frame>
      ) : summary ? (
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Page views"
              value={summary.views}
              description={`Last ${summary.rangeDays} days`}
              icon={Eye}
            />
            <MetricCard
              title="Link clicks"
              value={summary.linkClicks}
              description="Across every block"
              icon={MousePointerClick}
            />
            <MetricCard
              title="Conversion"
              value={`${summary.conversionRate}%`}
              description={`${summary.purchases} purchases`}
              icon={TrendingUp}
            />
            <MetricCard
              title="Product views"
              value={summary.productViews}
              description="Product pages opened"
              icon={Package}
            />
            <MetricCard
              title="Revenue"
              value={formatIDR(summary.revenue)}
              description="Completed sales in range"
              icon={Wallet}
            />
          </div>

          <Frame spacing="default" className="card-vercel border border-border/80 shadow-xs">
            <FramePanel className="flex flex-col gap-4">
              <FrameHeader className="flex flex-row items-center justify-between p-0">
                <div>
                  <FrameTitle className="text-base font-bold">Views per day</FrameTitle>
                  <FrameDescription className="text-xs">
                    One bar per day in the selected range.
                  </FrameDescription>
                </div>
                <Badge variant="outline" className="font-mono">
                  peak{" "}
                  {Math.max(0, ...summary.viewsByDay.map((point) => point.views))}
                </Badge>
              </FrameHeader>
              <ViewsChart data={summary.viewsByDay} />
            </FramePanel>
          </Frame>

          <div className="grid gap-6 md:grid-cols-2">
            <RankedList
              title="Most clicked links"
              emptyLabel="No link clicks in this range yet."
              rows={summary.topLinks.map((link) => ({
                key: link.id,
                label: link.title,
                value: `${link.clicks}`,
              }))}
            />
            <RankedList
              title="Top products by revenue"
              emptyLabel="No sales in this range yet."
              rows={summary.topProducts.map((item) => ({
                key: item.id,
                label: item.title,
                value: `${item.sales} · ${formatIDR(item.revenue)}`,
              }))}
            />
            <RankedList
              title="Devices"
              emptyLabel="No device data yet."
              rows={summary.devices.map((row) => ({
                key: row.device,
                label: row.device,
                value: `${row.count}`,
              }))}
            />
            <RankedList
              title="Countries"
              emptyLabel="No location data yet."
              rows={summary.countries.map((row) => ({
                key: row.country,
                label: row.country,
                value: `${row.count}`,
              }))}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
