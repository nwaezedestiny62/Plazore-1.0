import crypto from "crypto";
import Order from "../models/Order.js";
import User from "../models/User.js";
import Payment from "../models/Payment.js";
import Payout from "../models/Payout.js";
import {
  calculateSellerPayout,
  PLAZORE_TRANSACTION_FEE_RATE,
  toPaystackAmount,
  currencyForRegion,
} from "../config/payment.js";
import {
  createTransferRecipient,
  initiateTransfer,
} from "./paystack/transfers.js";
import { isPaystackConfigured } from "./paystack/client.js";
import { isStripeConfigured } from "./stripe/client.js";
import { writePaymentAudit } from "../utils/paymentAudit.js";
import { sendNotification } from "../utils/sendNotification.js";

function generatePayoutRef(): string {
  return `PLZPO_${Date.now().toString(36).toUpperCase()}_${crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase()}`;
}

/**
 * Mark delivery confirmed (buyer or auto) and make payout eligible.
 * Does NOT transfer money yet — that is processSellerPayout / job.
 */
export async function markDeliveryConfirmed(
  orderId: string,
  mode: "buyer" | "auto",
  actorId?: string
) {
  const order = await Order.findById(orderId);
  if (!order)
    throw Object.assign(new Error("Order not found"), { statusCode: 404 });

  if (order.orderStatus !== "Delivered") {
    throw Object.assign(new Error("Order is not in Delivered state"), {
      statusCode: 400,
    });
  }

  const conf = (order as any).buyerConfirmation || {};
  if (conf.status === "confirmed" || conf.status === "auto_confirmed") {
    return { order, already: true };
  }
  if (conf.status === "issue_reported") {
    throw Object.assign(
      new Error("Active delivery issue — cannot confirm"),
      { statusCode: 400 }
    );
  }
  if ((order as any).paymentLifecycle === "DISPUTED") {
    throw Object.assign(new Error("Order is disputed"), { statusCode: 400 });
  }

  const fees =
    (order as any).feeBreakdown ||
    calculateSellerPayout(order.subtotal, order.shippingCost);

  (order as any).buyerConfirmation = {
    ...conf,
    status: mode === "auto" ? "auto_confirmed" : "confirmed",
    confirmedAt: new Date(),
  };
  (order as any).payout = {
    status: "eligible",
    eligibleAt: new Date(),
    blockedReason: "",
    amount: fees.sellerPayoutAmount,
    platformFee: fees.platformFee,
  };
  (order as any).paymentLifecycle = "DELIVERY_CONFIRMED";
  await order.save();

  await writePaymentAudit({
    order: order._id.toString(),
    payment: (order as any).paymentRef?.toString?.() || null,
    action:
      mode === "auto"
        ? "delivery.auto_confirmed"
        : "delivery.confirmed_by_buyer",
    actorType: mode === "auto" ? "system" : "buyer",
    actorId: actorId || null,
    toLifecycle: "DELIVERY_CONFIRMED",
    amount: fees.sellerPayoutAmount,
  });

  await sendNotification({
    userId: order.seller.toString(),
    type: "order_delivered",
    title: "Delivery confirmed — payout pending",
    message: `Delivery confirmed for ${order.orderNumber}. Payout will be processed shortly.`,
    orderId: order._id.toString(),
    orderNumber: order.orderNumber,
  }).catch(() => {});

  return { order, already: false };
}

/**
 * Initiate seller payout for an eligible order.
 * - Paystack-paid orders → Paystack Transfer
 * - Stripe-paid orders → queue only (no silent Paystack transfer)
 * Guarded against double payout.
 */
export async function processSellerPayout(
  orderId: string,
  opts?: { triggeredBy?: "system" | "admin" | "manual"; adminId?: string }
) {
  const order = await Order.findById(orderId);
  if (!order)
    throw Object.assign(new Error("Order not found"), { statusCode: 404 });

  if (order.paymentStatus !== "paid") {
    throw Object.assign(new Error("Order is not paid"), { statusCode: 400 });
  }
  if ((order as any).paymentLifecycle === "DISPUTED") {
    throw Object.assign(new Error("Order is disputed"), { statusCode: 400 });
  }
  if ((order as any).paymentLifecycle === "SELLER_PAID") {
    throw Object.assign(new Error("Seller already paid"), { statusCode: 400 });
  }
  if ((order as any).paymentLifecycle === "REFUNDED") {
    throw Object.assign(new Error("Order was refunded"), { statusCode: 400 });
  }

  const payoutStatus = (order as any).payout?.status;
  if (!["eligible", "queued", "failed"].includes(String(payoutStatus))) {
    throw Object.assign(
      new Error(`Payout not eligible (status: ${payoutStatus})`),
      { statusCode: 400 }
    );
  }

  const existing = await Payout.findOne({
    order: order._id,
    status: { $in: ["success", "initiated"] },
  });
  if (existing) {
    throw Object.assign(new Error("Payout already initiated or completed"), {
      statusCode: 400,
    });
  }

  const seller = await User.findById(order.seller);
  if (!seller)
    throw Object.assign(new Error("Seller not found"), { statusCode: 404 });

  const payment = await Payment.findOne({ order: order._id });
  if (!payment) {
    throw Object.assign(new Error("Paid order has no payment record"), {
      statusCode: 400,
    });
  }

  const paymentProvider = String(
    payment.provider || order.paymentMethod || "paystack"
  ).toLowerCase();

  const fees =
    (order as any).feeBreakdown ||
    calculateSellerPayout(order.subtotal, order.shippingCost);
  const currency =
    fees.currency ||
    payment.currency ||
    currencyForRegion(String((order as any).region || "NG"));

  const reference = generatePayoutRef();

  // ── Stripe-paid orders: queue only. Do NOT use Paystack transfer. ──
  if (paymentProvider === "stripe") {
    if (!isStripeConfigured()) {
      throw Object.assign(
        new Error(
          "Stripe not configured — cannot process Stripe-order payouts"
        ),
        { statusCode: 503 }
      );
    }

    const stripeNote =
      "Stripe Connect transfer not automated yet — queued for admin release";

    let payoutDoc = await Payout.findOne({ order: order._id });
    if (!payoutDoc) {
      payoutDoc = await Payout.create({
        order: order._id,
        payment: payment._id,
        seller: order.seller,
        provider: "stripe",
        grossAmount: fees.grossAmount,
        platformFee: fees.platformFee,
        platformFeeRate: PLAZORE_TRANSACTION_FEE_RATE,
        shippingCost: order.shippingCost,
        subtotal: order.subtotal,
        amount: fees.sellerPayoutAmount,
        amountMinor: toPaystackAmount(fees.sellerPayoutAmount, currency),
        currency,
        status: "queued",
        reference,
        bankSnapshot: {
          bankName: (seller as any).payout?.bankName || "",
          accountName: (seller as any).payout?.accountName || "",
          accountNumberLast4: String(
            (seller as any).payout?.accountNumber || ""
          ).slice(-4),
          accountNumber: (seller as any).payout?.accountNumber || "",
        },
        triggeredBy: opts?.triggeredBy || "system",
        adminId: opts?.adminId || null,
        failureReason: stripeNote,
      });
    } else {
      payoutDoc.reference = reference;
      payoutDoc.status = "queued";
      payoutDoc.provider = "stripe";
      payoutDoc.failureReason = stripeNote;
      await payoutDoc.save();
    }

    (order as any).payout = {
      status: "queued",
      eligibleAt: (order as any).payout?.eligibleAt,
      blockedReason:
        "Stripe payout queued — complete Connect transfer or admin release",
      amount: fees.sellerPayoutAmount,
      platformFee: fees.platformFee,
      reference,
      payoutDocId: payoutDoc._id,
    };
    (order as any).paymentLifecycle = "SELLER_PAYOUT_PENDING";
    await order.save();

    await writePaymentAudit({
      order: order._id.toString(),
      payment: payment._id.toString(),
      payout: payoutDoc._id.toString(),
      action: "payout.queued_stripe",
      actorType: opts?.triggeredBy === "admin" ? "admin" : "system",
      actorId: opts?.adminId || null,
      toLifecycle: "SELLER_PAYOUT_PENDING",
      amount: fees.sellerPayoutAmount,
      currency,
      reference,
      meta: { provider: "stripe", note: "Awaiting Connect/admin release" },
    });

    return {
      payout: payoutDoc,
      order,
      transfer: null,
      provider: "stripe" as const,
      queuedOnly: true,
    };
  }

  // ── Paystack path ──
  const bank = (seller as any).payout || {};
  if (!bank.accountNumber || !bank.bankName || !bank.accountName) {
    (order as any).payout = {
      ...(order as any).payout,
      status: "failed",
      blockedReason: "Seller bank details incomplete",
    };
    await order.save();
    throw Object.assign(
      new Error("Seller has not completed payout bank details"),
      { statusCode: 400 }
    );
  }

  if (!isPaystackConfigured()) {
    throw Object.assign(
      new Error("Paystack not configured — cannot transfer"),
      { statusCode: 503 }
    );
  }

  const bankCode =
    (bank as any).bankCode || process.env.PAYSTACK_DEFAULT_BANK_CODE;
  if (!bankCode) {
    throw Object.assign(
      new Error(
        "Seller bank code missing. Add bankCode to seller payout profile or set PAYSTACK_DEFAULT_BANK_CODE for testing."
      ),
      { statusCode: 400 }
    );
  }

  let recipientCode = (seller as any).paystackRecipientCode;
  if (!recipientCode) {
    const recipient = await createTransferRecipient({
      name: bank.accountName,
      account_number: bank.accountNumber,
      bank_code: bankCode,
      currency,
    });
    recipientCode = recipient.recipient_code;
    await User.findByIdAndUpdate(seller._id, {
      $set: { paystackRecipientCode: recipientCode },
    });
  }

  let payoutDoc = await Payout.findOne({ order: order._id });
  if (!payoutDoc) {
    payoutDoc = await Payout.create({
      order: order._id,
      payment: payment._id,
      seller: order.seller,
      provider: "paystack",
      grossAmount: fees.grossAmount,
      platformFee: fees.platformFee,
      platformFeeRate: PLAZORE_TRANSACTION_FEE_RATE,
      shippingCost: order.shippingCost,
      subtotal: order.subtotal,
      amount: fees.sellerPayoutAmount,
      amountMinor: toPaystackAmount(fees.sellerPayoutAmount, currency),
      currency,
      status: "queued",
      reference,
      recipientCode,
      bankSnapshot: {
        bankName: bank.bankName || "",
        accountName: bank.accountName || "",
        accountNumberLast4: String(bank.accountNumber).slice(-4),
        accountNumber: bank.accountNumber,
      },
      triggeredBy: opts?.triggeredBy || "system",
      adminId: opts?.adminId || null,
    });
  } else {
    payoutDoc.reference = reference;
    payoutDoc.status = "queued";
    payoutDoc.recipientCode = recipientCode;
    payoutDoc.provider = "paystack";
    await payoutDoc.save();
  }

  (order as any).payout = {
    status: "queued",
    eligibleAt: (order as any).payout?.eligibleAt,
    blockedReason: "",
    amount: fees.sellerPayoutAmount,
    platformFee: fees.platformFee,
    reference,
    payoutDocId: payoutDoc._id,
  };
  (order as any).paymentLifecycle = "SELLER_PAYOUT_PENDING";
  await order.save();

  try {
    const transfer = await initiateTransfer({
      amountMajor: fees.sellerPayoutAmount,
      recipientCode,
      reference,
      reason: `Plazore payout ${order.orderNumber}`,
      currency,
    });

    payoutDoc.status = "initiated";
    payoutDoc.providerTransferCode = transfer.transfer_code;
    payoutDoc.providerTransferId = String(transfer.id);
    payoutDoc.initiatedAt = new Date();
    await payoutDoc.save();

    (order as any).payout.status = "initiated";
    await order.save();

    await writePaymentAudit({
      order: order._id.toString(),
      payment: payment._id.toString(),
      payout: payoutDoc._id.toString(),
      action: "payout.initiated",
      actorType: opts?.triggeredBy === "admin" ? "admin" : "system",
      actorId: opts?.adminId || null,
      toLifecycle: "SELLER_PAYOUT_PENDING",
      amount: fees.sellerPayoutAmount,
      currency,
      reference,
      meta: { provider: "paystack" },
    });

    return {
      payout: payoutDoc,
      order,
      transfer,
      provider: "paystack" as const,
      queuedOnly: false,
    };
  } catch (err: any) {
    payoutDoc.status = "failed";
    payoutDoc.failureReason = err.message || "Transfer failed";
    await payoutDoc.save();
    (order as any).payout.status = "failed";
    (order as any).payout.blockedReason = payoutDoc.failureReason;
    await order.save();

    await writePaymentAudit({
      order: order._id.toString(),
      payout: payoutDoc._id.toString(),
      action: "payout.failed",
      actorType: "system",
      note: payoutDoc.failureReason,
      reference,
    });

    throw err;
  }
}

/** Called from transfer.success webhook (Paystack) or admin mark for Stripe */
export async function markPayoutSuccess(reference: string, payload?: any) {
  const payout = await Payout.findOne({ reference });
  if (!payout) return { ok: false, error: "Payout not found" };
  if (payout.status === "success") return { ok: true, duplicate: true };

  payout.status = "success";
  payout.completedAt = new Date();
  payout.failureReason = "";
  await payout.save();

  const order = await Order.findById(payout.order);
  if (order) {
    (order as any).payout = {
      ...(order as any).payout,
      status: "completed",
      reference: payout.reference,
      blockedReason: "",
    };
    (order as any).paymentLifecycle = "SELLER_PAID";
    await order.save();
  }

  await writePaymentAudit({
    order: payout.order.toString(),
    payout: payout._id.toString(),
    action: "payout.completed",
    actorType: "webhook",
    toLifecycle: "SELLER_PAID",
    amount: payout.amount,
    currency: payout.currency,
    reference,
    meta: payload || {},
  });

  await sendNotification({
    userId: payout.seller.toString(),
    type: "order_delivered",
    title: "Payout released",
    message: `Your payout for order has been released.`,
    orderId: payout.order.toString(),
  }).catch(() => {});

  return { ok: true, duplicate: false };
}