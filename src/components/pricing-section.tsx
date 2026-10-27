"use client";

import { useState } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/reui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PRICING_PLANS, getPlanDisplay } from "@/modules/billing/plans";
import type { BillingInterval } from "@/modules/billing/types";
import { Check } from "lucide-react";

type RecurringInterval = Exclude<BillingInterval, "lifetime">;

const formatIDR = (amount: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);

export function PricingSection() {
  const [interval, setInterval] = useState<RecurringInterval>("monthly");

  return (
    <section id="pricing" className="py-20 border-b border-border/70 relative">
      <span className="grid-cross -bottom-[7px] -left-[7px] hidden min-[1400px]:flex">+</span>
      <span className="grid-cross -bottom-[7px] -right-[7px] hidden min-[1400px]:flex">+</span>

      <div className="px-4 sm:px-6 lg:px-8 flex flex-col gap-8">
        <div className="text-center flex flex-col gap-3 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-muted-foreground">
            <span>[04]</span>
            <span>Pricing Plans</span>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Simple, Transparent SaaS Pricing
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            All tiers include complete source code access, automated Midtrans billing, and lifetime software updates.
          </p>
        </div>

        <div className="flex justify-center">
          <Tabs value={interval} onValueChange={(value) => setInterval(value as RecurringInterval)}>
            <TabsList className="bg-card border border-border/80 rounded-xl">
              <TabsTrigger value="monthly" className="px-4 font-semibold">
                Monthly
              </TabsTrigger>
              <TabsTrigger value="yearly" className="gap-1.5 px-4 font-semibold">
                <span>Yearly</span>
                <Badge variant="success-light" className="pointer-events-none">
                  2 months free
                </Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {Object.values(PRICING_PLANS).map((plan) => {
            const { amount, suffix } = getPlanDisplay(plan, interval);

            return (
              <Card
                key={plan.id}
                className={`flex flex-col justify-between relative ${
                  plan.isPopular ? "ring-2 ring-foreground/30" : ""
                }`}
              >
                {plan.isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge variant="primary-light" className="font-mono uppercase tracking-wide">
                      Most Popular
                    </Badge>
                  </div>
                )}

                <CardHeader>
                  <CardTitle className="font-bold">{plan.name}</CardTitle>
                  <CardDescription className="min-h-10">{plan.description}</CardDescription>
                  <div className="flex items-baseline gap-1 pt-2">
                    <span className="text-3xl font-extrabold tracking-tight tabular-nums">
                      {formatIDR(amount)}
                    </span>
                    <span className="text-xs text-muted-foreground">{suffix}</span>
                  </div>
                </CardHeader>

                <CardContent>
                  <ul className="flex flex-col gap-2">
                    {plan.features.map((feature) => (
                      <li key={feature.text} className="flex items-center gap-2">
                        <Check
                          aria-hidden
                          className={`size-3.5 shrink-0 ${
                            feature.included ? "text-success-foreground dark:text-success" : "text-muted-foreground/30"
                          }`}
                        />
                        <span
                          className={
                            feature.included
                              ? "text-muted-foreground"
                              : "text-muted-foreground/50 line-through"
                          }
                        >
                          {feature.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter>
                  <Link
                    href="/register"
                    className={buttonVariants({
                      variant: plan.isPopular ? "default" : "outline",
                      className: "w-full",
                    })}
                  >
                    Get Started
                  </Link>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
