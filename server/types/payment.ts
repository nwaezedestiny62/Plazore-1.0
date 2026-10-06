/**
 * Shared payment lifecycle types for Plazore.
 * Backend is the single source of truth for these states.
 */

export type PaymentLifecycle =
  | "PENDING_PAYMENT"
  | "PAYMENT_PROCESSING"
  | "PAYMENT_VERIFIED"
  | "PAYMENT_PROTECTED"
  | "PROCESSING_ORDER"
  | "SHIPPED"
  | "DELIVERED"
  | "DELIVERY_CONFIRMED"
  | "SELLER_PAYOUT_PENDING"
  | "SELLER_PAID"
  | "REFUND_PENDING"
  | "REFUNDED"
  | "DISPUTED"
  | "SETTLED_SELLER_FAVOUR"
  | "PAYMENT_FAILED"
  | "CANCELLED";

export type PaymentProvider = "paystack" | "manual" | "none";

export type PaymentStatus =
  | "pending"
  | "processing"
  | "success"
  | "failed"
  | "abandoned"
  | "reversed";

export type PayoutStatus =
  | "not_eligible"
  | "awaiting_buyer"
  | "eligible"
  | "blocked_issue"
  | "queued"
  | "initiated"
  | "completed"
  | "failed"
  | "refunded";

export type RefundStatus =
  | "none"
  | "pending"
  | "processing"
  | "processed"
  | "failed"
  | "not_applicable";

export type BuyerConfirmationStatus =
  | "none"
  | "pending"
  | "confirmed"
  | "issue_reported"
  | "auto_confirmed";

export type DisputeStatus =
  | "open"
  | "under_review"
  | "resolved_buyer"
  | "resolved_seller"
  | "closed";

export type DisputeResolution =
  | "REFUND_BUYER"
  | "SETTLE_SELLER_FAVOUR"
  | null;

/** Buyer-facing labels (UI mapping). */
export const BUYER_STATE_LABELS: Partial<Record<PaymentLifecycle, string>> = {
  PENDING_PAYMENT: "Awaiting payment",
  PAYMENT_PROCESSING: "Payment processing",
  PAYMENT_VERIFIED: "Payment confirmed",
  PAYMENT_PROTECTED: "Order protected",
  PROCESSING_ORDER: "Order processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered — confirmation pending",
  DELIVERY_CONFIRMED: "Delivery confirmed",
  SELLER_PAYOUT_PENDING: "Delivery confirmed",
  SELLER_PAID: "Completed",
  REFUND_PENDING: "Refund processing",
  REFUNDED: "Refunded",
  DISPUTED: "Issue under review",
  SETTLED_SELLER_FAVOUR: "Completed",
  PAYMENT_FAILED: "Payment failed",
  CANCELLED: "Cancelled",
};

/** Seller-facing labels. */
export const SELLER_STATE_LABELS: Partial<Record<PaymentLifecycle, string>> = {
  PENDING_PAYMENT: "Awaiting buyer payment",
  PAYMENT_PROCESSING: "Buyer paying…",
  PAYMENT_VERIFIED: "Payment confirmed",
  PAYMENT_PROTECTED: "Order protected — process order",
  PROCESSING_ORDER: "Processing required",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered — awaiting confirmation",
  DELIVERY_CONFIRMED: "Payout pending",
  SELLER_PAYOUT_PENDING: "Payout pending",
  SELLER_PAID: "Payout released",
  REFUND_PENDING: "Refund / issue under review",
  REFUNDED: "Refunded to buyer",
  DISPUTED: "Issue under review",
  SETTLED_SELLER_FAVOUR: "Payout released",
  PAYMENT_FAILED: "Payment failed",
  CANCELLED: "Cancelled",
};

export interface FeeBreakdown {
  subtotal: number;
  shippingCost: number;
  grossAmount: number;
  platformFeeRate: number; // 0.08
  platformFee: number;
  sellerPayoutAmount: number;
  currency: string;
}
