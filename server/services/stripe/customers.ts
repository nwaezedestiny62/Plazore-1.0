/**
 * Stripe Customer + PaymentMethod helpers for saved cards.
 * Never store raw card data.
 */

import { getStripe } from "./client.js";

export async function findOrCreateCustomer(params: {
  email: string;
  name?: string;
  buyerId: string;
  existingCustomerId?: string | null;
}) {
  const stripe = getStripe();

  if (params.existingCustomerId) {
    try {
      const existing = await stripe.customers.retrieve(params.existingCustomerId);
      if (!(existing as any).deleted) return existing as any;
    } catch {
      // fall through and create new
    }
  }

  const customer = await stripe.customers.create({
    email: params.email,
    name: params.name || undefined,
    metadata: {
      plazore_buyer_id: params.buyerId,
    },
  });

  return customer;
}

export async function listPaymentMethods(customerId: string) {
  const stripe = getStripe();
  const methods = await stripe.paymentMethods.list({
    customer: customerId,
    type: "card",
  });
  return methods.data;
}

export async function detachPaymentMethod(paymentMethodId: string) {
  const stripe = getStripe();
  return stripe.paymentMethods.detach(paymentMethodId);
}