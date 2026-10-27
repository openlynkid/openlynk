"use client";

import { useEffect } from "react";
// global-error replaces the root layout, so it does not inherit globals.css from it.
// Without this import the boundary renders unstyled (Next only injects its own defaults).
import "./globals.css";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log runtime errors for debugging and observability
    console.error("Global error captured by boundary:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground antialiased">
        <Card className="w-full max-w-lg border-dashed border-destructive/40">
          <CardHeader className="gap-2">
            <div className="inline-flex items-center gap-2 rounded-md bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
              <AlertTriangle className="size-4" />
              <span>Critical Application Error</span>
            </div>
            <CardTitle className="text-xl font-bold tracking-tight">
              The application failed to load
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              A fatal error occurred before the page could render. Retry to attempt a
              fresh render.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="rounded-lg border border-border/60 bg-muted/40 p-3 font-mono text-xs text-foreground/80 break-words">
              {error.message || "An unknown application error occurred."}
            </div>
          </CardContent>

          <CardFooter className="flex items-center justify-end border-t border-dashed border-border/70">
            <Button
              variant="default"
              size="sm"
              onClick={() => reset()}
              className="text-xs gap-1.5"
            >
              <RotateCcw className="size-3.5" />
              Try Again
            </Button>
          </CardFooter>
        </Card>
      </body>
    </html>
  );
}
