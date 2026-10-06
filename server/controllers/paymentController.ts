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
  generateReference,
} from "../services/paymentService.js";
import { processSellerPayout, markPayoutSuccess } from "../services/payoutService.js";
import { createRefund } from "../services/paystack/refunds.js";
import { verifyPaystackSignature, buildEventId } from "../services/paystack/webhook.js";
import { writePaymentAudit } from "../utils/paymentAudit.js";
import { isPaystackConfigured, getPublicKey } from "../services/paystack/client.js";
import { PLAZORE_TRANSACTION_FEE_RATE, toPaystackAmount } from "../config/payment.js";
import PaymentEvent from "../models/PaymentEvent.js";

const getUser = (req: Request) => (req as any).user;

/** GET /api/payments/config — public key only */
export const getPaymentConfig = async (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      configured: isPaystackConfigured(),
      publicKey: getPublicKey(),
      feeRate: PLAZORE_TRANSACTION_FEE_RATE,
      feePercent: 8,
      provider: "paystack",
    },
  });
};

/**
 * POST /api/payments/checkout
 * Body: { shippingAddress, buyerNote?, phone?, items? }
 * Creates pending order(s) + initializes payment for the first (or returns multi-order info).
 *
 * Multi-seller carts produce multiple orders; each needs its own payment.
 * For simplicity, initialize the first and return all order ids.
 */
export const checkoutAndPay = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const { shippingAddress, buyerNote, phone, items: frontendItems, callbackUrl } =
      req.body;

    if (!shippingAddress) {
      return res.status(400).json({
        success: false,
        message: "Shipping address is required",
      });
    }

    let rawItems: Array<{ productId: string; quantity: number; note?: string }> =
      [];

    if (Array.isArray(frontendItems) && frontendItems.length > 0) {
      rawItems = frontendItems.map((i: any) => ({
        productId: String(i.productId || i.product),
        quantity: Number(i.quantity) || 1,
        note: i.note,
      }));
    } else {
      const cart = await Cart.findOne({ user: user._id }).populate("items.product");
      if (!cart || cart.items.length === 0) {
        return res.status(400).json({ success: false, message: "Cart is empty" });
      }
      rawItems = cart.items.map((item: any) => ({
        productId: String(item.product?._id || item.product),
        quantity: item.quantity,
        note: item.note,
      }));
    }

    const orders = await createPendingOrders({
      buyer: user,
      shippingAddress,
      buyerNote,
      phone,
      rawItems,
    });

    // Clear cart
    try {
      const cart = await Cart.findOne({ user: user._id });
      if (cart) {
        cart.items = [];
        (cart as any).totalAmount = 0;
        await cart.save();
      }
    } catch {
      /* non-fatal */
    }

    // Initialize payment for each order (multi-seller = multiple Paystack sessions)
    const payments = [];
    for (const order of orders) {
      try {
        const init = await initializePaymentForOrder({
          orderId: order._id.toString(),
          buyer: user,
          callbackUrl,
        });
        payments.push({
          orderId: order._id,
          orderNumber: order.orderNumber,
          amount: init.amount,
          currency: init.currency,
          authorizationUrl: init.authorizationUrl,
          accessCode: init.accessCode,
          reference: init.reference,
          feeBreakdown: (order as any).feeBreakdown,
        });
      } catch (err: any) {
        payments.push({
          orderId: order._id,
          orderNumber: order.orderNumber,
          error: err.message,
          needsManualInit: true,
        });
      }
    }

    res.status(201).json({
      success: true,
      message: "Order(s) created — complete payment",
      data: {
        orders,
        payments,
        publicKey: getPublicKey(),
        feePercent: 8,
      },
    });
  } catch (error: any) {
    const code = error.statusCode || 500;
    console.error("checkoutAndPay:", error);
    res.status(code).json({
      success: false,
      message: error.message || "Checkout failed",
      code: error.name === "PaystackNotConfiguredError" ? "PAYSTACK_NOT_CONFIGURED" : undefined,
    });
  }
};

/** POST /api/payments/initialize — for an existing pending order */
export const initializePayment = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const { orderId, callbackUrl } = req.body;
    if (!orderId) {
      return res.status(400).json({ success: false, message: "orderId required" });
    }

    const result = await initializePaymentForOrder({
      orderId,
      buyer: user,
      callbackUrl,
    });

    res.json({
      success: true,
      data: {
        authorizationUrl: result.authorizationUrl,
        accessCode: result.accessCode,
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
      message: error.message,
      code: error.name === "PaystackNotConfiguredError" ? "PAYSTACK_NOT_CONFIGURED" : undefined,
    });
  }
};

/** POST /api/payments/verify — body: { reference } */
export const verifyPayment = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const { reference } = req.body;
    if (!reference) {
      return res.status(400).json({ success: false, message: "reference required" });
    }

    const payment = await Payment.findOne({ reference });
    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }
    if (
      payment.buyer.toString() !== user._id.toString() &&
      user.role !== "admin"
    ) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const result = await verifyPaymentByReference(reference, "api");

    const success = result.payment.status === "success";
    res.json({
      success: true,
      data: {
        verified: success,
        alreadyVerified: result.alreadyVerified,
        status: result.payment.status,
        lifecycle: result.payment.lifecycle,
        orderId: result.order?._id,
        orderNumber: result.order?.orderNumber,
        amount: result.payment.amount,
        currency: result.payment.currency,
        paidAt: result.payment.paidAt,
        failureReason: result.payment.failureReason || null,
        message: success
          ? "Payment confirmed"
          : result.payment.status === "abandoned"
            ? "Payment was abandoned. You can try again."
            : "Payment was unsuccessful. Please try again or use another method.",
      },
    });
  } catch (error: any) {
    const code = error.statusCode || 500;
    res.status(code).json({
      success: false,
      message: error.message || "Verification failed",
      code: error.name === "PaystackNotConfiguredError" ? "PAYSTACK_NOT_CONFIGURED" : undefined,
    });
  }
};

/**
 * POST /api/payments/webhook
 * Must be mounted with express.raw({ type: 'application/json' })
 */
export const paystackWebhook = async (req: Request, res: Response) => {
  // Always 200 quickly after accept to avoid Paystack retries storm — process async if needed
  const signature = req.headers["x-paystack-signature"] as string | undefined;
  const rawBody = (req as any).rawBody || req.body;

  // If body was parsed as Buffer
  let bodyBuffer: Buffer;
  if (Buffer.isBuffer(rawBody)) {
    bodyBuffer = rawBody;
  } else if (typeof rawBody === "string") {
    bodyBuffer = Buffer.from(rawBody);
  } else {
    // Fallback — less secure if already parsed
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

  // Respond 200 immediately for valid structure; process below
  res.status(200).json({ received: true });

  try {
    if (event === "charge.success") {
      await handleChargeSuccessWebhook(eventId, payload, signatureValid);
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
          },
          { upsert: true }
        );
      }
    } else if (event === "transfer.failed" || event === "transfer.reversed") {
      // Log for ops
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
          reference: payload?.data?.transaction_reference || payload?.data?.reference,
          payload,
          signatureValid,
          processed: true,
          processedAt: new Date(),
        },
        { upsert: true }
      );
      // Optionally sync Refund document status here
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
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    const isBuyer = order.buyer.toString() === user._id.toString();
    const isSeller = order.seller.toString() === user._id.toString();
    if (!isBuyer && !isSeller && user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const payment = await Payment.findOne({ order: order._id });
    const fb = (order as any).feeBreakdown;

    res.json({
      success: true,
      data: {
        lifecycle: (order as any).paymentLifecycle || "PENDING_PAYMENT",
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
        buyerConfirmation: (order as any).buyerConfirmation,
        payout: isSeller || user.role === "admin" ? (order as any).payout : undefined,
        feeBreakdown:
          isSeller || user.role === "admin" || isBuyer
            ? {
                subtotal: fb?.subtotal ?? order.subtotal,
                shippingCost: fb?.shippingCost ?? order.shippingCost,
                grossAmount: fb?.grossAmount ?? order.totalAmount,
                platformFeeRate: fb?.platformFeeRate ?? 0.08,
                platformFee: isSeller || user.role === "admin" ? fb?.platformFee : undefined,
                sellerPayoutAmount:
                  isSeller || user.role === "admin" ? fb?.sellerPayoutAmount : undefined,
                currency: fb?.currency,
              }
            : undefined,
        payment: payment
          ? {
              reference: payment.reference,
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

// ---------- Admin dispute resolution ----------

/** POST /api/payments/admin/disputes/:orderId/open */
export const openDispute = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const order = await Order.findById(req.params.orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const existing = await OrderDispute.findOne({ order: order._id });
    if (existing && !["closed", "resolved_buyer", "resolved_seller"].includes(existing.status)) {
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
      currency: fb.currency || payment?.currency || "NGN",
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
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const payment = await Payment.findOne({ order: order._id });
    if (!payment || payment.status !== "success") {
      return res.status(400).json({
        success: false,
        message: "No successful payment to refund",
      });
    }

    // Block seller payout permanently for this order
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

    try {
      const ps = await createRefund({
        transaction: payment.reference,
        customer_note: req.body.reason || "Order dispute resolved in your favour",
        merchant_note: `Plazore admin refund ${refundRef}`,
      });
      refundDoc.status = "processing";
      refundDoc.providerRefundId = String(ps?.id || ps?.transaction?.id || "");
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
      return res.status(404).json({ success: false, message: "Order not found" });
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

    // Attempt payout immediately
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
