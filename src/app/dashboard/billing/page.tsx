import type { Metadata } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { billingService } from "@/modules/billing/service";
import { BillingClient, type CurrentSubscriptionData } from "./billing-client";

export const metadata: Metadata = {
  title: "Billing & Plans",
  description: "Select and manage subscription plans powered by Midtrans Payment Gateway.",
};

async function BillingDataLoader() {
  let initialSubscription: CurrentSubscriptionData | null = null;

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session?.user) {
    const sub = await billingService.getActiveSubscription({
      userId: session.user.id,
    });

    if (sub) {
      initialSubscription = {
        id: sub.id,
        planId: sub.planId,
        status: sub.status,
        billingPeriod: sub.billingPeriod,
        currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
      };
    }
  }

  return <BillingClient initialSubscription={initialSubscription} />;
}

function BillingLoadingFallback() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="flex flex-col gap-2 border-b border-border/70 pb-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="h-6 w-56 bg-muted rounded" />
          <div className="h-4 w-80 bg-muted/60 rounded" />
        </div>
        <div className="h-7 w-28 bg-muted rounded" />
      </div>

      <div className="h-36 rounded-xl border border-border/80 bg-card/60 p-6 space-y-3">
        <div className="h-5 w-40 bg-muted rounded" />
        <div className="h-4 w-72 bg-muted/60 rounded" />
      </div>

      <div className="flex justify-center">
        <div className="h-10 w-64 bg-muted rounded-xl" />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-96 rounded-xl border border-border/80 bg-card/60 p-6 space-y-4"
          >
            <div className="h-5 w-24 bg-muted rounded" />
            <div className="h-8 w-32 bg-muted rounded" />
            <div className="space-y-2 pt-4">
              <div className="h-3 w-full bg-muted/60 rounded" />
              <div className="h-3 w-3/4 bg-muted/60 rounded" />
              <div className="h-3 w-5/6 bg-muted/60 rounded" />
            </div>
            <div className="h-9 w-full bg-muted rounded mt-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<BillingLoadingFallback />}>
      <BillingDataLoader />
    </Suspense>
  );
}
