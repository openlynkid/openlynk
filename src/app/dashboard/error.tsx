"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  RotateCcw,
  LayoutDashboard,
  RefreshCw,
} from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log runtime errors for debugging and observability
    console.error("Dashboard segment error captured by boundary:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="w-full max-w-lg border-dashed border-destructive/40 bg-card/70 backdrop-blur-md shadow-lg">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2 rounded-md bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
              <AlertTriangle className="size-4" />
              <span>Dashboard Segment Error</span>
            </div>
            {error.digest && (
              <Badge variant="outline" className="font-mono text-[10px]">
                Digest: {error.digest.slice(0, 8)}
              </Badge>
            )}
          </div>
          <CardTitle className="text-xl font-bold tracking-tight">
            Failed to render this workspace view
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            An unexpected error occurred while processing this segment of the dashboard.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border/60 bg-muted/40 p-3 font-mono text-xs text-foreground/80 break-words">
            {error.message || "An unknown application error occurred."}
          </div>
          <p className="text-xs text-muted-foreground">
            You can try to re-render this segment with the retry button below, or return to the main dashboard overview.
          </p>
        </CardContent>

        <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-border/70 pt-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <LayoutDashboard className="size-3.5" />
            <span>Dashboard Home</span>
          </Link>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
              className="text-xs gap-1.5"
            >
              <RefreshCw className="size-3.5" />
              Reload Page
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => reset()}
              className="btn-studio-glow text-xs gap-1.5"
            >
              <RotateCcw className="size-3.5" />
              Try Again
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
