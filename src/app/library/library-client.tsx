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
import { Download, Link2, Library, RefreshCw } from "lucide-react";

interface PurchaseDelivery {
  purchaseId: string;
  productTitle: string;
  productType: string;
  deliveryType: "file" | "link" | "code";
  amount: number;
  status: string;
  licenseKey: string | null;
  deliveryUrl: string | null;
  files: { fileName: string; fileUrl: string; fileSize: number | null }[];
  downloadToken: string;
  downloadCount: number;
  createdAt: string;
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

export function LibraryClient() {
  const [purchases, setPurchases] = useState<PurchaseDelivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/library");
      const data = (await res.json()) as { purchases?: PurchaseDelivery[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not load your library.");
      setPurchases(data.purchases ?? []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load your library.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function loadInitial() {
      await load();
      if (isCancelled) return;
    }

    void loadInitial();
    return () => {
      isCancelled = true;
    };
  }, [load]);

  /**
   * Exchanges a download token for a fresh signed URL.
   *
   * The stored `fileUrl` is the creator's original location and may have expired or be
   * private; going through the token is what lets a buyer re-download years later, which
   * is the promise "lifetime access" makes.
   */
  async function resolveDownload(purchase: PurchaseDelivery) {
    setResolving(purchase.purchaseId);
    try {
      const res = await fetch(
        `/api/store/download?token=${encodeURIComponent(purchase.downloadToken)}`
      );
      const data = (await res.json()) as { delivery?: PurchaseDelivery; error?: string };
      if (!res.ok || !data.delivery) {
        throw new Error(data.error ?? "This download is no longer available.");
      }

      const first = data.delivery.files[0];
      if (first) {
        window.open(first.fileUrl, "_blank", "noopener,noreferrer");
      } else if (data.delivery.deliveryUrl) {
        window.open(data.delivery.deliveryUrl, "_blank", "noopener,noreferrer");
      }
      await load();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "This download is not available.");
    } finally {
      setResolving(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My Library"
        description="Everything you have bought on OpenLynk, with your files and licence keys."
        tag="openlynk"
        category="Buyer account"
      >
        <Badge variant="outline" className="font-mono">
          {purchases.length} items
        </Badge>
      </PageHeader>

      <Frame spacing="default" className="card-vercel border border-border/80 shadow-xs">
        <FramePanel className="flex flex-col gap-4">
          <FrameHeader className="flex flex-row items-center justify-between p-0">
            <div>
              <FrameTitle className="text-base font-bold">Your purchases</FrameTitle>
              <FrameDescription className="text-xs">
                Download links stay valid, so you can always come back for your files.
              </FrameDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={isLoading}>
              <RefreshCw className="size-3.5" />
              Refresh
            </Button>
          </FrameHeader>

          {isLoading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          ) : loadError ? (
            <Alert variant="destructive">
              <AlertTitle>Could not load your library</AlertTitle>
              <AlertDescription className="flex flex-col gap-3">
                <span>{loadError}</span>
                <Button variant="outline" size="sm" onClick={() => void load()} className="w-fit">
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          ) : purchases.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/80 p-8 text-center">
              <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Library className="size-5" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">Nothing here yet</p>
                <p className="text-xs text-muted-foreground">
                  Products you buy will appear here with their files and licence keys.
                </p>
              </div>
              <Link
                href="/"
                className="text-xs underline underline-offset-4 hover:text-foreground"
              >
                Back to OpenLynk home
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {purchases.map((purchase) => (
                <div
                  key={purchase.purchaseId}
                  className="flex flex-col gap-3 rounded-xl border border-border/70 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{purchase.productTitle}</span>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {purchase.productType}
                      </Badge>
                      {purchase.status !== "completed" && (
                        <Badge variant="secondary" className="text-[10px] capitalize">
                          {purchase.status}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>{formatDate(purchase.createdAt)}</span>
                      <span className="tabular-nums">{formatIDR(purchase.amount)}</span>
                      {purchase.downloadCount > 0 && (
                        <span className="tabular-nums">
                          downloaded {purchase.downloadCount}×
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {purchase.deliveryType === "code" && purchase.licenseKey && (
                      <code className="rounded-md border border-border/70 bg-muted/40 px-2 py-1 font-mono text-xs">
                        {purchase.licenseKey}
                      </code>
                    )}

                    {purchase.deliveryType === "link" && purchase.deliveryUrl && (
                      <a
                        href={purchase.deliveryUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-md border border-border/70 px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
                      >
                        <Link2 className="size-3.5" />
                        Open
                      </a>
                    )}

                    {purchase.deliveryType === "file" && (
                      <Button
                        size="sm"
                        onClick={() => void resolveDownload(purchase)}
                        disabled={resolving === purchase.purchaseId}
                      >
                        <Download className="size-3.5" />
                        {resolving === purchase.purchaseId ? "Preparing…" : "Download"}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </FramePanel>
      </Frame>

      <p className="text-xs text-muted-foreground">
        Looking for the products you <em>sell</em>?{" "}
        <Link href="/dashboard/products" className="underline underline-offset-4">
          Go to your dashboard
        </Link>
        .
      </p>
    </div>
  );
}
