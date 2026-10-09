import crypto from "crypto";
import mongoose from "mongoose";
import Order from "../models/Order.js";
import Product from "../models/Products.js";
import Payment from "../models/Payment.js";
import PaymentEvent from "../models/PaymentEvent.js";
import {
  calculateSellerPayout,
  currencyForRegion,
  toMinorUnits,
  PLAZORE_TRANSACTION_FEE_RATE,
} from "../config/payment.js";
import {
  initializeTransaction,
  verifyTransaction,
} from "./paystack/transactions.js";
import {
  isPaystackConfigured,
  PaystackNotConfiguredError,
} from "./paystack/client.js";
import {
  isStripeConfigured,
  StripeNotConfiguredError,
  getPublishableKey,
} from "./stripe/client.js";
import {
  createPaymentIntent,
  retrievePaymentIntent,
} from "./stripe/paymentIntents.js";
import { writePaymentAudit } from "../utils/paymentAudit.js";
import { sendNotification } from "../utils/sendNotification.js";

export type PaymentProvider = "paystack" | "stripe";

/** Exported — paymentController imports this for refund refs. */
export function generateReference(prefix = "PLZ"): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `${prefix}_${ts}_${rnd}`;
}

function resolveListingRegion(product: any): string {
  const raw = String(
    (product as any).region || (product as any).marketplaceRegion || ""
  )
    .trim()
    .toUpperCase();
  return raw || "NG";
}

function normalizeProvider(raw?: string | null): PaymentProvider {
  const p = String(raw || "paystack").toLowerCase().trim();
  return p === "stripe" ? "stripe" : "paystack";
}

export async function buildServerSideOrderItems(
  rawItems: Array<{ productId: string; quantity: number; note?: string }>,
  buyerId: string
) {
  const itemsBySeller: Record<string, any[]> = {};
  const shippingBySeller: Record<
    string,
    { method: "self" | "courier"; courierCompany: string; deliveryFee: number }
  > = {};

  for (const item of rawItems) {
    const productId = item.productId;
    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      throw Object.assign(
        new Error(`Product not found or inactive: ${productId}`),
        { statusCode: 400 }
      );
    }
    if (product.stock < item.quantity) {
      throw Object.assign(new Error(`Insufficient stock for ${product.name}`), {
        statusCode: 400,
      });
    }

    const sellerId = product.seller.toString();
    const isSellerOwnedPurchase = buyerId === sellerId;
    const listingRegion = resolveListingRegion(product);
    const listingCurrency = currencyForRegion(listingRegion);

    const unitPrice = Number(product.price);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw Object.assign(
        new Error(`Invalid product price for ${product.name}`),
        { statusCode: 400 }
      );
    }

    if (!itemsBySeller[sellerId]) itemsBySeller[sellerId] = [];
    itemsBySeller[sellerId].push({
      product: product._id,
      name: product.name,
      quantity: item.quantity,
      price: unitPrice,
      region: listingRegion,
      currency: listingCurrency,
      image: product.images?.[0] || "",
      note: String(item.note || "")
        .trim()
        .slice(0, 120),
      isSellerOwnedPurchase,
    });

    const method =
      (product as any).shipping?.method === "self" ? "self" : "courier";
    const feeMode = (product as any).shipping?.feeMode || "fixed";
    let fee = 0;
    if (feeMode === "free") fee = 0;
    else if (feeMode === "on_delivery") fee = 0;
    else fee = Number((product as any).shipping?.deliveryFee) || 0;

    const company = String(
      (product as any).shipping?.courierCompany || ""
    ).trim();

    if (!shippingBySeller[sellerId]) {
      shippingBySeller[sellerId] = {
        method,
        courierCompany: company,
        deliveryFee: fee,
      };
    } else if (fee > shippingBySeller[sellerId].deliveryFee) {
      shippingBySeller[sellerId] = {
        method,
        courierCompany: company,
        deliveryFee: fee,
      };
    }
  }

  return { itemsBySeller, shippingBySeller };
}

export async function createPendingOrders(params: {
  buyer: any;
  shippingAddress: any;
  buyerNote?: string;
  phone?: string;
  rawItems: Array<{ productId: string; quantity: number; note?: string }>;
}) {
  const { itemsBySeller, shippingBySeller } = await buildServerSideOrderItems(
    params.rawItems,
    params.buyer._id.toString()
  );

  const createdOrders: any[] = [];
  const contactPhone = String(params.phone || params.buyer.phone || "").trim();

  for (const sellerId of Object.keys(itemsBySeller)) {
    const sellerItems = itemsBySeller[sellerId];
    const snap = shippingBySeller[sellerId];
    const isSellerOwnedPurchase =
      params.buyer._id.toString() === String(sellerId);

    const subtotal = sellerItems.reduce(
      (sum: number, row: any) => sum + row.price * row.quantity,
      0
    );
    const shippingCost = snap?.deliveryFee || 0;
    const region = String(sellerItems[0]?.region || "NG")
      .trim()
      .toUpperCase();
    const currency =
      String(sellerItems[0]?.currency || "").trim().toUpperCase() ||
      currencyForRegion(region);

    const fees = calculateSellerPayout(subtotal, shippingCost, currency);

    const order = await Order.create({
      buyer: params.buyer._id,
      seller: sellerId,
      orderNumber: `PLZ#${Math.floor(10000 + Math.random() * 90000)}`,
      items: sellerItems,
      shippingAddress: params.shippingAddress,
      buyerNote: params.buyerNote || "",
      buyerContact: {
        name: params.buyer.name || "",
        phone: contactPhone,
      },
      productShipping: {
        method: snap?.method || "courier",
        courierCompany: snap?.courierCompany || "",
        deliveryFee: shippingCost,
      },
      orderStatus: "Preparing",
      region,
      currency,
      subtotal,
      shippingCost,
      totalAmount: fees.grossAmount,
      paymentStatus: "pending",
      paymentMethod: "pending",
      paymentLifecycle: "PENDING_PAYMENT",
      feeBreakdown: {
        subtotal,
        shippingCost,
        grossAmount: fees.grossAmount,
        platformFeeRate: PLAZORE_TRANSACTION_FEE_RATE,
        platformFee: fees.platformFee,
        sellerPayoutAmount: fees.sellerPayoutAmount,
        currency,
        region,
      },
      buyerConfirmation: { status: "none" },
      payout: { status: "not_eligible" },
      isSellerOwnedPurchase,
      stockReservation: { reserved: true, committed: false, released: false },
    });

    for (const row of sellerItems) {
      await Product.findByIdAndUpdate(row.product, {
        $inc: { stock: -row.quantity },
      });
    }

    createdOrders.push(order);
  }

  return createdOrders;
}

/**
 * Restore stock for an order that never completed payment.
 * Idempotent. Never releases if payment already succeeded.
 */
export async function releaseStockForOrder(
  orderId: string,
  reason: string = "payment_failed"
): Promise<{ released: boolean; already?: boolean }> {
  const order = await Order.findById(orderId);
  if (!order) return { released: false };

  const res = (order as any).stockReservation || {};
  if (res.released === true) {
    return { released: false, already: true };
  }
  if (order.paymentStatus === "paid" || res.committed === true) {
    return { released: false, already: true };
  }

  for (const item of order.items || []) {
    const productId = (item as any).product;
    const qty = Number((item as any).quantity) || 0;
    if (!productId || qty <= 0) continue;
    await Product.findByIdAndUpdate(productId, {
      $inc: { stock: qty },
    });
  }

  (order as any).stockReservation = {
    reserved: true,
    committed: false,
    released: true,
  };

  const life = String((order as any).paymentLifecycle || "");
  if (
    ["PENDING_PAYMENT", "PAYMENT_PROCESSING", "PAYMENT_FAILED"].includes(
      life
    ) ||
    order.paymentStatus === "pending" ||
    order.paymentStatus === "failed"
  ) {
    (order as any).paymentLifecycle = "CANCELLED";
    order.orderStatus = "Cancelled";
    (order as any).cancellation = {
      cancelledBy: "system",
      reasonCode: "other",
      reasonLabel: reason,
      note: reason,
      cancelledAt: new Date(),
      refundStatus: "not_applicable",
    };
  }

  await order.save();

  await writePaymentAudit({
    order: order._id.toString(),
    payment: (order as any).paymentRef?.toString?.() || null,
    action: "stock.released",
    actorType: "system",
    toLifecycle: (order as any).paymentLifecycle,
    note: reason,
  }).catch(() => {});

  return { released: true };
}

/** Mark payment failed and release stock. Provider-agnostic. */
export async function failPaymentAndReleaseStock(
  payment: any,
  order: any,
  data: any,
  source: "api" | "webhook" | "manual" | "job"
) {
  const provider = normalizeProvider(payment?.provider);
  payment.status = data?.status === "abandoned" ? "abandoned" : "failed";
  payment.lifecycle = "PAYMENT_FAILED";
  payment.gatewayResponse =
    data?.gateway_response || data?.status || "failed";
  payment.failureReason =
    data?.gateway_response || data?.status || "failed";
  await payment.save();

  (order as any).paymentLifecycle = "PAYMENT_FAILED";
  order.paymentStatus = "failed";
  await order.save();

  await releaseStockForOrder(
    order._id.toString(),
    payment.status === "abandoned"
      ? `Payment abandoned on ${provider}`
      : `Payment failed: ${payment.failureReason}`
  );

  await writePaymentAudit({
    order: order._id.toString(),
    payment: payment._id.toString(),
    action: "payment.failed",
    actorType: source === "webhook" ? "webhook" : "system",
    toLifecycle: "PAYMENT_FAILED",
    reference: payment.reference,
    note: payment.failureReason,
    meta: { provider },
  }).catch(() => {});
}

/**
 * Initialize payment for an order.
 * provider: "paystack" | "stripe" (default paystack for backward compatibility)
 */
export async function initializePaymentForOrder(params: {
  orderId: string;
  buyer: any;
  callbackUrl?: string;
  provider?: PaymentProvider;
}) {
  const order = await Order.findById(params.orderId);
  if (!order) {
    throw Object.assign(new Error("Order not found"), { statusCode: 404 });
  }
  if (order.buyer.toString() !== params.buyer._id.toString()) {
    throw Object.assign(new Error("Not authorized"), { statusCode: 403 });
  }
  if (
    !["PENDING_PAYMENT", "PAYMENT_FAILED", "PAYMENT_PROCESSING"].includes(
      String((order as any).paymentLifecycle || "PENDING_PAYMENT")
    ) &&
    order.paymentStatus !== "pending" &&
    order.paymentStatus !== "failed"
  ) {
    throw Object.assign(
      new Error("Order is not payable in its current state"),
      { statusCode: 400 }
    );
  }

  const provider = normalizeProvider(params.provider);

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
  const amountMinor = toMinorUnits(amount, currency);

  let payment = await Payment.findOne({ order: order._id });
  if (payment && payment.status === "success") {
    throw Object.assign(new Error("Order already paid"), { statusCode: 400 });
  }

  if (!payment) {
    payment = await Payment.create({
      order: order._id,
      buyer: order.buyer,
      seller: order.seller,
      provider,
      reference,
      amount,
      amountMinor,
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
    payment.amountMinor = amountMinor;
    payment.currency = currency;
    payment.status = "pending";
    payment.lifecycle = "PENDING_PAYMENT";
    if (provider === "stripe") {
      payment.authorizationUrl = null;
      payment.accessCode = null;
    } else {
      payment.stripePaymentIntentId = null;
      payment.stripeClientSecret = null;
      payment.stripeChargeId = null;
    }
    await payment.save();
  }

  // ── Stripe path ──
  if (provider === "stripe") {
    const intent = await createPaymentIntent({
      amountMajor: amount,
      currency,
      reference,
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      buyerId: order.buyer.toString(),
      sellerId: order.seller.toString(),
      buyerEmail: email,
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
    (order as any).paymentProvider = "stripe";
    if (!(order as any).currency) (order as any).currency = currency;
    order.paymentStatus = "pending";
    order.paymentMethod = "stripe";
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
      meta: {
        provider: "stripe",
        paymentIntentId: intent.paymentIntentId,
      },
    });

    return {
      payment,
      provider: "stripe" as const,
      clientSecret: intent.clientSecret,
      paymentIntentId: intent.paymentIntentId,
      reference,
      amount,
      currency,
      region,
      publicKey:
        getPublishableKey() || process.env.STRIPE_PUBLISHABLE_KEY || null,
      authorizationUrl: null,
      accessCode: null,
    };
  }

  // ── Paystack path ──
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
  (order as any).paymentProvider = "paystack";
  if (!(order as any).currency) {
    (order as any).currency = currency;
  }
  order.paymentStatus = "pending";
  order.paymentMethod = "paystack";
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
    meta: { provider: "paystack" },
  });

  return {
    payment,
    provider: "paystack" as const,
    authorizationUrl: init.authorization_url,
    accessCode: init.access_code,
    reference: init.reference,
    amount,
    currency,
    region,
    publicKey: process.env.PAYSTACK_PUBLIC_KEY || null,
    clientSecret: null,
    paymentIntentId: null,
  };
}

/**
 * Verify by Plazore reference.
 * Routes to Stripe PaymentIntent retrieve or Paystack verifyTransaction.
 */
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

  const provider = normalizeProvider(payment.provider);

  // ── Stripe verify ──
  if (provider === "stripe") {
    if (!isStripeConfigured()) throw new StripeNotConfiguredError();

    const intentId =
      payment.stripePaymentIntentId || payment.providerTransactionId;
    if (!intentId) {
      throw Object.assign(new Error("Missing Stripe PaymentIntent ID"), {
        statusCode: 400,
      });
    }

    const intent = await retrievePaymentIntent(String(intentId));

    if (intent.amount !== payment.amountMinor) {
      await writePaymentAudit({
        order: payment.order.toString(),
        payment: payment._id.toString(),
        action: "payment.verify_amount_mismatch",
        actorType: source === "webhook" ? "webhook" : "system",
        reference,
        meta: {
          provider: "stripe",
          expected: payment.amountMinor,
          got: intent.amount,
        },
      });
      throw Object.assign(new Error("Payment amount mismatch"), {
        statusCode: 400,
      });
    }

    if (
      String(intent.currency).toUpperCase() !==
      String(payment.currency).toUpperCase()
    ) {
      await writePaymentAudit({
        order: payment.order.toString(),
        payment: payment._id.toString(),
        action: "payment.verify_currency_mismatch",
        actorType: source === "webhook" ? "webhook" : "system",
        reference,
        meta: {
          provider: "stripe",
          expected: payment.currency,
          got: intent.currency,
        },
      });
      throw Object.assign(new Error("Payment currency mismatch"), {
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
      const charge = (intent as any).latest_charge;
      if (typeof charge === "string") {
        payment.stripeChargeId = charge;
      } else if (charge?.id) {
        payment.stripeChargeId = charge.id;
      }

      const card = charge?.payment_method_details?.card;
      const data = {
        id: intent.id,
        status: "success",
        amount: intent.amount,
        currency: intent.currency,
        paid_at: new Date().toISOString(),
        channel: card ? "card" : intent.payment_method_types?.[0] || "stripe",
        gateway_response: "Successful",
        authorization: card
          ? {
              last4: card.last4,
              brand: card.brand,
              exp_month: card.exp_month,
              exp_year: card.exp_year,
              reusable: true,
            }
          : null,
      };
      return await markPaymentSuccess(payment, order, data, source);
    }

    if (
      intent.status === "canceled" ||
      intent.status === "requires_payment_method"
    ) {
      await failPaymentAndReleaseStock(
        payment,
        order,
        { status: intent.status, gateway_response: intent.status },
        source
      );
    }
    return { payment, order, alreadyVerified: false };
  }

  // ── Paystack verify ──
  if (!isPaystackConfigured()) {
    throw new PaystackNotConfiguredError();
  }

  const data = await verifyTransaction(reference);

  if (data.amount !== payment.amountMinor) {
    await writePaymentAudit({
      order: payment.order.toString(),
      payment: payment._id.toString(),
      action: "payment.verify_amount_mismatch",
      actorType: source === "webhook" ? "webhook" : "system",
      reference,
      meta: {
        provider: "paystack",
        expected: payment.amountMinor,
        got: data.amount,
      },
    });
    throw Object.assign(new Error("Payment amount mismatch"), {
      statusCode: 400,
    });
  }

  if (
    String(data.currency).toUpperCase() !==
    String(payment.currency).toUpperCase()
  ) {
    await writePaymentAudit({
      order: payment.order.toString(),
      payment: payment._id.toString(),
      action: "payment.verify_currency_mismatch",
      actorType: source === "webhook" ? "webhook" : "system",
      reference,
      meta: {
        provider: "paystack",
        expected: payment.currency,
        got: data.currency,
      },
    });
    throw Object.assign(new Error("Payment currency mismatch"), {
      statusCode: 400,
    });
  }

  const order = await Order.findById(payment.order);
  if (!order) {
    throw Object.assign(new Error("Order not found for payment"), {
      statusCode: 404,
    });
  }

  if (data.status === "success") {
    return await markPaymentSuccess(payment, order, data, source);
  }

  await failPaymentAndReleaseStock(payment, order, data, source);
  return { payment, order, alreadyVerified: false };
}

/**
 * Shared success path for both providers.
 * Lands order in PAYMENT_PROTECTED (Plazore escrow hold).
 */
async function markPaymentSuccess(
  payment: any,
  order: any,
  data: any,
  source: "api" | "webhook" | "manual"
) {
  if (payment.status === "success" && payment.verifiedAt) {
    return { payment, order, alreadyVerified: true };
  }

  const session = await mongoose.startSession().catch(() => null);

  const apply = async () => {
    payment.status = "success";
    payment.lifecycle = "PAYMENT_PROTECTED";
    payment.providerTransactionId = String(
      data.id || payment.providerTransactionId || ""
    );
    payment.channel = data.channel || null;
    payment.gatewayResponse = data.gateway_response || "Successful";
    payment.paidAt = data.paid_at ? new Date(data.paid_at) : new Date();
    payment.verifiedAt = new Date();
    payment.verificationSource = source;

    if (data.authorization) {
      payment.authorizationCode =
        data.authorization.authorization_code || null;
      payment.cardLast4 = data.authorization.last4 || null;
      payment.cardBrand =
        data.authorization.brand || data.authorization.card_type || null;
      payment.cardExpMonth = data.authorization.exp_month || null;
      payment.cardExpYear = data.authorization.exp_year || null;
      payment.reusable = !!data.authorization.reusable;
    }

    await payment.save();

    order.paymentStatus = "paid";
    (order as any).paymentLifecycle = "PAYMENT_PROTECTED";
    (order as any).paymentRef = payment._id;
    (order as any).paymentProvider = payment.provider;
    if (!(order as any).currency && payment.currency) {
      (order as any).currency = payment.currency;
    }
    if ((order as any).stockReservation) {
      (order as any).stockReservation.committed = true;
    }
    if (order.orderStatus === "Preparing") {
      (order as any).paymentLifecycle = "PROCESSING_ORDER";
    }
    await order.save();
  };

  if (session) {
    await session.withTransaction(async () => {
      await apply();
    });
    session.endSession();
  } else {
    await apply();
  }

  await writePaymentAudit({
    order: order._id.toString(),
    payment: payment._id.toString(),
    action: "payment.verified",
    actorType: source === "webhook" ? "webhook" : "system",
    fromLifecycle: "PAYMENT_PROCESSING",
    toLifecycle: "PAYMENT_PROTECTED",
    amount: payment.amount,
    currency: payment.currency,
    reference: payment.reference,
    meta: {
      source,
      provider: payment.provider,
      providerTransactionId: payment.providerTransactionId,
    },
  });

  if (!order.isSellerOwnedPurchase) {
    await sendNotification({
      userId: order.seller.toString(),
      type: "new_order",
      title: "New paid order",
      message: `Payment confirmed for order ${order.orderNumber} (${payment.currency}). Please process it.`,
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
    }).catch(() => {});
  }

  return { payment, order, alreadyVerified: false };
}

/** Paystack charge.success webhook handler (idempotent). */
export async function handleChargeSuccessWebhook(
  eventId: string,
  payload: any,
  signatureValid: boolean
) {
  const existing = await PaymentEvent.findOne({ eventId });
  if (existing?.processed) {
    return { ok: true, duplicate: true };
  }

  await PaymentEvent.findOneAndUpdate(
    { eventId },
    {
      eventId,
      event: "charge.success",
      reference: payload?.data?.reference || null,
      payload,
      signatureValid,
      processed: false,
      provider: "paystack",
    },
    { upsert: true, new: true }
  );

  if (!signatureValid) {
    await PaymentEvent.updateOne(
      { eventId },
      { processingError: "Invalid signature" }
    );
    return { ok: false, error: "Invalid signature" };
  }

  const reference = payload?.data?.reference;
  if (!reference) {
    return { ok: false, error: "Missing reference" };
  }

  try {
    const result = await verifyPaymentByReference(reference, "webhook");
    await PaymentEvent.updateOne(
      { eventId },
      {
        processed: true,
        processedAt: new Date(),
        payment: result.payment?._id,
        order: result.order?._id,
      }
    );
    return { ok: true, duplicate: false };
  } catch (err: any) {
    await PaymentEvent.updateOne(
      { eventId },
      { processingError: err.message || "verify failed" }
    );
    throw err;
  }
}

/**
 * Stripe payment_intent.succeeded webhook handler.
 * Looks up Payment by stripePaymentIntentId or plazore_reference metadata.
 */
export async function handleStripePaymentIntentSucceeded(
  eventId: string,
  intent: any,
  signatureValid: boolean
) {
  const existing = await PaymentEvent.findOne({ eventId });
  if (existing?.processed) {
    return { ok: true, duplicate: true };
  }

  const reference =
    intent?.metadata?.plazore_reference ||
    intent?.metadata?.reference ||
    null;

  await PaymentEvent.findOneAndUpdate(
    { eventId },
    {
      eventId,
      event: "payment_intent.succeeded",
      reference,
      payload: intent,
      signatureValid,
      processed: false,
      provider: "stripe",
    },
    { upsert: true, new: true }
  );

  if (!signatureValid) {
    await PaymentEvent.updateOne(
      { eventId },
      { processingError: "Invalid signature" }
    );
    return { ok: false, error: "Invalid signature" };
  }

  try {
    let payment = null as any;
    if (reference) {
      payment = await Payment.findOne({ reference });
    }
    if (!payment && intent?.id) {
      payment = await Payment.findOne({
        $or: [
          { stripePaymentIntentId: intent.id },
          { providerTransactionId: intent.id },
        ],
      });
    }
    if (!payment) {
      await PaymentEvent.updateOne(
        { eventId },
        { processingError: "Payment not found for intent" }
      );
      return { ok: false, error: "Payment not found" };
    }

    const result = await verifyPaymentByReference(
      payment.reference,
      "webhook"
    );
    await PaymentEvent.updateOne(
      { eventId },
      {
        processed: true,
        processedAt: new Date(),
        payment: result.payment?._id,
        order: result.order?._id,
      }
    );
    return { ok: true, duplicate: false };
  } catch (err: any) {
    await PaymentEvent.updateOne(
      { eventId },
      { processingError: err.message || "stripe verify failed" }
    );
    throw err;
  }
}
