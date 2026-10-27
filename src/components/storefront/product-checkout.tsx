"use client";

import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/reui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/reui/alert";
import { Spinner } from "@/components/ui/spinner";
import { CheckCircle2, Download, KeyRound, Link2, Loader2 } from "lucide-react";

interface PurchaseDelivery {
  purchaseId: string;
  productTitle: string;
  deliveryType: string;
  amount: number;
  status: string;
  licenseKey: string | null;
  deliveryUrl: string | null;
  files: { fileName: string; fileUrl: string; fileSize: number | null }[];
  downloadToken: string;
}

interface SnapResult {
  order_id?: string;
  transaction_status?: string;
}

interface SnapApi {
  pay: (
    token: string,
    options?: {
      onSuccess?: (result: SnapResult) => void;
      onPending?: (result: SnapResult) => void;
      onError?: (result: SnapResult) => void;
      onClose?: () => void;
    }
  ) => void;
}

/**
 * Snap is injected globally by `MidtransScript` in the root layout. Read through a cast
 * rather than a `declare global` so this file does not fight the declaration that
 * `snap-script.tsx` already owns.
 */
function getSnap(): SnapApi | undefined {
  return (window as unknown as { snap?: SnapApi }).snap;
}

export interface ProductCheckoutProps {
  username: string;
  productId: string;
  price: number;
  isFree: boolean;
  accentColor: string;
  pageBackground: string;
}

/**
 * Buyer-facing checkout and delivery panel.
 *
 * The state machine is deliberately explicit — form, waiting, delivered, error — because
 * each state has a different failure mode. In particular the "waiting" state must keep
 * polling: Midtrans confirms payment through a webhook, which can land a second or two
 * after Snap reports success, so trusting Snap alone would show an empty delivery page to
 * a buyer who has just paid.
 */
export function ProductCheckout({
  username,
  productId,
  price,
  isFree,
  accentColor,
  pageBackground,
}: ProductCheckoutProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"form" | "waiting" | "delivered">("form");
  const [error, setError] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<PurchaseDelivery | null>(null);

  const accent = { backgroundColor: accentColor, color: pageBackground } as const;

  async function pollOrder(orderId: string) {
    // A webhook is not instantaneous. 20 attempts over ~30s covers the normal case and
    // still ends, rather than leaving the buyer on a spinner forever.
    for (let attempt = 0; attempt < 20; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      try {
        const res = await fetch(`/api/store/orders/${encodeURIComponent(orderId)}`);
        if (!res.ok) continue;
        const data = (await res.json()) as {
          status?: string;
          delivery?: PurchaseDelivery | null;
        };
        if (data.delivery) {
          setDelivery(data.delivery);
          setStatus("delivered");
          return;
        }
      } catch {
        // A transient network error on one poll should not abort the whole wait.
      }
    }
    setError(
      "We could not confirm your payment yet. If you were charged, your product will appear in your library shortly."
    );
    setStatus("form");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (email.trim().length === 0) {
      setError("Enter your email so we can deliver your purchase.");
      return;
    }

    setStatus("waiting");

    try {
      const endpoint = isFree ? "/api/store/claim" : "/api/store/checkout";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, productId, email, name }),
      });

      const payload = (await res.json()) as {
        error?: string;
        delivery?: PurchaseDelivery;
        orderId?: string;
        snapToken?: string;
      };

      if (!res.ok) {
        setError(payload.error ?? "Something went wrong. Please try again.");
        setStatus("form");
        return;
      }

      // Free product: delivery is immediate, no gateway involved.
      if (isFree && payload.delivery) {
        setDelivery(payload.delivery);
        setStatus("delivered");
        return;
      }

      const snap = getSnap();
      if (!snap || !payload.snapToken) {
        setError("The payment window could not be opened. Please refresh and try again.");
        setStatus("form");
        return;
      }

      const orderId = payload.orderId!;
      snap.pay(payload.snapToken, {
        onSuccess: () => void pollOrder(orderId),
        onPending: () => void pollOrder(orderId),
        onError: () => {
          setError("The payment was declined. You have not been charged.");
          setStatus("form");
        },
        onClose: () => {
          // Closing Snap without paying is a normal cancellation, not an error.
          setStatus("form");
        },
      });
    } catch {
      setError("We could not reach the payment service. Please try again.");
      setStatus("form");
    }
  }

  if (status === "delivered" && delivery) {
    return (
      <div className="rounded-xl border p-5 space-y-4" style={{ borderColor: `${accentColor}44` }}>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-5" style={{ color: accentColor }} />
          <p className="text-sm font-semibold">Payment received — here is your product</p>
        </div>

        {delivery.deliveryType === "code" && delivery.licenseKey && (
          <div className="space-y-1.5">
            <p className="text-xs opacity-70">Your licence key</p>
            <code className="block rounded-lg border p-3 text-sm font-mono break-all">
              {delivery.licenseKey}
            </code>
          </div>
        )}

        {delivery.deliveryType === "link" && delivery.deliveryUrl && (
          <a
            href={delivery.deliveryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ className: "w-full" })}
            style={accent}
          >
            <Link2 className="size-4" />
            Open your product
          </a>
        )}

        {delivery.deliveryType === "file" && delivery.files.length > 0 && (
          <div className="space-y-2">
            {delivery.files.map((file) => (
              <a
                key={file.fileName}
                href={file.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "outline", className: "w-full justify-start" })}
              >
                <Download className="size-4" />
                {file.fileName}
              </a>
            ))}
          </div>
        )}

        <p className="text-[11px] opacity-60">
          Keep this link — you can also find it any time under My Library.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border p-5 space-y-4" style={{ borderColor: `${accentColor}44` }}>
      <div className="space-y-1">
        <p className="text-sm font-semibold">{isFree ? "Get this for free" : "Buy this product"}</p>
        <p className="text-xs opacity-70">
          {isFree
            ? "Enter your email and we will send the download link."
            : "We deliver instantly after payment. No account needed."}
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="buyer-email" className="text-xs">
          Email
        </Label>
        <Input
          id="buyer-email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          disabled={status === "waiting"}
          autoComplete="email"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="buyer-name" className="text-xs">
          Name <span className="opacity-60">(optional)</span>
        </Label>
        <Input
          id="buyer-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Your name"
          disabled={status === "waiting"}
          autoComplete="name"
        />
      </div>

      <Button type="submit" className="w-full" style={accent} disabled={status === "waiting"}>
        {status === "waiting" ? (
          <>
            <Spinner className="size-4" />
            Waiting for payment…
          </>
        ) : (
          <>
            {isFree ? <Download className="size-4" /> : <KeyRound className="size-4" />}
            {isFree ? "Get it free" : "Continue to payment"}
          </>
        )}
      </Button>

      {!isFree && (
        <div className="flex items-center justify-center gap-1.5 text-[11px] opacity-60">
          <Loader2 className="size-3" />
          Secure checkout powered by Midtrans
        </div>
      )}

      <Badge variant="outline" className="w-full justify-center border-current opacity-70">
        {price === 0 ? "Free" : `Total ${new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(price)}`}
      </Badge>
    </form>
  );
}
