import { paystackRequest } from "./client.js";
import { toPaystackAmount } from "../../config/payment.js";

export interface CreateRecipientParams {
  type?: "nuban" | "mobile_money" | "basa";
  name: string;
  account_number: string;
  bank_code: string;
  currency?: string;
}

export async function createTransferRecipient(params: CreateRecipientParams) {
  const body = {
    type: params.type || "nuban",
    name: params.name,
    account_number: params.account_number,
    bank_code: params.bank_code,
    currency: params.currency || "NGN",
  };
  const res = await paystackRequest<{ recipient_code: string; id: number }>(
    "POST",
    "/transferrecipient",
    body
  );
  return res.data;
}

export interface InitiateTransferParams {
  amountMajor: number;
  recipientCode: string;
  reference: string;
  reason?: string;
  currency?: string;
}

export async function initiateTransfer(params: InitiateTransferParams) {
  const body = {
    source: "balance",
    amount: toPaystackAmount(params.amountMajor),
    recipient: params.recipientCode,
    reference: params.reference,
    reason: params.reason || "Plazore seller payout",
    currency: params.currency || "NGN",
  };
  const res = await paystackRequest<{
    transfer_code: string;
    id: number;
    status: string;
    reference: string;
  }>("POST", "/transfer", body);
  return res.data;
}

export async function verifyTransfer(reference: string) {
  const res = await paystackRequest(
    "GET",
    `/transfer/verify/${encodeURIComponent(reference)}`
  );
  return res.data;
}
