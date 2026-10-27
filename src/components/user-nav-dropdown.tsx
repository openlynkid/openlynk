"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/reui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  CreditCard,
  Building2,
  Settings,
  LogOut,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

export interface UserNavDropdownProps {
  showDashboardCta?: boolean;
  align?: "end" | "start" | "center";
  className?: string;
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
}

interface SubscriptionState {
  planId: string;
  planName: string;
  status: string;
  isPopular?: boolean;
}

export function UserNavDropdown({
  showDashboardCta = false,
  align = "end",
  className = "",
  user: initialUser,
}: UserNavDropdownProps) {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [sub, setSub] = React.useState<SubscriptionState | null>(null);
  const [isSigningOut, setIsSigningOut] = React.useState(false);

  const currentUser = initialUser !== undefined ? initialUser : session?.user;

  // Fetch subscription data when user is authenticated
  React.useEffect(() => {
    let isCancelled = false;

    if (!session?.user?.id) {
      return;
    }

    fetch("/api/billing/subscription")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isCancelled && data) {
          const planId = data.subscription?.planId || data.plan?.id || "free";
          const planName = data.plan?.name || planId.toUpperCase();
          const status = data.subscription?.status || "active";
          const isPopular = data.plan?.isPopular || planId === "pro";
          setSub({ planId, planName, status, isPopular });
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setSub({ planId: "free", planName: "Free", status: "active" });
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [session?.user?.id]);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    toast.loading("Signing out...", { id: "user-nav-sign-out" });

    try {
      await signOut({
        fetchOptions: {
          onSuccess: () => {
            toast.success("Signed out successfully.", { id: "user-nav-sign-out" });
            router.refresh();
          },
        },
      });
      router.refresh();
    } catch {
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  };

  // Loading state placeholder with zero layout shift
  if (isPending && !currentUser) {
    return (
      <div className={`flex items-center gap-2.5 ${className}`}>
        {showDashboardCta && (
          <div className="h-8 w-20 bg-muted/50 rounded-lg animate-pulse hidden sm:block" />
        )}
        <div className="size-9 bg-muted/60 rounded-full animate-pulse" />
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  const userInitials = currentUser.name
    ? currentUser.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  const rawPlanId = sub?.planId ? sub.planId.toLowerCase() : "free";
  const isPaidPlan = rawPlanId !== "free" && rawPlanId !== "basic";
  const planDisplayName = sub?.planName || (isPaidPlan ? rawPlanId.toUpperCase() : "FREE");

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Optional 1-Click CTA to open Dashboard (used on Home / Landing page) */}
      {showDashboardCta && (
        <Link
          href="/dashboard"
          className="btn-vercel hidden sm:inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-lg gap-1.5"
        >
          <span>Dashboard</span>
          <ArrowRight className="size-3.5" />
        </Link>
      )}

      {/* Interactive Avatar with Tiered Solid Gradient Ring (No Blur, Striking Blue to Hot Pink) */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className="relative group p-0.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 cursor-pointer select-none transition-transform hover:scale-105 active:scale-95"
          aria-label="User profile menu"
        >
          {/*
            Solid crisp outline ring:
            - Pro / Paid tiers: Striking bottom-left to top-right gradient (Electric Blue -> Cyber Violet -> Hot Pink)
            - Free / Basic tiers: Solid crisp neutral ring
            - NO BLUR: Clean solid geometric borders
          */}
          <div
            className={`rounded-full p-[2.5px] transition-colors ${
              isPaidPlan
                ? "bg-gradient-to-tr from-[#0062FF] via-[#7928CA] to-[#FF007A]"
                : "bg-zinc-300 dark:bg-zinc-600 group-hover:bg-zinc-400 dark:group-hover:bg-zinc-500"
            }`}
          >
            <Avatar className="size-8.5 ring-2 ring-background">
              <AvatarImage src={currentUser.image || undefined} alt={currentUser.name || "User"} />
              <AvatarFallback className="text-xs font-semibold bg-muted text-foreground">
                {userInitials}
              </AvatarFallback>
            </Avatar>
          </div>
        </DropdownMenuTrigger>

        {/* Dropdown Menu Popup */}
        <DropdownMenuContent className="w-60 card-vercel p-1.5 shadow-lg" align={align} sideOffset={8}>
          <DropdownMenuGroup>
            <DropdownMenuLabel className="p-2">
              <div className="flex flex-col space-y-1">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-xs font-semibold leading-none text-foreground truncate max-w-[140px]">
                    {currentUser.name}
                  </p>
                  <Badge
                    variant={isPaidPlan ? "primary-light" : "outline"}
                    className="font-mono uppercase shrink-0"
                  >
                    {isPaidPlan && <Sparkles aria-hidden />}
                    {planDisplayName}
                  </Badge>
                </div>
                <p className="text-[11px] leading-none text-muted-foreground truncate">
                  {currentUser.email}
                </p>
              </div>
            </DropdownMenuLabel>
          </DropdownMenuGroup>

          <DropdownMenuSeparator className="bg-border/60 my-1" />

          <DropdownMenuGroup>
            <DropdownMenuItem
              onClick={() => router.push("/dashboard")}
              className="cursor-pointer text-xs flex items-center gap-2 px-2.5 py-2 rounded-md hover:bg-muted"
            >
              <LayoutDashboard className="size-3.5 text-muted-foreground" />
              <span>Dashboard Overview</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => router.push("/dashboard/billing")}
              className="cursor-pointer text-xs flex items-center gap-2 px-2.5 py-2 rounded-md hover:bg-muted"
            >
              <CreditCard className="size-3.5 text-muted-foreground" />
              <span>Billing &amp; Subscription</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => router.push("/dashboard/organizations")}
              className="cursor-pointer text-xs flex items-center gap-2 px-2.5 py-2 rounded-md hover:bg-muted"
            >
              <Building2 className="size-3.5 text-muted-foreground" />
              <span>Workspaces</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => router.push("/dashboard/settings")}
              className="cursor-pointer text-xs flex items-center gap-2 px-2.5 py-2 rounded-md hover:bg-muted"
            >
              <Settings className="size-3.5 text-muted-foreground" />
              <span>Profile &amp; Settings</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator className="bg-border/60 my-1" />

          <DropdownMenuItem
            onClick={handleSignOut}
            className="text-destructive cursor-pointer text-xs flex items-center gap-2 px-2.5 py-2 rounded-md hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="size-3.5" />
            <span>Sign out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
