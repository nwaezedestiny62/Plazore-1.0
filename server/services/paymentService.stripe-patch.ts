/**
 * PATCH / DROP-IN GUIDE for paymentService.ts
 *
 * This file shows the exact changes needed inside the existing
 * server/services/paymentService.ts so both Paystack and Stripe
 * share the same createPendingOrders → initialize → verify → markSuccess flow.
 *
 * DO NOT replace the whole file. Apply the changes below carefully.
 */

// ============================================================
// 1. ADD THESE IMPORTS at the top of paymentService.ts
// ============================================================
/*
import {
  isStripeConfigured,
  StripeNotConfiguredError,
} from "./stripe/client.js";
import { createPaymentIntent, retrievePaymentIntent } from "./stripe/paymentIntents.js";
*/

// ============================================================
// 2. UPDATE initializePaymentForOrder signature + body
// ============================================================
/*
export async function initializePaymentForOrder(params: {
  orderId: string;
  buyer: any;
  callbackUrl?: string;
  provider?: "paystack" | "stripe";   // ← NEW
}) {
  const order = await Order.findById(params.orderId);
  // ... existing ownership & state checks stay the same ...

  const provider = params.provider || "paystack";

  // Provider availability checks
  if (provider === "paystack" && !isPaystackConfigured()) {
    throw new PaystackNotConfiguredError(
      "Paystack is not configured yet. Add PAYSTACK_SECRET_KEY to environment."
    );
  }
  if (provider === "stripe" && !isStripeConfigured()) {
    throw new StripeNotConfiguredError(
      "Stripe is not configured yet. Add STRIPE_SECRET_KEY to environment."
    );
  }

  const email = params.buyer.email;
  if (!email) {
    throw Object.assign(new Error("Buyer email is required for payment"), {
      statusCode: 400,
    });
  }

  const fb = (order as any).feeBreakdown || {};
  const amount = Number(order.totalAmount);
  const region = String((order as any).region || "NG").trim().toUpperCase();
  const currency = String(
    (order as any).currency || fb.currency || currencyForRegion(region)
  )
    .trim()
    .toUpperCase();

  const fallbackFees = calculateSellerPayout(
    order.subtotal,
    order.shippingCost,
    currency
  );
  const platformFee = fb.platformFee ?? fallbackFees.platformFee;
  const sellerPayoutAmount =
    fb.sellerPayoutAmount ?? fallbackFees.sellerPayoutAmount;

  const reference = generateReference("PLZPAY");

  let payment = await Payment.findOne({ order: order._id });
  if (payment && payment.status === "success") {
    throw Object.assign(new Error("Order already paid"), { statusCode: 400 });
  }

  if (!payment) {
    payment = await Payment.create({
      order: order._id,
      buyer: order.buyer,
      seller: order.seller,
      provider,                          // ← paystack | stripe
      reference,
      amount,
      amountMinor: toMinorUnits(amount, currency),
      currency,
      subtotal: order.subtotal,
      shippingCost: order.shippingCost,
      platformFee,
      platformFeeRate: PLAZORE_TRANSACTION_FEE_RATE,
      sellerPayoutAmount,
      status: "pending",
      lifecycle: "PENDING_PAYMENT",
    });
  } else {
    payment.provider = provider;
    payment.reference = reference;
    payment.amount = amount;
    payment.amountMinor = toMinorUnits(amount, currency);
    payment.currency = currency;
    payment.status = "pending";
    payment.lifecycle = "PENDING_PAYMENT";
    await payment.save();
  }

  // ============================================================
  // PROVIDER SWITCH
  // ============================================================
  if (provider === "stripe") {
    const intent = await createPaymentIntent({
      amountMajor: amount,
      currency,
      reference,
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      buyerId: order.buyer.toString(),
      sellerId: order.seller.toString(),
      buyerEmail: email email,
      returnUrl: params.callbackUrl,
    });

    payment.stripePaymentIntentId = intent.paymentIntentId;
    payment.stripeClientSecret = intent.clientSecret;
    payment.providerTransactionId = intent.paymentIntentId;
    payment.status = "processing";
    payment.lifecycle = "PAYMENT_PROCESSING";
    await payment.save();

    (order as any).paymentLifecycle = "PAYMENT_PROCESSING";
    (order as any).paymentRef = payment._id;
    order.paymentStatus = "pending";
    order.paymentMethod = "stripe";
    if (!(order as any).currency) (order as any).currency = currency;
    await order.save();

    await writePaymentAudit({
      order: order._id.toString(),
      payment: payment._id.toString(),
      action: "payment.initialized",
      actorType: "buyer",
      actorId: params.buyer._id.toString(),
      fromLifecycle: "PENDING_PAYMENT",
      toLifecycle: "PAYMENT_PROCESSING",
      amount,
      currency,
      reference,
      meta: { provider: "stripe", paymentIntentId: intent.paymentIntentId },
    });

    return {
      payment,
      provider: "stripe",
      clientSecret: intent.clientSecret,
      paymentIntentId: intent.paymentIntentId,
      reference,
      amount,
      currency,
      region,
      publicKey: process.env.STRIPE_PUBLISHABLE_KEY || null,
    };
  }

  // ===== Existing Paystack path (unchanged) =====
  const callbackUrl =
    params.callbackUrl || process.env.PAYSTACK_CALLBACK_URL || undefined;

  const init = await initializeTransaction({
    email,
    amountMajor: amount,
    currency,
    reference,
    callbackUrl,
    metadata: {
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      paymentId: payment._id.toString(),
      buyerId: order.buyer.toString(),
      sellerId: order.seller.toString(),
      region,
      currency,
    },
  });

  payment.authorizationUrl = init.authorization_url;
  payment.accessCode = init.access_code;
  payment.status = "processing";
  payment.lifecycle = "PAYMENT_PROCESSING";
  await payment.save();

  (order as any).paymentLifecycle = "PAYMENT_PROCESSING";
  (order as any).paymentRef = payment._id;
  order.paymentStatus = "pending";
  order.paymentMethod = "paystack";
  if (!(order as any).currency) (order as any).currency = currency;
  await order.save();

  await writePaymentAudit({ ... existing audit ... });

  return {
    payment,
    provider: "paystack",
    authorizationUrl: init.authorization_url,
    accessCode: init.access_code,
    reference: init.reference,
    amount,
    currency,
    region,
    publicKey: process.env.PAYSTACK_PUBLIC_KEY || null,
  };
}
*/

// ============================================================
// 3. UPDATE verifyPaymentByReference to support Stripe
// ============================================================
/*
export async function verifyPaymentByReference(
  reference: string,
  source: "api" | "webhook" | "manual" = "api"
) {
  const payment = await Payment.findOne({ reference });
  if (!payment) {
    throw Object.assign(new Error("Payment not found"), { statusCode: 404 });
  }

  if (payment.status === "success" && payment.verifiedAt) {
    const order = await Order.findById(payment.order);
    return { payment, order, alreadyVerified: true };
  }

  // ===== Stripe path =====
  if (payment.provider === "stripe") {
    if (!isStripeConfigured()) throw new StripeNotConfiguredError();

    const intentId = payment.stripePaymentIntentId || payment.providerTransactionId;
    if (!intentId) {
      throw Object.assign(new Error("Missing Stripe PaymentIntent ID"), {
        statusCode: 400,
      });
    }

    const intent = await retrievePaymentIntent(intentId);

    // Amount / currency safety check
    if (intent.amount !== payment.amountMinor) {
      throw Object.assign(new Error("Payment amount mismatch"), {
        statusCode: 400,
      });
    }

    const order = await Order.findById(payment.order);
    if (!order) {
      throw Object.assign(new Error("Order not found for payment"), {
        statusCode: 404,
      });
    }

    if (intent.status === "succeeded") {
      // Re-use the same markPaymentSuccess helper
      const charge = (intent as any).latest_charge;
      const data = {
        id: intent.id,
        status: "success",
        amount: intent.amount,
        currency: intent.currency,
        paid_at: new Date().toISOString(),
        channel: "card",
        gateway_response: "Successful",
        authorization: charge?.payment_method_details?.card
          ? {
              last4: charge.payment_method_details.card.last4,
              brand: charge.payment_method_details.card.brand,
              exp_month: charge.payment_method_details.card.exp_month,
              exp_year: charge.payment_method_details.card.exp_year,
            }
          : null,
      };
      // also set stripeChargeId
      if (typeof charge === "string") {
        payment.stripeChargeId = charge;
      } else if (charge?.id) {
        payment.stripeChargeId = charge.id;
      }
      return await markPaymentSuccess(payment, order, data, source);
    }

    // failed / canceled / requires_payment_method etc.
    await failPaymentAndReleaseStock(payment, order, {
      status: intent.status,
      gateway_response: intent.status,
    }, source);
    return { payment, order, alreadyVerified: false };
  }

  // ===== Existing Paystack path (unchanged) =====
  // ... keep the current verifyTransaction logic ...
}
*/

// ============================================================
// 4. checkoutAndPay controller change (paymentController.ts)
// ============================================================
/*
In checkoutAndPay, after creating pending orders, pass the provider:

const provider = (req.body.provider === "stripe" ? "stripe" : "paystack") as "paystack" | "stripe";

const init = await initializePaymentForOrder({
  orderId: order._id.toString(),
  buyer: user,
  callbackUrl,
  provider,                 // ← NEW
});
*/