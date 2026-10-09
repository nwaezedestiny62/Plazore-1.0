import crypto from "crypto";
import { Request, Response } from "express";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import Cart from "../models/Cart.js";
import OrderDispute from "../models/OrderDispute.js";
import Refund from "../models/Refund.js";
import {
  createPendingOrders,
  initializePaymentForOrder,
  verifyPaymentByReference,
  handleChargeSuccessWebhook,
  releaseStockForOrder,
  type PaymentProvider,
} from "../services/paymentService.js";
import {
  processSellerPayout,
  markPayoutSuccess,
} from "../services/payoutService.js";
import { createRefund as createPaystackRefund } from "../services/paystack/refunds.js";
import { createRefund as createStripeRefund } from "../services/stripe/refunds.js";
import {
  verifyPaystackSignature,
  buildEventId,
} from "../services/paystack/webhook.js";
import { writePaymentAudit } from "../utils/paymentAudit.js";
import {
  isPaystackConfigured,
  getPublicKey as getPaystackPublicKey,
} from "../services/paystack/client.js";
import {
  isStripeConfigured,
  getPublishableKey as getStripePublishableKey,
} from "../services/stripe/client.js";
import { PLAZORE_TRANSACTION_FEE_RATE } from "../config/payment.js";
import PaymentEvent from "../models/PaymentEvent.js";

const getUser = (req: Request) => (req as any).user;

function generateReference(prefix = "PLZ"): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `${prefix}_${ts}_${rnd}`;
}

function normalizeProvider(raw?: string | null): PaymentProvider {
  const p = String(raw || "paystack").toLowerCase().trim();
  return p === "stripe" ? "stripe" : "paystack";
}

/**
 * Mark unpaid orders as failed/cancelled AND release reserved stock.
 * Never touches already-paid orders.
 */
async function markOrdersPaymentFailed(
  orders: any[],
  reasonLabel: string,
  note?: string
) {
  for (const order of orders) {
    try {
      const o = order?.save ? order : await Order.findById(order._id || order);
      if (!o) continue;
      if (String(o.paymentStatus) === "paid") continue;

      o.paymentStatus = "failed";
      (o as any).paymentLifecycle = "PAYMENT_FAILED";
      o.orderStatus = "Cancelled";
      (o as any).cancellation = {
        cancelledBy: "system",
        reasonCode: "other",
        reasonLabel,
        note: note || reasonLabel,
        cancelledAt: new Date(),
        refundStatus: "not_applicable",
      };
      (o as any).payout = {
        ...(o as any).payout,
        status: "not_eligible",
        blockedReason: reasonLabel,
      };
      await o.save();

      await releaseStockForOrder(o._id.toString(), note || reasonLabel).catch(
        () => {}
      );
    } catch (e) {
      console.error("[markOrdersPaymentFailed]", e);
    }
  }
}

/** GET /api/payments/config — public keys only (both providers) */
export const getPaymentConfig = async (_req: Request, res: Response) => {
  const paystackOk = isPaystackConfigured();
  const stripeOk = isStripeConfigured();

  res.json({
    success: true,
    data: {
      feeRate: PLAZORE_TRANSACTION_FEE_RATE,
      feePercent: 8,
      providers: {
        paystack: {
          configured: paystackOk,
          publicKey: paystackOk ? getPaystackPublicKey() : null,
        },
        stripe: {
          configured: stripeOk,
          publicKey: stripeOk ? getStripePublishableKey() : null,
        },
      },
      // backward-compatible single fields (default to paystack)
      configured: paystackOk || stripeOk,
      publicKey: paystackOk
        ? getPaystackPublicKey()
        : stripeOk
          ? getStripePublishableKey()
          : null,
      provider: paystackOk ? "paystack" : stripeOk ? "stripe" : "none",
      available: [
        ...(paystackOk ? (["paystack"] as const) : []),
        ...(stripeOk ? (["stripe"] as const) : []),
      ],
    },
  });
};

/**
 * POST /api/payments/checkout
 * Body may include provider: "paystack" | "stripe"
 *
 * Multi-seller:
 * - Creates one order + one payment session per seller
 * - Returns payments[] — client must complete ALL ready sessions sequentially
 */
export const checkoutAndPay = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const {
      shippingAddress,
      buyerNote,
      phone,
      items: frontendItems,
      callbackUrl,
      paymentMethodId,
      provider: bodyProvider,
    } = req.body;

    const provider = normalizeProvider(bodyProvider);

    if (provider === "paystack" && !isPaystackConfigured()) {
      return res.status(503).json({
        success: false,
        code: "PAYSTACK_NOT_CONFIGURED",
        message:
          "Order unsuccessful. Payment is not available — Paystack is not connected. No order was placed and nothing was charged.",
        orderPlaced: false,
        paymentStatus: "failed",
      });
    }
    if (provider === "stripe" && !isStripeConfigured()) {
      return res.status(503).json({
        success: false,
        code: "STRIPE_NOT_CONFIGURED",
        message:
          "Order unsuccessful. Payment is not available — Stripe is not connected. No order was placed and nothing was charged.",
        orderPlaced: false,
        paymentStatus: "failed",
      });
    }

    if (!shippingAddress) {
      return res.status(400).json({
        success: false,
        message: "Order unsuccessful. Shipping address is required.",
        orderPlaced: false,
      });
    }

    let rawItems: Array<{
      productId: string;
      quantity: number;
      note?: string;
    }> = [];

    if (Array.isArray(frontendItems) && frontendItems.length > 0) {
      rawItems = frontendItems.map((i: any) => ({
        productId: String(i.productId || i.product),
        quantity: Number(i.quantity) || 1,
        note: i.note,
      }));
    } else {
      const cart = await Cart.findOne({ user: user._id }).populate(
        "items.product"
      );
      if (!cart || cart.items.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Order unsuccessful. Cart is empty.",
          orderPlaced: false,
        });
      }
      rawItems = cart.items.map((item: any) => ({
        productId: String(item.product?._id || item.product),
        quantity: item.quantity,
        note: item.note,
      }));
    }

    if (!rawItems.length) {
      return res.status(400).json({
        success: false,
        message: "Order unsuccessful. No items to checkout.",
        orderPlaced: false,
      });
    }

    const orders = await createPendingOrders({
      buyer: user,
      shippingAddress,
      buyerNote,
      phone,
      rawItems,
    });

    const payments: any[] = [];
    const failedOrderIds: string[] = [];

    for (const order of orders) {
      try {
        const init = await initializePaymentForOrder({
          orderId: order._id.toString(),
          buyer: user,
          callbackUrl,
          provider,
        });

        const isReady =
          provider === "stripe"
            ? !!init?.clientSecret
            : !!init?.authorizationUrl;

        if (!isReady) {
          throw new Error("No payment session returned from gateway");
        }

        payments.push({
          orderId: order._id,
          orderNumber: order.orderNumber,
          sellerId: order.seller,
          provider: init.provider,
          amount: init.amount,
          currency: init.currency,
          reference: init.reference,
          // Paystack
          authorizationUrl: init.authorizationUrl || null,
          authorization_url: init.authorizationUrl || null,
          accessCode: init.accessCode || null,
          // Stripe
          clientSecret: init.clientSecret || null,
          paymentIntentId: init.paymentIntentId || null,
          feeBreakdown: (order as any).feeBreakdown,
          status: "ready",
        });
      } catch (err: any) {
        failedOrderIds.push(order._id.toString());
        await releaseStockForOrder(
          order._id.toString(),
          err.message || "Payment initialization failed"
        ).catch(() => {});

        payments.push({
          orderId: order._id,
          orderNumber: order.orderNumber,
          sellerId: order.seller,
          provider,
          error: err.message || "Payment initialization failed",
          needsManualInit: true,
          status: "init_failed",
        });
      }
    }

    const viable = payments.filter(
      (p) =>
        p.status === "ready" &&
        (provider === "stripe" ? p.clientSecret : p.authorizationUrl)
    );

    if (viable.length === 0) {
      await markOrdersPaymentFailed(
        orders,
        "Payment unsuccessful",
        "Payment could not be started (gateway error, declined, or unavailable)"
      );

      return res.status(402).json({
        success: false,
        code: "PAYMENT_INIT_FAILED",
        message:
          "Order unsuccessful. Payment could not be started (declined, gateway error, or unavailable). No charge was made.",
        orderPlaced: false,
        paymentStatus: "failed",
        data: { payments },
      });
    }

    if (failedOrderIds.length) {
      await markOrdersPaymentFailed(
        failedOrderIds.map((id) => ({ _id: id })),
        "Payment unsuccessful",
        "Payment session could not be created for this order"
      );
    }

    const primary = viable[0];
    const publicKey =
      provider === "stripe"
        ? getStripePublishableKey()
        : getPaystackPublicKey();

    return res.status(201).json({
      success: true,
      orderPlaced: false,
      paymentRequired: true,
      paymentStatus: "pending",
      message:
        viable.length > 1
          ? `Complete payment for all ${viable.length} sellers. Order is not confirmed until each payment succeeds.`
          : "Complete payment to place your order. Your order is not confirmed until payment succeeds.",
      data: {
        provider,
        // Single-seller convenience
        authorization_url: primary.authorizationUrl,
        authorizationUrl: primary.authorizationUrl,
        accessCode: primary.accessCode,
        clientSecret: primary.clientSecret,
        paymentIntentId: primary.paymentIntentId,
        reference: primary.reference,
        amount: primary.amount,
        currency: primary.currency,
        orderId: primary.orderId,
        orderNumber: primary.orderNumber,
        orders: orders.map((o: any) => ({
          _id: o._id,
          orderNumber: o.orderNumber,
          paymentStatus: o.paymentStatus,
          totalAmount: o.totalAmount,
          region: o.region,
          currency: o.currency,
        })),
        payments,
        paymentsReady: viable.length,
        paymentsFailed: failedOrderIds.length,
        sellerCount: orders.length,
        requiresSequentialPayment: viable.length > 1,
        publicKey,
        feePercent: 8,
      },
    });
  } catch (error: any) {
    console.error("checkoutAndPay:", error);
    const isNotConfigured =
      error.name === "PaystackNotConfiguredError" ||
      error.name === "StripeNotConfiguredError" ||
      /paystack not|stripe not/i.test(String(error.message || ""));

    return res
      .status(error.statusCode || (isNotConfigured ? 503 : 500))
      .json({
        success: false,
        code: isNotConfigured
          ? error.name === "StripeNotConfiguredError"
            ? "STRIPE_NOT_CONFIGURED"
            : "PAYSTACK_NOT_CONFIGURED"
          : "CHECKOUT_FAILED",
        message:
          error.message ||
          "Order unsuccessful. Something went wrong during checkout.",
        orderPlaced: false,
        paymentStatus: "failed",
      });
  }
};

/** POST /api/payments/initialize — for an existing pending order */
export const initializePayment = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const { orderId, callbackUrl, provider: bodyProvider } = req.body;
    const provider = normalizeProvider(bodyProvider);

    if (provider === "paystack" && !isPaystackConfigured()) {
      return res.status(503).json({
        success: false,
        code: "PAYSTACK_NOT_CONFIGURED",
        message:
          "Order unsuccessful. Payment is not available — Paystack is not connected.",
        orderPlaced: false,
        paymentStatus: "failed",
      });
    }
    if (provider === "stripe" && !isStripeConfigured()) {
      return res.status(503).json({
        success: false,
        code: "STRIPE_NOT_CONFIGURED",
        message:
          "Order unsuccessful. Payment is not available — Stripe is not connected.",
        orderPlaced: false,
        paymentStatus: "failed",
      });
    }

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order unsuccessful. orderId is required.",
        orderPlaced: false,
      });
    }

    const result = await initializePaymentForOrder({
      orderId,
      buyer: user,
      callbackUrl,
      provider,
    });

    const isReady =
      provider === "stripe"
        ? !!result?.clientSecret
        : !!result?.authorizationUrl;

    if (!isReady) {
      return res.status(402).json({
        success: false,
        code: "PAYMENT_INIT_FAILED",
        message:
          "Order unsuccessful. Payment could not be started. Please try again.",
        orderPlaced: false,
        paymentStatus: "failed",
      });
    }

    res.json({
      success: true,
      orderPlaced: false,
      paymentRequired: true,
      paymentStatus: "pending",
      message:
        "Complete payment to confirm your order. Not successful until payment is verified.",
      data: {
        provider: result.provider,
        authorizationUrl: result.authorizationUrl,
        authorization_url: result.authorizationUrl,
        accessCode: result.accessCode,
        clientSecret: result.clientSecret,
        paymentIntentId: result.paymentIntentId,
        reference: result.reference,
        amount: result.amount,
        currency: result.currency,
        publicKey: result.publicKey,
        paymentId: result.payment._id,
        feePercent: 8,
      },
    });
  } catch (error: any) {
    const code = error.statusCode || 500;
    res.status(code).json({
      success: false,
      message:
        error.message || "Order unsuccessful. Payment could not be started.",
      code:
        error.name === "PaystackNotConfiguredError"
          ? "PAYSTACK_NOT_CONFIGURED"
          : error.name === "StripeNotConfiguredError"
            ? "STRIPE_NOT_CONFIGURED"
            : undefined,
      orderPlaced: false,
      paymentStatus: "failed",
    });
  }
};

/**
 * POST /api/payments/verify — body: { reference }
 * ONLY verified === true means order was successfully placed (paid).
 */
export const verifyPayment = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const { reference } = req.body;
    if (!reference) {
      return res.status(400).json({
        success: false,
        message: "Order unsuccessful. Payment reference is required.",
        orderPlaced: false,
      });
    }

    const payment = await Payment.findOne({ reference });
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Order unsuccessful. Payment not found for this reference.",
        orderPlaced: false,
      });
    }
    if (
      payment.buyer.toString() !== user._id.toString() &&
      user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized",
        orderPlaced: false,
      });
    }

    const result = await verifyPaymentByReference(reference, "api");
    const paid = result.payment.status === "success";

    res.json({
      success: true,
      data: {
        verified: paid,
        orderPlaced: paid,
        alreadyVerified: result.alreadyVerified,
        status: result.payment.status,
        paymentStatus: paid ? "paid" : result.payment.status,
        provider: result.payment.provider,
        lifecycle: result.payment.lifecycle,
        orderId: result.order?._id,
        orderNumber: result.order?.orderNumber,
        amount: result.payment.amount,
        currency: result.payment.currency,
        paidAt: result.payment.paidAt,
        failureReason: result.payment.failureReason || null,
        message: paid
          ? "Payment confirmed. Order placed successfully."
          : result.payment.status === "abandoned"
            ? "Order unsuccessful. Payment was abandoned. You can try again."
            : "Order unsuccessful. Payment failed, was declined, or was not completed. Please try again.",
      },
    });
  } catch (error: any) {
    const code = error.statusCode || 500;
    res.status(code).json({
      success: false,
      message:
        error.message || "Order unsuccessful. Payment verification failed.",
      code:
        error.name === "PaystackNotConfiguredError"
          ? "PAYSTACK_NOT_CONFIGURED"
          : error.name === "StripeNotConfiguredError"
            ? "STRIPE_NOT_CONFIGURED"
            : undefined,
      orderPlaced: false,
      paymentStatus: "failed",
    });
  }
};

/**
 * POST /api/payments/webhook
 * Must be mounted with express.raw({ type: 'application/json' })
 */
export const paystackWebhook = async (req: Request, res: Response) => {
  const signature = req.headers["x-paystack-signature"] as string | undefined;
  const rawBody = (req as any).rawBody || req.body;

  let bodyBuffer: Buffer;
  if (Buffer.isBuffer(rawBody)) {
    bodyBuffer = rawBody;
  } else if (typeof rawBody === "string") {
    bodyBuffer = Buffer.from(rawBody);
  } else {
    bodyBuffer = Buffer.from(JSON.stringify(req.body));
  }

  const signatureValid = verifyPaystackSignature(bodyBuffer, signature);

  let payload: any;
  try {
    payload =
      typeof req.body === "object" && !Buffer.isBuffer(req.body)
        ? req.body
        : JSON.parse(bodyBuffer.toString("utf8"));
  } catch {
    return res.status(400).send("Invalid JSON");
  }

  const event = payload?.event || "unknown";
  const eventId = buildEventId(event, payload?.data || {});

  res.status(200).json({ received: true });

  try {
    if (event === "charge.success") {
      await handleChargeSuccessWebhook(eventId, payload, signatureValid);
    } else if (event === "charge.failed") {
      const ref = payload?.data?.reference;
      if (ref && signatureValid) {
        const payment = await Payment.findOne({ reference: ref });
        if (payment && payment.status !== "success") {
          payment.status = "failed";
          payment.failureReason =
            payload?.data?.gateway_response ||
            payload?.data?.message ||
            "Charge failed";
          await payment.save();

          const order = await Order.findById(payment.order);
          if (order && String(order.paymentStatus) !== "paid") {
            await markOrdersPaymentFailed(
              [order],
              "Payment unsuccessful",
              payment.failureReason
            );
          }
        }
        await PaymentEvent.findOneAndUpdate(
          { eventId },
          {
            eventId,
            event,
            reference: ref,
            payload,
            signatureValid,
            processed: true,
            processedAt: new Date(),
            provider: "paystack",
          },
          { upsert: true }
        );
      }
    } else if (event === "transfer.success") {
      const ref = payload?.data?.reference;
      if (ref && signatureValid) {
        await markPayoutSuccess(ref, payload.data);
        await PaymentEvent.findOneAndUpdate(
          { eventId },
          {
            eventId,
            event,
            reference: ref,
            payload,
            signatureValid,
            processed: true,
            processedAt: new Date(),
            provider: "paystack",
          },
          { upsert: true }
        );
      }
    } else if (event === "transfer.failed" || event === "transfer.reversed") {
      await PaymentEvent.findOneAndUpdate(
        { eventId },
        {
          eventId,
          event,
          reference: payload?.data?.reference,
          payload,
          signatureValid,
          processed: true,
          processedAt: new Date(),
          provider: "paystack",
        },
        { upsert: true }
      );
    } else if (
      event === "refund.processed" ||
      event === "refund.failed" ||
      event === "refund.pending" ||
      event === "refund.processing"
    ) {
      await PaymentEvent.findOneAndUpdate(
        { eventId },
        {
          eventId,
          event,
          reference:
            payload?.data?.transaction_reference || payload?.data?.reference,
          payload,
          signatureValid,
          processed: true,
          processedAt: new Date(),
          provider: "paystack",
        },
        { upsert: true }
      );
    } else {
      await PaymentEvent.findOneAndUpdate(
        { eventId },
        {
          eventId,
          event,
          payload,
          signatureValid,
          processed: true,
          processedAt: new Date(),
          provider: "paystack",
        },
        { upsert: true }
      );
    }
  } catch (err) {
    console.error("[webhook] processing error:", err);
  }
};

/** GET /api/payments/order/:orderId — payment details for order UI */
export const getPaymentForOrder = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const order = await Order.findById(req.params.orderId);
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }
    const isBuyer = order.buyer.toString() === user._id.toString();
    const isSeller = order.seller.toString() === user._id.toString();
    if (!isBuyer && !isSeller && user.role !== "admin") {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    const payment = await Payment.findOne({ order: order._id });
    const fb = (order as any).feeBreakdown;

    res.json({
      success: true,
      data: {
        lifecycle: (order as any).paymentLifecycle || "PENDING_PAYMENT",
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        orderStatus: order.orderStatus,
        orderPlaced: order.paymentStatus === "paid",
        region: (order as any).region,
        currency: (order as any).currency || fb?.currency,
        buyerConfirmation: (order as any).buyerConfirmation,
        payout:
          isSeller || user.role === "admin"
            ? (order as any).payout
            : undefined,
        feeBreakdown:
          isSeller || user.role === "admin" || isBuyer
            ? {
                subtotal: fb?.subtotal ?? order.subtotal,
                shippingCost: fb?.shippingCost ?? order.shippingCost,
                grossAmount: fb?.grossAmount ?? order.totalAmount,
                platformFeeRate: fb?.platformFeeRate ?? 0.08,
                platformFee:
                  isSeller || user.role === "admin"
                    ? fb?.platformFee
                    : undefined,
                sellerPayoutAmount:
                  isSeller || user.role === "admin"
                    ? fb?.sellerPayoutAmount
                    : undefined,
                currency: fb?.currency || (order as any).currency,
                region: fb?.region || (order as any).region,
              }
            : undefined,
        payment: payment
          ? {
              reference: payment.reference,
              provider: payment.provider,
              status: payment.status,
              amount: payment.amount,
              currency: payment.currency,
              paidAt: payment.paidAt,
              channel: payment.channel,
              failureReason: payment.failureReason,
            }
          : null,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/** POST /api/payments/disputes/:orderId/open */
export const openDispute = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const order = await Order.findById(req.params.orderId);
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    const existing = await OrderDispute.findOne({ order: order._id });
    if (
      existing &&
      !["closed", "resolved_buyer", "resolved_seller"].includes(existing.status)
    ) {
      return res.json({ success: true, data: existing, alreadyOpen: true });
    }

    const payment = await Payment.findOne({ order: order._id });
    const fb = (order as any).feeBreakdown || {};

    const dispute = await OrderDispute.create({
      order: order._id,
      payment: payment?._id,
      buyer: order.buyer,
      seller: order.seller,
      reason: req.body.reason || "Delivery / payment issue",
      description: req.body.description || "",
      status: "open",
      amountPaid: payment?.amount || order.totalAmount,
      shippingCost: order.shippingCost,
      platformFee: fb.platformFee || 0,
      currency:
        fb.currency ||
        (order as any).currency ||
        payment?.currency ||
        "NGN",
      paymentReference: payment?.reference || "",
      events: [
        {
          at: new Date(),
          actor: user.role === "admin" ? "admin" : "buyer",
          action: "opened",
          note: req.body.reason || "",
        },
      ],
    });

    (order as any).paymentLifecycle = "DISPUTED";
    (order as any).payout = {
      ...(order as any).payout,
      status: "blocked_issue",
      blockedReason: "Dispute open",
    };
    await order.save();

    await writePaymentAudit({
      order: order._id.toString(),
      dispute: dispute._id.toString(),
      action: "dispute.opened",
      actorType: user.role === "admin" ? "admin" : "buyer",
      actorId: user._id.toString(),
      toLifecycle: "DISPUTED",
    });

    res.status(201).json({ success: true, data: dispute });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/** POST /api/payments/admin/disputes/:orderId/refund-buyer */
export const adminRefundBuyer = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    if (user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Admin only" });
    }

    const order = await Order.findById(req.params.orderId);
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    const payment = await Payment.findOne({ order: order._id });
    if (!payment || payment.status !== "success") {
      return res.status(400).json({
        success: false,
        message: "No successful payment to refund",
      });
    }

    (order as any).payout = {
      ...(order as any).payout,
      status: "refunded",
      blockedReason: "Admin refund to buyer",
    };
    (order as any).paymentLifecycle = "REFUND_PENDING";
    order.paymentStatus = "refunded";
    await order.save();

    const refundRef = generateReference("PLZRF");
    const refundDoc = await Refund.create({
      order: order._id,
      payment: payment._id,
      buyer: order.buyer,
      amount: payment.amount,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      status: "pending",
      reason: req.body.reason || "Admin resolution — buyer favour",
      merchantNote: req.body.note || "",
      reference: refundRef,
      transactionReference: payment.reference,
      initiatedBy: "admin",
      adminId: user._id,
    });

    const provider = String(payment.provider || "paystack").toLowerCase();

    if (provider === "stripe") {
      try {
        const intentId =
          payment.stripePaymentIntentId || payment.providerTransactionId;
        if (!intentId) {
          throw new Error("Missing Stripe PaymentIntent ID for refund");
        }
        const sr = await createStripeRefund({
          paymentIntentId: String(intentId),
          amountMajor: payment.amount,
          currency: payment.currency,
          reason: "requested_by_customer",
          reference: refundRef,
          orderId: order._id.toString(),
        });
        refundDoc.status = "processing";
        refundDoc.providerRefundId = String(sr?.refundId || "");
        await refundDoc.save();
      } catch (err: any) {
        refundDoc.status = "failed";
        refundDoc.failureReason = err.message;
        await refundDoc.save();
        return res.status(502).json({
          success: false,
          message: "Stripe refund failed: " + err.message,
          data: refundDoc,
        });
      }
    } else {
      try {
        const ps = await createPaystackRefund({
          transaction: payment.reference,
          customer_note:
            req.body.reason || "Order dispute resolved in your favour",
          merchant_note: `Plazore admin refund ${refundRef}`,
        });
        refundDoc.status = "processing";
        refundDoc.providerRefundId = String(
          ps?.id || ps?.transaction?.id || ""
        );
        await refundDoc.save();
      } catch (err: any) {
        refundDoc.status = "failed";
        refundDoc.failureReason = err.message;
        await refundDoc.save();
        return res.status(502).json({
          success: false,
          message: "Paystack refund failed: " + err.message,
          data: refundDoc,
        });
      }
    }

    const dispute = await OrderDispute.findOne({ order: order._id });
    if (dispute) {
      dispute.status = "resolved_buyer";
      dispute.resolution = "REFUND_BUYER";
      dispute.resolutionNote = req.body.note || "";
      dispute.resolvedAt = new Date();
      dispute.resolvedBy = user._id;
      dispute.refund = refundDoc._id;
      dispute.events.push({
        at: new Date(),
        actor: "admin",
        action: "REFUND_BUYER",
        note: req.body.note || "",
      });
      await dispute.save();
    }

    (order as any).paymentLifecycle = "REFUNDED";
    await order.save();

    await writePaymentAudit({
      order: order._id.toString(),
      payment: payment._id.toString(),
      refund: refundDoc._id.toString(),
      action: "dispute.resolved_buyer_refund",
      actorType: "admin",
      actorId: user._id.toString(),
      toLifecycle: "REFUNDED",
      amount: payment.amount,
      currency: payment.currency,
      reference: refundRef,
      meta: { provider },
    });

    res.json({ success: true, data: { refund: refundDoc, order } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/** POST /api/payments/admin/disputes/:orderId/settle-seller */
export const adminSettleSeller = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    if (user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Admin only" });
    }

    const order = await Order.findById(req.params.orderId);
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    (order as any).paymentLifecycle = "SETTLED_SELLER_FAVOUR";
    (order as any).payout = {
      ...(order as any).payout,
      status: "eligible",
      eligibleAt: new Date(),
      blockedReason: "",
    };
    (order as any).buyerConfirmation = {
      ...(order as any).buyerConfirmation,
      status: "confirmed",
      confirmedAt: new Date(),
    };
    await order.save();

    const dispute = await OrderDispute.findOne({ order: order._id });
    if (dispute) {
      dispute.status = "resolved_seller";
      dispute.resolution = "SETTLE_SELLER_FAVOUR";
      dispute.resolutionNote = req.body.note || "";
      dispute.resolvedAt = new Date();
      dispute.resolvedBy = user._id;
      dispute.events.push({
        at: new Date(),
        actor: "admin",
        action: "SETTLE_SELLER_FAVOUR",
        note: req.body.note || "",
      });
      await dispute.save();
    }

    await writePaymentAudit({
      order: order._id.toString(),
      action: "dispute.resolved_seller",
      actorType: "admin",
      actorId: user._id.toString(),
      toLifecycle: "SETTLED_SELLER_FAVOUR",
      note: req.body.note || "",
    });

    let payoutResult = null;
    try {
      payoutResult = await processSellerPayout(order._id.toString(), {
        triggeredBy: "admin",
        adminId: user._id.toString(),
      });
    } catch (err: any) {
      return res.json({
        success: true,
        message:
          "Settled in seller favour; payout queued but transfer failed: " +
          err.message,
        data: { order, payoutError: err.message },
      });
    }

    res.json({
      success: true,
      data: { order, payout: payoutResult?.payout },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
