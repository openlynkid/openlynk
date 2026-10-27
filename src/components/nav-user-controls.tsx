"use client";

import * as React from "react";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { buttonVariants } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { UserNavDropdown } from "@/components/user-nav-dropdown";

export function NavUserControls() {
  const { data: session, isPending } = useSession();

  // 1. Loading State (Zero Layout Shift)
  if (isPending) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-8 w-16 bg-muted/50 rounded-md animate-pulse hidden sm:block" />
        <div className="size-9 bg-muted/60 rounded-full animate-pulse" />
      </div>
    );
  }

  // 2. Unauthenticated State: Show Sign In & Get Started
  if (!session?.user) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/login"
          className={buttonVariants({
            variant: "ghost",
            size: "sm",
            className: "text-xs font-medium max-sm:hidden hover:text-foreground",
          })}
        >
          Sign In
        </Link>

        <Link
          href="/register"
          className="btn-vercel hidden sm:inline-flex items-center text-xs font-semibold px-3.5 py-1.5 rounded-lg gap-1.5"
        >
          Get Started
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    );
  }

  // 3. Authenticated State: Unified Avatar Dropdown with Dashboard CTA
  return <UserNavDropdown showDashboardCta={true} />;
}
