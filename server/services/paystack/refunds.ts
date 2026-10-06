import { paystackRequest } from "./client.js";
import { toPaystackAmount } from "../../config/payment.js";

export interface CreateRefundParams {
  /** Paystack transaction reference or id */
  transaction: string;
  amountMajor?: number; // omit for full refund
  currency?: string;
  customer_note?: string;
  merchant_note?: string;
}

export async function createRefund(params: CreateRefundParams) {
  const body: Record<string, unknown> = {
    transaction: params.transaction,
  };
  if (params.amountMajor != null) {
    body.amount = toPaystackAmount(params.amountMajor);
  }
  if (params.currency) body.currency = params.currency;
  if (params.customer_note) body.customer_note = params.customer_note;
  if (params.merchant_note) body.merchant_note = params.merchant_note;

  const res = await paystackRequest("POST", "/refund", body);
  return res.data;
}
