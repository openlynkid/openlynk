"use client";

import Script from "next/script";

declare global {
  interface Window {
    snap?: {
      pay: (
        token: string,
        options?: {
          onSuccess?: (result: unknown) => void;
          onPending?: (result: unknown) => void;
          onError?: (result: unknown) => void;
          onClose?: () => void;
        }
      ) => void;
    };
  }
}

export interface MidtransScriptProps {
  isProduction?: boolean;
}

export function MidtransScript({ isProduction }: MidtransScriptProps = {}) {
  const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || "";
  const resolvedIsProduction =
    isProduction ?? (process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === "true");
  const snapUrl = resolvedIsProduction
    ? "https://app.midtrans.com/snap/snap.js"
    : "https://app.sandbox.midtrans.com/snap/snap.js";

  return (
    <Script
      src={snapUrl}
      data-client-key={clientKey}
      strategy="lazyOnload"
    />
  );
}
