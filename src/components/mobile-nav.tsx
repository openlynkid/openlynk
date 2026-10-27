"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import {
  Menu,
  ArrowRight,
  Layers,
  ShieldCheck,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { BrandLogo } from "@/components/brand-logo";
import { Badge } from "@/components/reui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "sonner";

export function MobileNav() {
  const router = useRouter();
  const { data: session } = useSession();
  const [open, setOpen] = React.useState(false);
  const [planId, setPlanId] = React.useState<string>("FREE");
  const [isSigningOut, setIsSigningOut] = React.useState(false);

  // Fetch plan info if authenticated
  React.useEffect(() => {
    let isCancelled = false;
    if (session?.user?.id) {
      fetch("/api/billing/subscription")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!isCancelled && data) {
            const plan = data.subscription?.planId || data.plan?.id || "free";
            setPlanId(plan.toUpperCase());
          }
        })
        .catch(() => {});
    }
    return () => {
      isCancelled = true;
    };
  }, [session?.user?.id]);

  const navLinks = [
    { href: "#features", label: "Features", icon: Layers, tag: "01" },
    { href: "#showcase", label: "Product", icon: ShieldCheck, tag: "02" },
    { href: "#creators", label: "Creators", icon: Sparkles, tag: "03" },
    { href: "#pricing", label: "Pricing", icon: CreditCard, tag: "04" },
  ];

  const handleLinkClick = () => {
    setOpen(false);
  };

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    toast.loading("Signing out...", { id: "mobile-sign-out" });

    try {
      await signOut({
        fetchOptions: {
          onSuccess: () => {
            toast.success("Signed out successfully.", { id: "mobile-sign-out" });
            setOpen(false);
            router.refresh();
          },
        },
      });
      setOpen(false);
      router.refresh();
    } catch {
      setOpen(false);
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  };

  const user = session?.user;
  const userInitials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  const rawPlan = planId.toLowerCase();
  const isPaidPlan = rawPlan !== "free" && rawPlan !== "basic";

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="size-9 p-0 md:hidden border-border/80 bg-background/80"
        aria-label="Open mobile navigation menu"
      >
        <Menu className="size-4" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[300px] sm:w-[350px] p-6 flex flex-col justify-between">
          <div className="space-y-6">
            <SheetHeader className="text-left space-y-1">
              <SheetTitle>
                <BrandLogo href="/" size="sm" onClick={handleLinkClick} />
              </SheetTitle>
            </SheetHeader>

            <nav className="flex flex-col gap-1.5 pt-2">
              <span className="text-[10px] font-mono tracking-wider uppercase text-muted-foreground/80 px-2 pb-1">
                Navigation
              </span>
              {navLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={handleLinkClick}
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                      <span>{item.label}</span>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground/50 group-hover:text-muted-foreground">
                      [{item.tag}]
                    </span>
                  </a>
                );
              })}
            </nav>

            <div className="border-t border-border/60 pt-4 flex items-center justify-between px-2">
              <span className="text-xs text-muted-foreground">Appearance</span>
              <ThemeToggle />
            </div>
          </div>

          <div className="space-y-3 pt-6 border-t border-border/60">
            {/* If Authenticated: Show Profile Card + Dashboard Link */}
            {user ? (
              <div className="space-y-3">
                <div className="p-3 rounded-xl card-vercel border border-border/80 flex items-center gap-3">
                  {/* Avatar with Tiered Solid Ring Indicator: striking blue-to-pink gradient for paid, neutral gray for basic/free */}
                  <div
                    className={`shrink-0 rounded-full p-[2.5px] transition-colors ${
                      isPaidPlan
                        ? "bg-gradient-to-tr from-[#0062FF] via-[#7928CA] to-[#FF007A]"
                        : "bg-zinc-300 dark:bg-zinc-600"
                    }`}
                  >
                    <Avatar className="size-10 ring-2 ring-background">
                      <AvatarImage src={user.image || undefined} alt={user.name || "User"} />
                      <AvatarFallback className="text-xs font-semibold bg-muted text-foreground">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <p className="text-xs font-bold text-foreground truncate">{user.name}</p>
                      <Badge
                        variant={isPaidPlan ? "primary-light" : "outline"}
                        className="font-mono uppercase shrink-0"
                      >
                        {isPaidPlan && <Sparkles aria-hidden />}
                        {planId}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                  </div>
                </div>

                <Link
                  href="/dashboard"
                  onClick={handleLinkClick}
                  className="btn-vercel w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg"
                >
                  <LayoutDashboard className="size-3.5" />
                  <span>Go to Dashboard</span>
                  <ArrowRight className="size-3" />
                </Link>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSignOut}
                  className="w-full text-xs text-destructive hover:text-destructive hover:bg-destructive/10 justify-center gap-1.5 border-border/70"
                >
                  <LogOut className="size-3.5" />
                  <span>Sign out</span>
                </Button>
              </div>
            ) : (
              /* If Unauthenticated: Show Sign In & Get Started */
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href="/login"
                    onClick={handleLinkClick}
                    className="flex items-center justify-center py-2 text-xs font-semibold rounded-lg border border-border/80 hover:bg-muted/40 transition-colors"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/register"
                    onClick={handleLinkClick}
                    className="btn-vercel flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg"
                  >
                    <span>Get Started</span>
                    <ArrowRight className="size-3" />
                  </Link>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
