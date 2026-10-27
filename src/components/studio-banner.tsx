"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, X } from "lucide-react";

export function StudioBanner() {
  const [dismissed, setDismissed] = React.useState(false);

  if (dismissed) return null;

  return (
    <aside aria-label="Announcement" className="relative z-50 bg-primary text-primary-foreground border-b border-primary/20">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-2 text-xs sm:px-6 lg:px-8">
        <div className="flex flex-1 items-center justify-center gap-2 text-center sm:justify-start">
          <span className="font-semibold text-primary-foreground">
            ✨ New on OpenLynk:
          </span>
          <span className="text-primary-foreground/90 hidden sm:inline">
            Sell digital products with automatic delivery, licence keys, and Midtrans checkout.
          </span>
          <Link
            href="#pricing"
            className="inline-flex items-center gap-0.5 rounded-full bg-primary-foreground/15 px-2.5 py-0.5 font-medium text-primary-foreground hover:bg-primary-foreground/25 transition-colors"
          >
            See plans
            <ChevronRight className="size-3" />
          </Link>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="rounded-md p-1 text-primary-foreground/80 hover:bg-primary-foreground/15 hover:text-primary-foreground transition-colors cursor-pointer"
          aria-label="Dismiss banner"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </aside>
  );
}
