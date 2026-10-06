import crypto from "crypto";
import mongoose from "mongoose";
import Order from "../models/Order.js";
import Product from "../models/Products.js";
import User from "../models/User.js";
import Payment from "../models/Payment.js";
import PaymentEvent from "../models/PaymentEvent.js";
import {
  calculateSellerPayout,
  currencyForRegion,
  toPaystackAmount,
  fromPaystackAmount,
  PLAZORE_TRANSACTION_FEE_RATE,
} from "../config/payment.js";
import {
  initializeTransaction,
  verifyTransaction,
} from "./paystack/transactions.js";
import { isPaystackConfigured, PaystackNotConfiguredError } from "./paystack/client.js";
import { writePaymentAudit } from "../utils/paymentAudit.js";
import { sendNotification } from "../utils/sendNotification.js";

function generateReference(prefix = "PLZ"): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `${prefix}_${ts}_${rnd}`;
}

/**
 * Recalculate line items from Product documents — NEVER trust client prices.
 * Returns items grouped by seller with server prices and shipping.
 */
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
      throw Object.assign(new Error(`Product not found or inactive: ${productId}`), {
        statusCode: 400,
      });
    }
    if (product.stock < item.quantity) {
      throw Object.assign(
        new Error(`Insufficient stock for ${product.name}`),
        { statusCode: 400 }
      );
    }

    const sellerId = product.seller.toString();
    const isSellerOwnedPurchase = buyerId === sellerId;
    const listingRegion = String((product as any).region || "").trim() || "NG";

    // SERVER PRICE ONLY
    const unitPrice = Number(product.price);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw Object.assign(new Error(`Invalid product price for ${product.name}`), {
        statusCode: 400,
      });
    }

    if (!itemsBySeller[sellerId]) itemsBySeller[sellerId] = [];
    itemsBySeller[sellerId].push({
      product: product._id,
      name: product.name,
      quantity: item.quantity,
      price: unitPrice,
      region: listingRegion,
      image: product.images?.[0] || "",
      note: String(item.note || "").trim().slice(0, 120),
      isSellerOwnedPurchase,
    });

    const method =
      (product as any).shipping?.method === "self" ? "self" : "courier";
    const feeMode = (product as any).shipping?.feeMode || "fixed";
    let fee = 0;
    if (feeMode === "free") fee = 0;
    else if (feeMode === "on_delivery") fee = 0; // collected later — not charged at checkout
    else fee = Number((product as any).shipping?.deliveryFee) || 0;

    const company = String((product as any).shipping?.courierCompany || "").trim();

    if (!shippingBySeller[sellerId]) {
      shippingBySeller[sellerId] = { method, courierCompany: company, deliveryFee: fee };
    } else if (fee > shippingBySeller[sellerId].deliveryFee) {
      shippingBySeller[sellerId] = { method, courierCompany: company, deliveryFee: fee };
    }
  }

  return { itemsBySeller, shippingBySeller };
}

/**
 * Create order(s) with PENDING_PAYMENT — reserve stock but do not commit sales metrics until paid.
 * Returns orders ready for payment initialize.
 */
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
    const region = String(sellerItems[0]?.region || "NG").trim();
    const currency = currencyForRegion(region);
    const fees = calculateSellerPayout(subtotal, shippingCost);

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
      },
      buyerConfirmation: { status: "none" },
      payout: { status: "not_eligible" },
      isSellerOwnedPurchase,
      stockReservation: { reserved: true, committed: false, released: false },
    });

    // Reserve stock (decrement). Released on cancel/payment fail.
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
 * Initialize Paystack payment for a single order.
 */
export async function initializePaymentForOrder(params: {
  orderId: string;
  buyer: any;
  callbackUrl?: string;
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
    throw Object.assign(new Error("Order is not payable in its current state"), {
      statusCode: 400,
    });
  }

  if (!isPaystackConfigured()) {
    throw new PaystackNotConfiguredError(
      "Paystack is not configured yet. Add PAYSTACK_SECRET_KEY to environment."
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
  const currency =
    fb.currency || currencyForRegion(String((order as any).region || "NG"));
  const platformFee =
    fb.platformFee ??
    calculateSellerPayout(order.subtotal, order.shippingCost).platformFee;
  const sellerPayoutAmount =
    fb.sellerPayoutAmount ??
    calculateSellerPayout(order.subtotal, order.shippingCost).sellerPayoutAmount;

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
      provider: "paystack",
      reference,
      amount,
      amountMinor: toPaystackAmount(amount),
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
    payment.reference = reference;
    payment.amount = amount;
    payment.amountMinor = toPaystackAmount(amount);
    payment.currency = currency;
    payment.status = "pending";
    payment.lifecycle = "PENDING_PAYMENT";
    await payment.save();
  }

  const callbackUrl =
    params.callbackUrl ||
    process.env.PAYSTACK_CALLBACK_URL ||
    undefined;

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
  });

  return {
    payment,
    authorizationUrl: init.authorization_url,
    accessCode: init.access_code,
    reference: init.reference,
    amount,
    currency,
    publicKey: process.env.PAYSTACK_PUBLIC_KEY || null,
  };
}

/**
 * Verify a payment by reference (API poll from frontend after callback).
 * Idempotent: safe to call multiple times.
 */
export async function verifyPaymentByReference(
  reference: string,
  source: "api" | "webhook" | "manual" = "api"
) {
  const payment = await Payment.findOne({ reference });
  if (!payment) {
    throw Object.assign(new Error("Payment not found"), { statusCode: 404 });
  }

  // Already verified successfully
  if (payment.status === "success" && payment.verifiedAt) {
    const order = await Order.findById(payment.order);
    return { payment, order, alreadyVerified: true };
  }

  if (!isPaystackConfigured()) {
    throw new PaystackNotConfiguredError();
  }

  const data = await verifyTransaction(reference);

  // Amount + currency must match
  if (data.amount !== payment.amountMinor) {
    await writePaymentAudit({
      order: payment.order.toString(),
      payment: payment._id.toString(),
      action: "payment.verify_amount_mismatch",
      actorType: source === "webhook" ? "webhook" : "system",
      reference,
      meta: { expected: payment.amountMinor, got: data.amount },
    });
    throw Object.assign(new Error("Payment amount mismatch"), { statusCode: 400 });
  }

  if (String(data.currency).toUpperCase() !== String(payment.currency).toUpperCase()) {
    throw Object.assign(new Error("Payment currency mismatch"), { statusCode: 400 });
  }

  const order = await Order.findById(payment.order);
  if (!order) {
    throw Object.assign(new Error("Order not found for payment"), { statusCode: 404 });
  }

  if (data.status === "success") {
    return await markPaymentSuccess(payment, order, data, source);
  }

  // failed / abandoned
  payment.status = data.status === "abandoned" ? "abandoned" : "failed";
  payment.lifecycle = "PAYMENT_FAILED";
  payment.gatewayResponse = data.gateway_response || data.status;
  payment.failureReason = data.gateway_response || data.status;
  await payment.save();

  (order as any).paymentLifecycle = "PAYMENT_FAILED";
  order.paymentStatus = "failed";
  await order.save();

  await writePaymentAudit({
    order: order._id.toString(),
    payment: payment._id.toString(),
    action: "payment.failed",
    actorType: source === "webhook" ? "webhook" : "system",
    toLifecycle: "PAYMENT_FAILED",
    reference,
    note: payment.failureReason,
  });

  return { payment, order, alreadyVerified: false };
}

async function markPaymentSuccess(
  payment: any,
  order: any,
  data: any,
  source: "api" | "webhook" | "manual"
) {
  // Atomic-ish guard
  if (payment.status === "success" && payment.verifiedAt) {
    return { payment, order, alreadyVerified: true };
  }

  const session = await mongoose.startSession().catch(() => null);

  const apply = async () => {
    payment.status = "success";
    payment.lifecycle = "PAYMENT_PROTECTED";
    payment.providerTransactionId = String(data.id || "");
    payment.channel = data.channel || null;
    payment.gatewayResponse = data.gateway_response || "Successful";
    payment.paidAt = data.paid_at ? new Date(data.paid_at) : new Date();
    payment.verifiedAt = new Date();
    payment.verificationSource = source;

    if (data.authorization) {
      payment.authorizationCode = data.authorization.authorization_code || null;
      payment.cardLast4 = data.authorization.last4 || null;
      payment.cardBrand = data.authorization.brand || data.authorization.card_type || null;
      payment.cardExpMonth = data.authorization.exp_month || null;
      payment.cardExpYear = data.authorization.exp_year || null;
      payment.reusable = !!data.authorization.reusable;
    }

    await payment.save();

    order.paymentStatus = "paid";
    (order as any).paymentLifecycle = "PAYMENT_PROTECTED";
    (order as any).paymentRef = payment._id;
    if ((order as any).stockReservation) {
      (order as any).stockReservation.committed = true;
    }
    // Seller can now process
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
    meta: { source, providerTransactionId: payment.providerTransactionId },
  });

  // Notify seller only after verified payment
  if (!order.isSellerOwnedPurchase) {
    await sendNotification({
      userId: order.seller.toString(),
      type: "new_order",
      title: "New paid order",
      message: `Payment confirmed for order ${order.orderNumber}. Please process it.`,
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
    }).catch(() => {});
  }

  return { payment, order, alreadyVerified: false };
}

/**
 * Process charge.success from webhook (idempotent via PaymentEvent).
 */
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

export { generateReference, fromPaystackAmount };
