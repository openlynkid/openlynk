"use client";

import { useCallback, useEffect, useState } from "react";
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
import { Receipt, ShoppingBag, TrendingUp, Wallet } from "lucide-react";

interface PurchaseRecord {
  id: string;
  productTitle: string;
  buyerEmail: string;
  amount: number;
  status: string;
  licenseKey: string | null;
  createdAt: string;
}

interface SalesSummary {
  sales: number;
  gross: number;
  fee: number;
  net: number;
  perProduct: { productId: string; title: string; sales: number; gross: number; net: number }[];
}

interface OrdersResponse {
  purchases?: PurchaseRecord[];
  sales?: SalesSummary;
  rangeDays?: number;
  error?: string;
}

const formatIDR = (amount: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export function OrdersClient() {
  const [days, setDays] = useState("30");
  const [data, setData] = useState<OrdersResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async (range: string) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/creator/orders?days=${range}`);
      const payload = (await res.json()) as OrdersResponse;
      if (!res.ok) throw new Error(payload.error ?? "Could not load your orders.");
      setData(payload);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load your orders.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await load(days);
    })();
  }, [days, load]);

  const purchases = data?.purchases ?? [];
  const sales = data?.sales;
  const bestSeller = sales?.perProduct.find((item) => item.sales > 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Orders"
        description="Every completed sale, with the buyer and what they paid."
        tag="openlynk"
        category="Storefront"
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-28 w-full rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      ) : loadError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load your orders</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>{loadError}</span>
            <Button variant="outline" size="sm" onClick={() => void load(days)} className="w-fit">
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Gross revenue"
              value={formatIDR(sales?.gross ?? 0)}
              description={`Last ${data?.rangeDays ?? days} days`}
              icon={Wallet}
            />
            <MetricCard
              title="Your payout"
              value={formatIDR(sales?.net ?? 0)}
              description={
                sales?.fee ? `After ${formatIDR(sales.fee)} platform fee` : "No platform fee in range"
              }
              icon={TrendingUp}
            />
            <MetricCard
              title="Sales"
              value={sales?.sales ?? 0}
              description="Completed orders"
              icon={ShoppingBag}
            />
            <MetricCard
              title="Best seller"
              value={bestSeller ? bestSeller.title : "—"}
              description={bestSeller ? formatIDR(bestSeller.gross) : "No sales yet"}
              icon={Receipt}
            />
          </div>

          <Frame spacing="default" className="card-vercel border border-border/80 shadow-xs">
            <FramePanel className="flex flex-col gap-4">
              <FrameHeader className="flex flex-row items-center justify-between p-0">
                <div>
                  <FrameTitle className="text-base font-bold">Recent orders</FrameTitle>
                  <FrameDescription className="text-xs">
                    The 100 most recent completed purchases.
                  </FrameDescription>
                </div>
                <Badge variant="outline" className="font-mono">
                  {purchases.length} orders
                </Badge>
              </FrameHeader>

              {purchases.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/80 p-8 text-center">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Receipt className="size-5" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium">No orders yet</p>
                    <p className="text-xs text-muted-foreground">
                      Share your page and your first sale will show up here.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/70 text-left text-xs text-muted-foreground">
                        <th className="pb-2 pr-4 font-medium">Product</th>
                        <th className="pb-2 pr-4 font-medium">Buyer</th>
                        <th className="pb-2 pr-4 font-medium">Date</th>
                        <th className="pb-2 pr-4 font-medium">Status</th>
                        <th className="pb-2 text-right font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchases.map((order) => (
                        <tr key={order.id} className="border-b border-border/40 last:border-0">
                          <td className="py-2.5 pr-4 font-medium">{order.productTitle}</td>
                          <td className="py-2.5 pr-4 text-muted-foreground">{order.buyerEmail}</td>
                          <td className="py-2.5 pr-4 text-muted-foreground tabular-nums">
                            {formatDate(order.createdAt)}
                          </td>
                          <td className="py-2.5 pr-4">
                            <Badge
                              variant={order.status === "completed" ? "success-light" : "secondary"}
                              className="text-[10px] capitalize"
                            >
                              {order.status}
                            </Badge>
                          </td>
                          <td className="py-2.5 text-right font-semibold tabular-nums">
                            {formatIDR(order.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </FramePanel>
          </Frame>
        </div>
      )}
    </div>
  );
}
