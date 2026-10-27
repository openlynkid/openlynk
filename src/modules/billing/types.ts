export type BillingInterval = "monthly" | "yearly" | "lifetime";

export interface PlanFeature {
  text: string;
  included: boolean;
}

export interface PricingPlan {
  id: string; // 'free' | 'starter' | 'pro' | 'enterprise'
  name: string;
  description: string;
  price: number; // in IDR
  currency: "IDR";
  interval: BillingInterval;
  isPopular?: boolean;
  features: PlanFeature[];
  maxTeamMembers: number;
}

export interface MidtransNotificationPayload {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
  transaction_id: string;
  transaction_status: string;
  fraud_status?: string;
  payment_type: string;
  transaction_time: string;
  status_message?: string;
  currency?: string;
  [key: string]: unknown;
}

export interface CreateCheckoutInput {
  userId: string;
  userEmail: string;
  userName: string;
  planId: string;
  interval: BillingInterval;
  organizationId?: string | null;
}

export interface CheckoutSessionResponse {
  orderId: string;
  snapToken: string;
  snapRedirectUrl: string;
  amount: number;
}

export class WebhookValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookValidationError";
  }
}

/** Raised when a checkout request is semantically invalid (unknown plan, unsupported interval). */
export class CheckoutValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckoutValidationError";
  }
}
