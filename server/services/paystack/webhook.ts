import crypto from "crypto";
import { getSecretKey } from "./client.js";

/**
 * Verify Paystack webhook signature.
 * Header: x-paystack-signature
 * Value: HMAC SHA512 of raw body using secret key.
 *
 * IMPORTANT: must use the raw request body (Buffer/string), not parsed JSON.
 */
export function verifyPaystackSignature(
  rawBody: Buffer | string,
  signatureHeader: string | undefined
): boolean {
  if (!signatureHeader) return false;
  let secret: string;
  try {
    secret = getSecretKey();
  } catch {
    return false;
  }

  const hash = crypto
    .createHmac("sha512", secret)
    .update(typeof rawBody === "string" ? rawBody : rawBody)
    .digest("hex");

  // timing-safe compare
  try {
    const a = Buffer.from(hash);
    const b = Buffer.from(signatureHeader);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Stable event id for idempotency when Paystack does not send a unique id */
export function buildEventId(event: string, data: any): string {
  if (data?.id != null) return `${event}:${data.id}`;
  const ref = data?.reference || data?.transfer_code || "unknown";
  const paid = data?.paid_at || data?.created_at || "";
  return crypto
    .createHash("sha256")
    .update(`${event}:${ref}:${paid}`)
    .digest("hex");
}
