/**
 * Stripe Refunds
 */

import { getStripe } from "./client.js";
import { toMinorUnits } from "../../config/payment.js";

export interface CreateRefundParams {
  paymentIntentId: string;
  amountMajor?: number;       // omit for full refund
  currency: string;
  reason?: "duplicate" | "fraudulent" | "requested_by_customer";
  reference: string;          // our internal refund reference
  orderId: string;
}

export async function createRefund(params: CreateRefundParams) {
  const stripe = getStripe();

  const refundParams: any = {
    payment_intent: params.paymentIntentId,
    reason: params.reason || "requested_by_customer",
    metadata: {
      plazore_refund_reference: params.reference,
      orderId: params.orderId,
    },
  };

  if (params.amountMajor != null) {
    refundParams.amount = toMinorUnits(params.amountMajor, params.currency);
  }

  const refund = await stripe.refunds.create(refundParams, {
    idempotencyKey: `re_${params.reference}`,
  });

  return {
    refundId: refund.id,
    status: refund.status,
    amount: params.amountMajor,
    currency: params.currency.toUpperCase(),
  };
}

export async function retrieveRefund(refundId: string) {
  const stripe = getStripe();
  return stripe.refunds.retrieve(refundId);
}