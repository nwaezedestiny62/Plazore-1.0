import { paystackRequest } from "./client.js";
import { toPaystackAmount } from "../../config/payment.js";

export interface InitializeParams {
  email: string;
  amountMajor: number;
  currency: string;
  reference: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
  channels?: string[];
}

export interface InitializeResult {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export async function initializeTransaction(
  params: InitializeParams
): Promise<InitializeResult> {
  const body: Record<string, unknown> = {
    email: params.email,
    amount: toPaystackAmount(params.amountMajor),
    currency: params.currency,
    reference: params.reference,
    metadata: params.metadata || {},
  };
  if (params.callbackUrl) body.callback_url = params.callbackUrl;
  if (params.channels?.length) body.channels = params.channels;

  const res = await paystackRequest<InitializeResult>(
    "POST",
    "/transaction/initialize",
    body
  );
  return res.data;
}

export interface VerifyResult {
  id: number;
  status: string; // success | failed | abandoned | ...
  reference: string;
  amount: number; // minor units
  currency: string;
  channel?: string;
  gateway_response?: string;
  paid_at?: string;
  customer?: { email?: string; customer_code?: string };
  authorization?: {
    authorization_code?: string;
    bin?: string;
    last4?: string;
    exp_month?: string;
    exp_year?: string;
    channel?: string;
    card_type?: string;
    bank?: string;
    country_code?: string;
    brand?: string;
    reusable?: boolean;
    signature?: string;
  };
  metadata?: any;
}

export async function verifyTransaction(
  reference: string
): Promise<VerifyResult> {
  const res = await paystackRequest<VerifyResult>(
    "GET",
    `/transaction/verify/${encodeURIComponent(reference)}`
  );
  return res.data;
}
