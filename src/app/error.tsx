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
import { AlertTriangle, ArrowLeft, RotateCcw } from "lucide-react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log runtime errors for debugging and observability
    console.error("Root error captured by boundary:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      <Card className="w-full max-w-lg border-dashed border-destructive/40 bg-card/70 backdrop-blur-md">
        <CardHeader className="gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2 rounded-md bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
              <AlertTriangle className="size-4" />
              <span>Application Error</span>
            </div>
            {error.digest && (
              <Badge variant="outline" className="font-mono">
                Digest: {error.digest.slice(0, 8)}
              </Badge>
            )}
          </div>
          <CardTitle className="text-xl font-bold tracking-tight">
            Something went wrong
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            An unexpected error interrupted this page. Retry the render, or head back
            to the homepage.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="rounded-lg border border-border/60 bg-muted/40 p-3 font-mono text-xs text-foreground/80 break-words">
            {error.message || "An unknown application error occurred."}
          </div>
        </CardContent>

        <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-border/70">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            <span>Back to home</span>
          </Link>

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
    </div>
  );
}
