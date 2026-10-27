"use client";

import { useState, useEffect } from "react";
import { useSession, useActiveOrganization } from "@/lib/auth-client";
import { PRICING_PLANS, getPlanDisplay } from "@/modules/billing/plans";
import { PricingPlan, BillingInterval } from "@/modules/billing/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/reui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/reui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { toast } from "sonner";
import {
  Check,
  Loader2,
  Sparkles,
  HelpCircle,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

export interface CurrentSubscriptionData {
  id: string;
  planId: string;
  status: string;
  billingPeriod: string;
  currentPeriodEnd: string;
}

interface BillingClientProps {
  initialSubscription: CurrentSubscriptionData | null;
}

export function BillingClient({ initialSubscription }: BillingClientProps) {
  const { data: session } = useSession();
  const { data: activeOrg } = useActiveOrganization();

  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [currentSub, setCurrentSub] = useState<CurrentSubscriptionData | null>(
    initialSubscription
  );
  const [isLoadingSub, setIsLoadingSub] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // If active organization changes to an org, re-fetch org-scoped subscription
  useEffect(() => {
    let isCancelled = false;

    async function syncOrgSubscription() {
      if (!activeOrg?.id) {
        // Fall back to personal subscription
        setCurrentSub(initialSubscription);
        setSubError(null);
        return;
      }

      setIsLoadingSub(true);
      setSubError(null);
      try {
        const res = await fetch(`/api/billing/subscription?organizationId=${activeOrg.id}`);
        if (!res.ok) {
          throw new Error("Failed to load organization subscription");
        }
        if (!isCancelled) {
          const data = await res.json();
          setCurrentSub(data.subscription);
        }
      } catch (err) {
        if (!isCancelled) {
          setSubError(
            err instanceof Error ? err.message : "Failed to load organization subscription"
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingSub(false);
        }
      }
    }

    syncOrgSubscription();

    return () => {
      isCancelled = true;
    };
  }, [activeOrg?.id, initialSubscription, reloadKey]);

  const handleCheckout = async (plan: PricingPlan) => {
    if (plan.price === 0) {
      toast.info("You already have access to the Free tier.");
      return;
    }

    setIsProcessing(plan.id);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.id,
          interval: plan.interval === "lifetime" ? "lifetime" : interval,
          organizationId: activeOrg?.id || null,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to initialize payment");
      }

      const checkoutData = await res.json();

      // Trigger Midtrans Snap
      if (typeof window !== "undefined" && window.snap) {
        window.snap.pay(checkoutData.snapToken, {
          onSuccess: () => {
            toast.success("Payment successful! Your plan is activated.");
            window.location.reload();
          },
          onPending: () => {
            toast.info("Payment pending. Please complete transaction via your bank/e-wallet.");
          },
          onError: () => {
            toast.error("Payment failed. Please try again.");
          },
          onClose: () => {
            toast.info("Payment popup closed.");
          },
        });
      } else {
        // Fallback to direct redirect URL if snap.js not loaded
        if (checkoutData.snapRedirectUrl) {
          window.location.assign(checkoutData.snapRedirectUrl);
        } else {
          toast.error("Midtrans Snap client not available.");
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Payment checkout failed");
    } finally {
      setIsProcessing(null);
    }
  };

  const formatIDR = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-8">
      {/* Reusable PageHeader */}
      <PageHeader
        title="Billing & Subscriptions"
        description="Select or upgrade your SaaS plan powered by Midtrans Payment Gateway."
        tag="Midtrans Snap"
        category="Payment Gateway"
      >
        <Badge
          variant="outline"
          className="border-border/80 font-mono text-[11px] py-1 px-2.5 bg-background/50"
        >
          {activeOrg
            ? `Tenant: ${activeOrg.name}`
            : `User: ${session?.user?.email || "Personal"}`}
        </Badge>
      </PageHeader>

      {/* Current Subscription Status */}
      <Card className="card-vercel rounded-xl border border-border/80 shadow-xs">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <CardTitle className="text-base font-bold">Subscription Overview</CardTitle>
                {currentSub ? (
                  <Badge variant="success-light" className="font-mono">
                    {currentSub.status.toUpperCase()}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="font-mono">
                    FREE TIER
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs">
                {activeOrg
                  ? `Billing context: Organization (${activeOrg.name})`
                  : `Billing context: Personal User Account (${session?.user?.email || "Personal"})`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="size-4 text-emerald-500" />
              <span>Encrypted Checkout</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingSub ? (
            <div className="grid gap-4 sm:grid-cols-3" aria-busy="true">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-1.5 p-3 rounded-lg bg-muted/40 border border-border/60">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-5 w-24" />
                </div>
              ))}
            </div>
          ) : subError ? (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle>Could not load subscription</AlertTitle>
              <AlertDescription>{subError}</AlertDescription>
              <div data-slot="alert-action">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setReloadKey((k) => k + 1)}
                >
                  Retry
                </Button>
              </div>
            </Alert>
          ) : currentSub ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="p-3 rounded-lg bg-muted/40 border border-border/60">
                <div className="text-[11px] text-muted-foreground">Active Plan</div>
                <div className="text-base font-bold uppercase">{currentSub.planId}</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/40 border border-border/60">
                <div className="text-[11px] text-muted-foreground">Billing Cycle</div>
                <div className="text-base font-bold capitalize">{currentSub.billingPeriod}</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/40 border border-border/60">
                <div className="text-[11px] text-muted-foreground">Current Period Expiry</div>
                <div className="text-base font-bold">
                  {new Date(currentSub.currentPeriodEnd).toLocaleDateString()}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">
              You are currently on the free default plan. Upgrade below to unlock additional features and higher team member limits.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reusable Tabs for Interval Selector */}
      <div className="flex justify-center">
        <Tabs
          value={interval}
          onValueChange={(val) => setInterval(val as BillingInterval)}
          className="w-auto"
        >
          <TabsList className="bg-card border border-border/80 p-1 rounded-xl shadow-xs">
            <TabsTrigger
              value="monthly"
              className="text-xs font-semibold px-4 py-1.5 rounded-lg data-active:bg-foreground data-active:text-background"
            >
              Monthly Billing
            </TabsTrigger>
            <TabsTrigger
              value="yearly"
              className="text-xs font-semibold px-4 py-1.5 rounded-lg flex items-center gap-1.5 data-active:bg-foreground data-active:text-background"
            >
              <span>Yearly Billing</span>
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-muted text-foreground border border-border/60">
                2 months free
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Pricing Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {Object.values(PRICING_PLANS).map((plan) => {
          const { amount: displayPrice, suffix: billingSuffix } = getPlanDisplay(
            plan,
            interval
          );
          const isCurrentActive = currentSub?.planId.toLowerCase() === plan.id.toLowerCase();
          const isPro = plan.id === "pro";

          return (
            <Card
              key={plan.id}
              className={`relative flex flex-col justify-between card-vercel rounded-xl shadow-xs ${
                isPro
                  ? "border-foreground/50 ring-1 ring-foreground/20 shadow-md"
                  : "border-border/80 hover:border-foreground/30"
              }`}
            >
              {isPro && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="primary-light" className="font-mono uppercase tracking-wide gap-1">
                    <Sparkles className="size-3" /> Most Popular
                  </Badge>
                </div>
              )}

              <CardHeader className="pt-6">
                <CardTitle className="text-lg font-bold">{plan.name}</CardTitle>
                <CardDescription className="text-xs min-h-[36px]">
                  {plan.description}
                </CardDescription>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-2xl lg:text-3xl font-extrabold tracking-tight">
                    {formatIDR(displayPrice)}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">
                    {billingSuffix}
                  </span>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Included Features:
                </div>
                <ul className="space-y-2 text-xs">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Check className="size-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span className={feature.included ? "text-muted-foreground" : "text-muted-foreground/50 line-through"}>
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter className="pt-4 border-t border-border/70">
                <Button
                  className={`w-full text-xs font-semibold ${
                    isPro ? "btn-vercel" : ""
                  }`}
                  variant={isPro ? "default" : "outline"}
                  disabled={isCurrentActive || isProcessing !== null}
                  onClick={() => handleCheckout(plan)}
                >
                  {isProcessing === plan.id ? (
                    <>
                      <Loader2 className="mr-2 size-3.5 animate-spin" />
                      Processing...
                    </>
                  ) : isCurrentActive ? (
                    "Current Active Plan"
                  ) : plan.price === 0 ? (
                    "Default Free Tier"
                  ) : (
                    "Select Plan"
                  )}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Midtrans Info Note using ReUI Alert */}
      <Alert variant="info" className="shadow-xs">
        <HelpCircle className="size-4" />
        <AlertTitle>Payment Guarantee</AlertTitle>
        <AlertDescription>
          All transactions are securely processed using Indonesian Rupiah (IDR) through Midtrans Snap.
          Supported payment channels include GoPay, QRIS, Virtual Accounts (BCA, Mandiri, BNI, BRI),
          and Credit Cards.
        </AlertDescription>
      </Alert>
    </div>
  );
}
