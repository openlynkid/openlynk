/** Raised when a storefront checkout request is semantically invalid. Maps to HTTP 400. */
export class StoreValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoreValidationError";
  }
}

/** Raised when a product, order or purchase does not exist. Maps to HTTP 404. */
export class StoreNotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "StoreNotFoundError";
  }
}

/** Raised when a webhook payload cannot be trusted. Maps to HTTP 400. */
export class StoreWebhookError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoreWebhookError";
  }
}

export interface CreateStoreCheckoutInput {
  profileId: string;
  productId: string;
  productTitle: string;
  amount: number;
  buyerEmail: string;
  buyerName?: string | null;
  buyerUserId?: string | null;
}

export interface StoreCheckoutResponse {
  orderId: string;
  snapToken: string;
  snapRedirectUrl: string;
  amount: number;
}

/** What a buyer can see about their entitlement after paying. */
export interface PurchaseDelivery {
  purchaseId: string;
  productTitle: string;
  productType: string;
  deliveryType: string;
  amount: number;
  status: string;
  licenseKey: string | null;
  /** Present only for link delivery. */
  deliveryUrl: string | null;
  /** Present only for file delivery. */
  files: { fileName: string; fileUrl: string; fileSize: number | null }[];
  downloadToken: string;
  downloadCount: number;
  createdAt: string;
}
