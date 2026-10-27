"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "@/lib/auth-client";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  BarChart3,
  CreditCard,
  LayoutDashboard,
  Link2,
  Loader2,
  LogOut,
  Menu,
  Palette,
  Receipt,
  Settings,
  ShoppingBag,
  ExternalLink,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { BrandLogo } from "@/components/brand-logo";
import { ConnectionStatus } from "@/components/connection-status";
import { UserNavDropdown } from "@/components/user-nav-dropdown";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { title: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { title: "Links", href: "/dashboard/links", icon: Link2 },
  { title: "Products", href: "/dashboard/products", icon: ShoppingBag },
  { title: "Appearance", href: "/dashboard/appearance", icon: Palette },
  { title: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { title: "Orders", href: "/dashboard/orders", icon: Receipt },
  { title: "Billing & Plans", href: "/dashboard/billing", icon: CreditCard },
  { title: "Profile & Settings", href: "/dashboard/settings", icon: Settings },
];

/** The handful of destinations that fit in the mobile bottom bar. */
const MOBILE_NAV_HREFS = [
  "/dashboard",
  "/dashboard/links",
  "/dashboard/products",
  "/dashboard/analytics",
  "/dashboard/billing",
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // If unauthenticated, redirect to /login
  useEffect(() => {
    if (!isPending && !session?.user && !isSigningOut) {
      signOut().finally(() => {
        router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
        router.refresh();
      });
    }
  }, [session, isPending, pathname, isSigningOut, router]);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    toast.loading("Signing out...", { id: "sign-out" });

    try {
      await signOut({
        fetchOptions: {
          onSuccess: () => {
            toast.success("Signed out successfully.", { id: "sign-out" });
            router.replace("/login");
            router.refresh();
          },
        },
      });
      router.replace("/login");
      router.refresh();
    } catch {
      router.replace("/login");
      router.refresh();
    }
  };

  const userInitials = session?.user?.name
    ? session.user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <div className="flex min-h-screen bg-muted/20 font-sans">
      {/* Mobile Navigation Sheet Drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="flex flex-col justify-between p-5">
          <div className="space-y-6">
            <SheetHeader>
              <SheetTitle>
                <BrandLogo
                  href="/dashboard"
                  subtitle="Control Center"
                  onClick={() => setMobileOpen(false)}
                />
              </SheetTitle>
            </SheetHeader>

            {/* User Preview in Mobile Sheet */}
            {session?.user && (
              <div className="p-3 rounded-lg bg-muted/40 border border-border/60 flex items-center gap-3">
                <div className="shrink-0 rounded-full p-[2px] bg-gradient-to-tr from-[#0062FF] via-[#7928CA] to-[#FF007A]">
                  <Avatar className="size-9 ring-2 ring-background">
                    <AvatarImage src={session.user.image || undefined} alt={session.user.name} />
                    <AvatarFallback className="text-xs font-semibold">{userInitials}</AvatarFallback>
                  </Avatar>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold truncate">{session.user.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{session.user.email}</div>
                </div>
              </div>
            )}

            {/* Mobile Nav Links */}
            <div className="space-y-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 mb-2">
                Navigation
              </div>
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                      isActive
                        ? "btn-studio-glow bg-primary text-primary-foreground font-semibold"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span>{item.title}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Mobile Sheet Footer */}
          <div className="space-y-3 pt-4 border-t border-border/70">
            <Link
              href="/"
              onClick={() => setMobileOpen(false)}
              className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
            >
              <span>Landing Page</span>
              <ExternalLink className="size-3.5" />
            </Link>
            <div className="px-3 py-1">
              <ConnectionStatus />
            </div>
            {session?.user && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="w-full text-xs text-destructive hover:text-destructive hover:bg-destructive/10 justify-start gap-2"
              >
                <LogOut className="size-3.5" />
                Sign out
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop Fixed Sidebar */}
      <aside className="w-64 border-r border-border/70 bg-card/70 backdrop-blur-md hidden md:flex flex-col justify-between p-4 sticky top-0 h-screen shrink-0">
        <div className="space-y-6">
          <BrandLogo href="/dashboard" subtitle="Control Center" />

          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-foreground text-background font-semibold shadow-xs"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="size-4" />
                  {item.title}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="space-y-3 pt-4 border-t border-border/60">
          <Link
            href="/"
            className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
          >
            <span>Landing Page</span>
            <ExternalLink className="size-3.5" />
          </Link>
          <div className="px-3 py-1">
            <ConnectionStatus />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Fixed Top Header */}
        <header className="h-16 border-b border-border/70 bg-card/85 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40">
          {/* Mobile Left: Hamburger Trigger + BrandLogo */}
          <div className="flex items-center gap-2.5 md:hidden">
            <Button
              variant="outline"
              size="icon"
              className="size-9 rounded-lg border-border/80"
              onClick={() => setMobileOpen(true)}
              aria-label="Open mobile navigation"
            >
              <Menu className="size-4" />
            </Button>

            <BrandLogo href="/dashboard" size="sm" showBadge={false} />
          </div>

          {/* Desktop Left: Welcome text */}
          <div className="hidden md:flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {isPending ? (
                <span className="inline-block h-3.5 w-24 bg-muted animate-pulse rounded" />
              ) : session?.user ? (
                <>
                  Welcome back,{" "}
                  <strong className="text-foreground font-semibold">
                    {session.user.name || session.user.email}
                  </strong>
                </>
              ) : null}
            </span>
          </div>

          {/* Right Header: ThemeToggle + Separator + Profile Menu */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <ThemeToggle />

            <Separator orientation="vertical" className="h-4" />

            {/* Unified User Avatar Dropdown (Matches Landing / Home Navbar) */}
            <UserNavDropdown user={session?.user} />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto pb-20 md:pb-8">
          {!isPending && !session?.user ? (
            <div className="flex flex-col items-center justify-center p-16 text-xs text-muted-foreground gap-3">
              <Loader2 className="size-6 animate-spin text-primary" />
              <span>Your session has ended or could not be found. Redirecting to sign in...</span>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 text-xs"
                onClick={() => {
                  signOut().finally(() => {
                    router.replace("/login");
                    router.refresh();
                  });
                }}
              >
                Menuju Halaman Login
              </Button>
            </div>
          ) : (
            children
          )}
        </main>

        {/* Mobile Fixed Bottom Navigation Bar. Only the primary destinations fit, so the
            rest live in the sheet above; a scrolling bottom bar is not discoverable. */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 h-14 bg-card/90 backdrop-blur-md border-t border-border/80 flex items-center justify-around px-2">
          {navItems.filter((item) => MOBILE_NAV_HREFS.includes(item.href)).map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-medium transition-colors ${
                  isActive
                    ? "text-foreground font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <div
                  className={`p-1 rounded-md transition-colors ${
                    isActive ? "bg-muted text-foreground" : ""
                  }`}
                >
                  <Icon className="size-4" />
                </div>
                <span className="truncate">{item.title}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
