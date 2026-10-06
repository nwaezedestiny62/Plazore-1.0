/**
 * Paystack HTTP client.
 * All secret key usage stays on the server.
 *
 * Env (set when account is ready):
 *   PAYSTACK_SECRET_KEY
 *   PAYSTACK_PUBLIC_KEY  (only public key may go to clients)
 *   PAYSTACK_BASE_URL    (optional override)
 */

import { PAYSTACK_BASE_URL } from "../../config/payment.js";

export class PaystackNotConfiguredError extends Error {
  constructor(msg = "Paystack is not configured. Set PAYSTACK_SECRET_KEY.") {
    super(msg);
    this.name = "PaystackNotConfiguredError";
  }
}

export function getSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (!key || key === "sk_test_placeholder" || key.startsWith("YOUR_")) {
    throw new PaystackNotConfiguredError();
  }
  return key;
}

export function getPublicKey(): string | null {
  return process.env.PAYSTACK_PUBLIC_KEY?.trim() || null;
}

export function isPaystackConfigured(): boolean {
  try {
    getSecretKey();
    return true;
  } catch {
    return false;
  }
}

export interface PaystackResponse<T = any> {
  status: boolean;
  message: string;
  data: T;
}

export async function paystackRequest<T = any>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: Record<string, unknown>
): Promise<PaystackResponse<T>> {
  const secret = getSecretKey();
  const url = `${PAYSTACK_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = (await res.json()) as PaystackResponse<T>;

  if (!res.ok || json.status === false) {
    const err: any = new Error(json.message || `Paystack ${method} ${path} failed`);
    err.statusCode = res.status;
    err.paystack = json;
    throw err;
  }

  return json;
}
