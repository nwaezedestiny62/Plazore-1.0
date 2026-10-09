/**
 * Stripe PaymentIntent helpers.
 * Money is collected onto the platform balance (Separate Charges + Transfers pattern).
 * Seller receives funds later via Transfer when the order becomes eligible.
 */

import { getStripe } from "./client.js";
import { toMinorUnits } from "../../config/payment.js";

export interface CreatePaymentIntentParams {
  amountMajor: number;
  currency: string;
  reference: string;          // our internal PLZ reference
  orderId: string;
  orderNumber: string;
  buyerId: string;
  sellerId: string;
  buyerEmail: string;
  metadata?: Record<string, string>;
  customerId?: string | null; // existing Stripe Customer
  paymentMethodId?: string | null; // saved PaymentMethod
  returnUrl?: string;
}

export async function createPaymentIntent(params: CreatePaymentIntentParams) {
  const stripe = getStripe();
  const amountMinor = toMinorUnits(params.amountMajor, params.currency);

  const intentParams: any = {
    amount: amountMinor,
    currency: params.currency.toLowerCase(),
    metadata: {
      plazore_reference: params.reference,
      orderId: params.orderId,
      orderNumber: params.orderNumber,
      buyerId: params.buyerId,
      sellerId: params.sellerId,
      ...params.metadata,
    },
    // Keep money on the platform until we decide to transfer
    // (no transfer_data / on_behalf_of → Separate Charges model)
    automatic_payment_methods: {
      enabled: true,
      allow_redirects: "always",
    },
    description: `Plazore order ${params.orderNumber}`,
    receipt_email: params.buyerEmail || undefined,
  };

  if (params.customerId) {
    intentParams.customer = params.customerId;
  }

  if (params.paymentMethodId) {
    intentParams.payment_method = params.paymentMethodId;
    intentParams.confirm = false; // let frontend confirm
  }

  if (params.returnUrl) {
    intentParams.return_url = params.returnUrl;
  }

  const intent = await stripe.paymentIntents.create(intentParams, {
    idempotencyKey: `pi_${params.reference}`,
  });

  return {
    paymentIntentId: intent.id,
    clientSecret: intent.client_secret,
    status: intent.status,
    amount: params.amountMajor,
    amountMinor,
    currency: params.currency.toUpperCase(),
    reference: params.reference,
  };
}

export async function retrievePaymentIntent(paymentIntentId: string) {
  const stripe = getStripe();
  return stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge", "payment_method"],
  });
}

export async function cancelPaymentIntent(paymentIntentId: string) {
  const stripe = getStripe();
  return stripe.paymentIntents.cancel(paymentIntentId);
}