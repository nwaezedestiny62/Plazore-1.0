/**
 * Stripe webhook signature verification + event helpers.
 */

import { getStripe, getWebhookSecret } from "./client.js";
import type Stripe from "stripe";

export function constructStripeEvent(
  rawBody: Buffer | string,
  signature: string
): Stripe.Event {
  const secret = getWebhookSecret();
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  }

  const stripe = getStripe();
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}

/** Build a stable event ID for idempotency (Stripe already gives us evt_...) */
export function buildStripeEventId(event: Stripe.Event): string {
  return event.id;
}