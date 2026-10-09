/**
 * Stripe HTTP client + configuration.
 * All secret key usage stays on the server.
 *
 * Environment variables (set after creating Stripe account):
 *   STRIPE_SECRET_KEY          sk_test_... or sk_live_...
 *   STRIPE_PUBLISHABLE_KEY     pk_test_... or pk_live_...
 *   STRIPE_WEBHOOK_SECRET      whsec_...
 *   STRIPE_CONNECT_WEBHOOK_SECRET  (optional, if using Connect webhooks)
 *
 * Until real keys are added the integration stays in safe "not configured" mode.
 */

import Stripe from "stripe";

export class StripeNotConfiguredError extends Error {
  constructor(msg = "Stripe is not configured. Set STRIPE_SECRET_KEY.") {
    super(msg);
    this.name = "StripeNotConfiguredError";
  }
}

let stripeInstance: Stripe | null = null;

export function getSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (
    !key ||
    key === "sk_test_placeholder" ||
    key.startsWith("YOUR_") ||
    key.includes("placeholder")
  ) {
    throw new StripeNotConfiguredError();
  }
  return key;
}

export function getPublishableKey(): string | null {
  return process.env.STRIPE_PUBLISHABLE_KEY?.trim() || null;
}

export function getWebhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() || null;
}

export function isStripeConfigured(): boolean {
  try {
    getSecretKey();
    return true;
  } catch {
    return false;
  }
}

/**
 * Lazy singleton Stripe client.
 * Always uses the latest secret key from env.
 */
export function getStripe(): Stripe {
  if (stripeInstance) return stripeInstance;

  const key = getSecretKey();
  stripeInstance = new Stripe(key, {
    apiVersion: "2024-11-20.acacia" as any, // pin a stable version; update when ready
    typescript: true,
    appInfo: {
      name: "Plazore",
      version: "1.0.0",
      url: "https://plazorev1.vercel.app",
    },
  });
  return stripeInstance;
}

/** Reset instance (useful in tests or after key rotation) */
export function resetStripeClient() {
  stripeInstance = null;
}