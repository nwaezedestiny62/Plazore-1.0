/**
 * Stripe Refunds — production-hardened.
 * Supports full + partial refunds, idempotency, and status retrieve.
 */

import { getStripe } from "./client.js";
import { toMinorUnits } from "../../config/payment.js";

export interface CreateRefundParams {
  paymentIntentId: string;
  amountMajor?: number; // omit for full refund
  currency: string;
  reason?: "duplicate" | "fraudulent" | "requested_by_customer";
  reference: string; // our internal refund reference
  orderId: string;
  /** Optional: charge id if PI expansion fails */
  chargeId?: string | null;
}

export async function createRefund(params: CreateRefundParams) {
  const stripe = getStripe();

  if (!params.paymentIntentId && !params.chargeId) {
    throw Object.assign(
      new Error("Stripe refund requires paymentIntentId or chargeId"),
      { statusCode: 400 }
    );
  }

  const refundParams: Record<string, unknown> = {
    reason: params.reason || "requested_by_customer",
    metadata: {
      plazore_refund_reference: params.reference,
      orderId: params.orderId,
    },
  };

  if (params.paymentIntentId) {
    refundParams.payment_intent = params.paymentIntentId;
  } else if (params.chargeId) {
    refundParams.charge = params.chargeId;
  }

  if (params.amountMajor != null && Number.isFinite(params.amountMajor)) {
    refundParams.amount = toMinorUnits(params.amountMajor, params.currency);
  }

  const refund = await stripe.refunds.create(refundParams as any, {
    idempotencyKey: `re_${params.reference}`,
  });

  return {
    refundId: refund.id,
    status: refund.status, // pending | requires_action | succeeded | failed | canceled
    amountMinor: refund.amount,
    amount: params.amountMajor,
    currency: (refund.currency || params.currency).toUpperCase(),
    chargeId:
      typeof refund.charge === "string" ? refund.charge : (refund.charge as any)?.id || null,
    paymentIntentId:
      typeof refund.payment_intent === "string"
        ? refund.payment_intent
        : (refund.payment_intent as any)?.id || params.paymentIntentId || null,
    raw: refund,
  };
}

export async function retrieveRefund(refundId: string) {
  const stripe = getStripe();
  return stripe.refunds.retrieve(refundId);
}

/**
 * Map Stripe refund.status → our Refund.status
 */
export function mapStripeRefundStatus(
  status: string | null | undefined
): "pending" | "processing" | "processed" | "failed" | "needs_attention" {
  switch (String(status || "").toLowerCase()) {
    case "succeeded":
      return "processed";
    case "pending":
    case "requires_action":
      return "processing";
    case "failed":
    case "canceled":
      return "failed";
    default:
      return "needs_attention";
  }
}
