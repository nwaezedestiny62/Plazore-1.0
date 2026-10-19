/**
 * Admin monetization — failed payments desk + revenue / GMV board.
 * Mount under /api/admin/monetization/*
 */
import { Request, Response } from "express";
import mongoose, { type Model } from "mongoose";
import OrderModel from "../models/Order.js";
import PayoutModel from "../models/Payout.js";
import PaymentModel from "../models/Payment.js";
import RefundModel from "../models/Refund.js";
import UserModel from "../models/User.js";
import SellerSubscriptionModel from "../models/SellerSubscription.js";
import NotificationModel from "../models/Notification.js";

/**
 * Mongoose 9 types filters from the schema. These admin queries use $or,
 * dotted paths and mixed shapes that fail the FilterQuery overloads on
 * countDocuments / updateMany / aggregate. Cast to Model<any> so tsc passes.
 * Writes that must persist still use real enum values below.
 */
const Order = OrderModel as Model<any>;
const Payout = PayoutModel as Model<any>;
const Payment = PaymentModel as Model<any>;
const Refund = RefundModel as Model<any>;
const User = UserModel as Model<any>;
const SellerSubscription = SellerSubscriptionModel as Model<any>;
const Notification = NotificationModel as Model<any>;

function httpError(statusCode: number, message: string) {
  return Object.assign(new Error(message), { statusCode });
}

async function safeNotify(opts: {
  user: any;
  title: string;
  message: string;
  type?: string;
  order?: any;
}) {
  try {
    if (!opts.user) return;
    const notifyType =
      opts.type === "payout" || opts.type === "payment_released"
        ? "payment_released"
        : opts.type === "payment" || opts.type === "payment_pending_release"
          ? "payment_pending_release"
          : "general";
    await Notification.create({
      user: opts.user,
      title: opts.title,
      message: opts.message,
      type: notifyType,
      order: opts.order || undefined,
      isRead: false,
    });
  } catch (e) {
    console.warn("monetization notify failed", e);
  }
}

const PAID_STATUSES = ["paid"];
const ISSUE_LIFECYCLES = [
  "PAYMENT_FAILED",
  "REFUND_PENDING",
  "REFUNDED",
  "DISPUTED",
];
const BLOCKED_PAYOUT = ["blocked_issue", "failed"];

export const getFailedPaymentsDesk = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(String(req.query.limit || "25"), 10) || 25)
    );
    const skip = (page - 1) * limit;
    const q = String(req.query.q || "").trim();
    const kind = String(req.query.kind || "all").toLowerCase();

    const orClauses: any[] = [
      { paymentStatus: "failed" },
      { paymentLifecycle: { $in: ISSUE_LIFECYCLES } },
      { "payout.status": { $in: BLOCKED_PAYOUT } },
      { "buyerConfirmation.status": "issue_reported" },
      {
        paymentStatus: "paid",
        "payout.status": { $in: BLOCKED_PAYOUT },
      },
    ];

    const refundAttention = await Refund.find({
      status: { $in: ["failed", "needs_attention", "pending"] },
    })
      .select("order")
      .lean();
    const refundOrderIds = refundAttention
      .map((r: any) => r.order)
      .filter(Boolean);

    if (refundOrderIds.length) {
      orClauses.push({ _id: { $in: refundOrderIds } });
    }

    let match: any = { $or: orClauses };

    if (kind === "failed") {
      match = {
        $or: [
          { paymentStatus: "failed" },
          { paymentLifecycle: "PAYMENT_FAILED" },
        ],
      };
    } else if (kind === "payout_blocked") {
      match = {
        paymentStatus: "paid",
        "payout.status": { $in: BLOCKED_PAYOUT },
      };
    } else if (kind === "dispute") {
      match = {
        $or: [
          { paymentLifecycle: "DISPUTED" },
          { "buyerConfirmation.status": "issue_reported" },
        ],
      };
    } else if (kind === "refund_pending") {
      match = {
        $or: [
          { paymentLifecycle: "REFUND_PENDING" },
          { paymentStatus: "refunded" },
          { _id: { $in: refundOrderIds } },
        ],
      };
    }

    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      match = {
        $and: [
          match,
          {
            $or: [{ orderNumber: rx }, { "feeBreakdown.currency": rx }],
          },
        ],
      };
    }

    const [total, rows] = await Promise.all([
      Order.countDocuments(match),
      Order.find(match)
        .sort({ updatedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("buyer", "name email phone")
        .populate("seller", "name email storeName storeLogo payout marketplaceRegion")
        .select(
          "orderNumber orderStatus paymentStatus paymentMethod paymentLifecycle totalAmount subtotal shippingCost region currency createdAt updatedAt deliveredAt feeBreakdown buyerConfirmation payout buyer seller items paymentRef"
        )
        .lean(),
    ]);

    const orderIds = rows.map((r: any) => r._id);
    const [payments, refunds, payoutDocs] = await Promise.all([
      Payment.find({ order: { $in: orderIds } })
        .select(
          "order status provider providerReference amount currency failureReason lastError lifecycle updatedAt"
        )
        .lean()
        .catch(() => []),
      Refund.find({ order: { $in: orderIds } })
        .select(
          "order status amount currency reason failureReason provider providerRefundId reference createdAt processedAt"
        )
        .lean()
        .catch(() => []),
      Payout.find({ order: { $in: orderIds } })
        .select(
          "order status amount currency provider failureReason reference paidAt createdAt"
        )
        .lean()
        .catch(() => []),
    ]);

    const payByOrder = new Map<string, any>();
    for (const p of payments as any[]) payByOrder.set(String(p.order), p);
    const refundByOrder = new Map<string, any[]>();
    for (const r of refunds as any[]) {
      const k = String(r.order);
      if (!refundByOrder.has(k)) refundByOrder.set(k, []);
      refundByOrder.get(k)!.push(r);
    }
    const payoutByOrder = new Map<string, any>();
    for (const p of payoutDocs as any[]) payoutByOrder.set(String(p.order), p);

    const items = rows.map((o: any) => {
      const id = String(o._id);
      const payment = payByOrder.get(id) || null;
      const refundList = refundByOrder.get(id) || [];
      const payoutDoc = payoutByOrder.get(id) || null;
      const problem = detectProblem(o, payment, refundList, payoutDoc);
      return {
        ...o,
        payment,
        refunds: refundList,
        payoutDoc,
        problem,
        tools: availableTools(problem, o),
      };
    });

    const [failedCount, payoutBlocked, disputed, refundPending] =
      await Promise.all([
        Order.countDocuments({
          $or: [
            { paymentStatus: "failed" },
            { paymentLifecycle: "PAYMENT_FAILED" },
          ],
        }),
        Order.countDocuments({
          paymentStatus: "paid",
          "payout.status": { $in: BLOCKED_PAYOUT },
        }),
        Order.countDocuments({
          $or: [
            { paymentLifecycle: "DISPUTED" },
            { "buyerConfirmation.status": "issue_reported" },
          ],
        }),
        Order.countDocuments({
          $or: [
            { paymentLifecycle: "REFUND_PENDING" },
            { paymentStatus: "refunded", "payout.status": { $ne: "refunded" } },
          ],
        }),
      ]);

    return res.json({
      success: true,
      data: {
        items,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit) || 1,
        },
        summary: {
          failedCount,
          payoutBlocked,
          disputed,
          refundPending,
          openTotal: failedCount + payoutBlocked + disputed + refundPending,
        },
      },
    });
  } catch (error: any) {
    console.error("getFailedPaymentsDesk:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to load payment issues",
    });
  }
};

function detectProblem(
  order: any,
  payment: any,
  refunds: any[],
  payoutDoc: any
): {
  code: string;
  label: string;
  severity: "critical" | "high" | "medium" | "low";
  detail: string;
} {
  if (
    order.paymentStatus === "failed" ||
    order.paymentLifecycle === "PAYMENT_FAILED"
  ) {
    return {
      code: "payment_failed",
      label: "Buyer payment failed",
      severity: "high",
      detail:
        payment?.failureReason ||
        payment?.lastError ||
        "Charge did not complete. Buyer may retry checkout.",
    };
  }

  const badRefund = (refunds || []).find((r) =>
    ["failed", "needs_attention", "pending", "processing"].includes(r.status)
  );
  if (badRefund) {
    return {
      code: "refund_issue",
      label: `Refund ${badRefund.status}`,
      severity: badRefund.status === "failed" ? "critical" : "high",
      detail:
        badRefund.failureReason ||
        badRefund.reason ||
        "Refund requires operator attention",
    };
  }

  if (
    order.paymentLifecycle === "DISPUTED" ||
    order.buyerConfirmation?.status === "issue_reported"
  ) {
    return {
      code: "delivery_dispute",
      label: "Delivery dispute / issue reported",
      severity: "high",
      detail: "Buyer reported a delivery issue. Resolve with refund or seller favour.",
    };
  }

  if (
    order.paymentLifecycle === "REFUND_PENDING" ||
    order.paymentStatus === "refunded"
  ) {
    return {
      code: "refund_pending",
      label: "Refund in progress / completed",
      severity: "medium",
      detail: "Funds path is in refund state — verify gateway confirmation.",
    };
  }

  const ps = order.payout?.status || payoutDoc?.status;
  if (ps && BLOCKED_PAYOUT.includes(ps)) {
    return {
      code: "payout_blocked",
      label: `Seller payout ${ps}`,
      severity: "critical",
      detail:
        order.payout?.blockedReason ||
        payoutDoc?.failureReason ||
        "Seller transfer did not complete. Check bank / Paystack recipient.",
    };
  }

  return {
    code: "needs_review",
    label: "Needs review",
    severity: "low",
    detail: "Flagged for operator review",
  };
}

function availableTools(problem: { code: string }, order: any): string[] {
  const tools = new Set<string>(["add_note", "mark_reviewed"]);
  if (problem.code === "payment_failed") {
    tools.add("notify_buyer_retry");
    tools.add("cancel_order");
    tools.add("mark_paid_manual");
  }
  if (problem.code === "payout_blocked") {
    tools.add("retry_payout");
    tools.add("force_seller_eligible");
    tools.add("refund_buyer");
  }
  if (problem.code === "delivery_dispute") {
    tools.add("refund_buyer");
    tools.add("seller_favour");
    tools.add("authorize_payout");
  }
  if (problem.code === "refund_issue" || problem.code === "refund_pending") {
    tools.add("refund_buyer");
    tools.add("mark_refund_processed");
  }
  if (order.paymentStatus === "paid" && order.payout?.status !== "completed") {
    tools.add("retry_payout");
    tools.add("force_seller_eligible");
  }
  tools.add("refund_buyer");
  return Array.from(tools);
}

export const actOnFailedPayment = async (req: Request, res: Response) => {
  try {
    const orderId = String(req.params.orderId || "").trim();
    if (!mongoose.isValidObjectId(orderId)) {
      throw httpError(400, "Invalid order id");
    }

    const action = String(req.body?.action || "").trim();
    const note = String(req.body?.note || "").trim();
    const admin = (req as any).user;

    const allowed = [
      "refund_buyer",
      "seller_favour",
      "authorize_payout",
      "retry_payout",
      "force_seller_eligible",
      "notify_buyer_retry",
      "cancel_order",
      "mark_paid_manual",
      "mark_refund_processed",
      "mark_reviewed",
      "add_note",
    ];
    if (!allowed.includes(action)) {
      throw httpError(400, `Unknown action. Allowed: ${allowed.join(", ")}`);
    }

    const order = await Order.findById(orderId);
    if (!order) throw httpError(404, "Order not found");

    const now = new Date();
    if (!Array.isArray((order as any).adminPaymentNotes)) {
      (order as any).adminPaymentNotes = [];
    }

    const pushNote = (body: string) => {
      (order as any).adminPaymentNotes.push({
        admin: admin?._id || null,
        action,
        body,
        createdAt: now,
      });
    };

    if (action === "add_note") {
      if (!note) throw httpError(400, "Note is required");
      pushNote(note);
      await order.save();
      return res.json({ success: true, message: "Note saved", data: order });
    }

    if (action === "mark_reviewed") {
      (order as any).adminPaymentReviewedAt = now;
      (order as any).adminPaymentReviewedBy = admin?._id || null;
      pushNote(note || "Marked reviewed");
      await order.save();
      return res.json({ success: true, message: "Marked reviewed", data: order });
    }

    if (action === "notify_buyer_retry") {
      pushNote(note || "Notified buyer to retry payment");
      await order.save();
      await safeNotify({
        user: order.buyer,
        title: "Complete your Plazore payment",
        message: `Payment for order ${order.orderNumber || orderId} did not go through. Open the app and try again, or contact support.`,
        type: "payment",
        order: order._id,
      });
      return res.json({
        success: true,
        message: "Buyer notified to retry",
        data: order,
      });
    }

    if (action === "cancel_order") {
      order.paymentStatus =
        order.paymentStatus === "paid" ? order.paymentStatus : "failed";
      (order as any).paymentLifecycle = "CANCELLED";
      (order as any).orderStatus = "cancelled";
      pushNote(note || "Order cancelled by admin (payment desk)");
      await order.save();
      await safeNotify({
        user: order.buyer,
        title: "Order cancelled",
        message: `Order ${order.orderNumber || orderId} was cancelled. If you were charged, a refund will follow.`,
        type: "order",
        order: order._id,
      });
      return res.json({ success: true, message: "Order cancelled", data: order });
    }

    if (action === "mark_paid_manual") {
      order.paymentStatus = "paid";
      (order as any).paymentLifecycle = "PAYMENT_VERIFIED";
      pushNote(
        note ||
          "Marked paid manually — verify gateway settlement before releasing goods"
      );
      await order.save();
      return res.json({
        success: true,
        message: "Order marked paid (manual)",
        data: order,
      });
    }

    if (action === "force_seller_eligible" || action === "authorize_payout") {
      (order as any).buyerConfirmation = {
        ...(order as any).buyerConfirmation,
        status: "confirmed",
        confirmedAt: now,
      };
      (order as any).payout = {
        ...((order as any).payout || {}),
        status: "eligible",
        eligibleAt: now,
        blockedReason: "",
      };
      (order as any).paymentLifecycle = "SELLER_PAYOUT_PENDING";
      pushNote(note || "Seller payout authorized by admin");
      await order.save();
      await safeNotify({
        user: order.seller,
        title: "Payout authorized",
        message: `Admin authorized payout for order ${order.orderNumber || orderId}.`,
        type: "payout",
        order: order._id,
      });
      return res.json({
        success: true,
        message: "Seller payout authorized",
        data: order,
      });
    }

    if (action === "retry_payout") {
      (order as any).payout = {
        ...((order as any).payout || {}),
        status: "eligible",
        eligibleAt: now,
        blockedReason: "",
        lastRetryAt: now,
      };
      (order as any).paymentLifecycle = "SELLER_PAYOUT_PENDING";
      pushNote(note || "Payout queued for retry");
      await order.save();
      try {
        await Payout.updateMany(
          { order: order._id, status: "failed" },
          { $set: { status: "queued", failureReason: "" } }
        );
      } catch {
        /* optional model */
      }
      await safeNotify({
        user: order.seller,
        title: "Payout retry",
        message: `Payout for order ${order.orderNumber || orderId} is being retried.`,
        type: "payout",
        order: order._id,
      });
      return res.json({
        success: true,
        message: "Payout marked for retry",
        data: order,
      });
    }

    if (action === "seller_favour") {
      (order as any).buyerConfirmation = {
        ...(order as any).buyerConfirmation,
        status: "pending",
      };
      (order as any).paymentLifecycle = "SETTLED_SELLER_FAVOUR";
      pushNote(note || "Resolved in seller favour — awaiting buyer confirm");
      await order.save();
      await safeNotify({
        user: order.seller,
        title: "Dispute update",
        message: `Delivery issue on ${order.orderNumber || orderId} resolved in your favour.`,
        type: "order",
        order: order._id,
      });
      return res.json({
        success: true,
        message: "Resolved in seller favour",
        data: order,
      });
    }

    if (action === "refund_buyer") {
      if (order.paymentStatus === "refunded") {
        throw httpError(400, "Order already refunded");
      }
      const payoutStatus = (order as any).payout?.status;
      if (payoutStatus === "initiated" || payoutStatus === "completed") {
        throw httpError(
          400,
          "Seller payout already in flight or completed — reverse via finance carefully"
        );
      }

      order.paymentStatus = "refunded";
      (order as any).paymentLifecycle = "REFUNDED";
      (order as any).payout = {
        ...((order as any).payout || {}),
        status: "refunded",
        blockedReason: "Admin refund from payment desk",
      };
      pushNote(note || "Buyer refund initiated by admin");
      await order.save();

      try {
        const pay = await Payment.findOne({ order: order._id });
        if (pay) {
          const amount =
            Number((order as any).feeBreakdown?.grossAmount) ||
            Number(order.totalAmount) ||
            0;
          const currency =
            (order as any).feeBreakdown?.currency ||
            (order as any).currency ||
            "NGN";
          const ref = `RF-ADM-${String(order._id).slice(-8)}-${Date.now()}`;
          await Refund.create({
            order: order._id,
            payment: pay._id,
            buyer: order.buyer,
            amount,
            amountMinor: Math.round(amount * 100),
            currency,
            status: "pending",
            reason: note || "Admin refund from failed-payments desk",
            reference: ref,
            provider: (pay as any).provider || "paystack",
            transactionReference:
              (pay as any).providerReference ||
              (pay as any).reference ||
              String(order._id),
            initiatedBy: "admin",
            adminId: admin?._id || null,
          });
        }
      } catch (e) {
        console.warn("refund doc create", e);
      }

      await safeNotify({
        user: order.buyer,
        title: "Refund in progress",
        message: `A refund for order ${order.orderNumber || orderId} has been initiated.`,
        type: "payment",
        order: order._id,
      });
      await safeNotify({
        user: order.seller,
        title: "Order refunded",
        message: `Order ${order.orderNumber || orderId} was refunded by Plazore admin. Payout will not proceed.`,
        type: "order",
        order: order._id,
      });

      return res.json({
        success: true,
        message: "Buyer refund initiated",
        data: order,
      });
    }

    if (action === "mark_refund_processed") {
      order.paymentStatus = "refunded";
      (order as any).paymentLifecycle = "REFUNDED";
      pushNote(note || "Refund marked processed (gateway confirmed)");
      await order.save();
      try {
        await Refund.updateMany(
          {
            order: order._id,
            status: { $in: ["pending", "processing", "needs_attention"] },
          },
          { $set: { status: "processed", processedAt: now } }
        );
      } catch {
        /* */
      }
      return res.json({
        success: true,
        message: "Refund marked processed",
        data: order,
      });
    }

    throw httpError(400, "Action not handled");
  } catch (error: any) {
    console.error("actOnFailedPayment:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Action failed",
    });
  }
};

export const getRevenueBoard = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(String(req.query.limit || "30"), 10) || 30)
    );
    const skip = (page - 1) * limit;
    const q = String(req.query.q || "").trim();
    const sortKey = String(req.query.sort || "gmv").toLowerCase();
    const sortDir =
      String(req.query.order || "desc").toLowerCase() === "asc" ? 1 : -1;
    const regionFilter = String(req.query.region || "").trim().toUpperCase();

    const paidMatch: any = {
      paymentStatus: { $in: PAID_STATUSES },
    };
    if (regionFilter) paidMatch.region = regionFilter;

    const [gmvBuckets, feeBuckets, pendingPayoutBuckets, refundedBuckets] =
      await Promise.all([
        Order.aggregate([
          { $match: paidMatch },
          {
            $group: {
              _id: {
                $toUpper: {
                  $ifNull: [
                    "$feeBreakdown.currency",
                    { $ifNull: ["$currency", "NGN"] },
                  ],
                },
              },
              amount: {
                $sum: {
                  $ifNull: [
                    "$feeBreakdown.grossAmount",
                    { $ifNull: ["$totalAmount", 0] },
                  ],
                },
              },
              orders: { $sum: 1 },
            },
          },
        ]),
        Order.aggregate([
          { $match: paidMatch },
          {
            $group: {
              _id: {
                $toUpper: {
                  $ifNull: [
                    "$feeBreakdown.currency",
                    { $ifNull: ["$currency", "NGN"] },
                  ],
                },
              },
              amount: { $sum: { $ifNull: ["$feeBreakdown.platformFee", 0] } },
              orders: { $sum: 1 },
            },
          },
        ]),
        Order.aggregate([
          {
            $match: {
              paymentStatus: "paid",
              "payout.status": {
                $in: ["eligible", "queued", "initiated"],
              },
            },
          },
          {
            $group: {
              _id: {
                $toUpper: {
                  $ifNull: [
                    "$feeBreakdown.currency",
                    { $ifNull: ["$currency", "NGN"] },
                  ],
                },
              },
              amount: {
                $sum: {
                  $ifNull: [
                    "$feeBreakdown.sellerPayoutAmount",
                    { $ifNull: ["$payout.amount", 0] },
                  ],
                },
              },
              orders: { $sum: 1 },
            },
          },
        ]),
        Order.aggregate([
          { $match: { paymentStatus: "refunded" } },
          {
            $group: {
              _id: {
                $toUpper: {
                  $ifNull: [
                    "$feeBreakdown.currency",
                    { $ifNull: ["$currency", "NGN"] },
                  ],
                },
              },
              amount: {
                $sum: {
                  $ifNull: [
                    "$feeBreakdown.grossAmount",
                    { $ifNull: ["$totalAmount", 0] },
                  ],
                },
              },
              orders: { $sum: 1 },
            },
          },
        ]),
      ]);

    let subBuckets: { _id: string; amount: number; count: number }[] = [];
    try {
      subBuckets = await SellerSubscription.aggregate([
        {
          $match: {
            $or: [{ status: "active" }, { amountPaid: { $gt: 0 } }],
          },
        },
        {
          $group: {
            _id: { $toUpper: { $ifNull: ["$currency", "NGN"] } },
            amount: { $sum: { $ifNull: ["$amountPaid", 0] } },
            count: { $sum: 1 },
          },
        },
      ]);
    } catch {
      subBuckets = [];
    }

    let paidOutBuckets: { _id: string; amount: number; count: number }[] = [];
    try {
      paidOutBuckets = await Payout.aggregate([
        { $match: { status: "success" } },
        {
          $group: {
            _id: { $toUpper: { $ifNull: ["$currency", "NGN"] } },
            amount: { $sum: { $ifNull: ["$amount", 0] } },
            count: { $sum: 1 },
          },
        },
      ]);
    } catch {
      paidOutBuckets = [];
    }

    const toList = (rows: any[]) =>
      (rows || []).map((r) => ({
        currency: String(r._id || "NGN"),
        amount: Number(r.amount) || 0,
        count: Number(r.orders ?? r.count) || 0,
      }));

    const totals = {
      gmv: toList(gmvBuckets),
      transactionFeeRevenue: toList(feeBuckets),
      subscriptionRevenue: toList(subBuckets),
      pendingSellerPayouts: toList(pendingPayoutBuckets),
      refunded: toList(refundedBuckets),
      sellerPaidOut: toList(paidOutBuckets),
      paidOrderCount: gmvBuckets.reduce(
        (s: number, r: any) => s + (Number(r.orders) || 0),
        0
      ),
    };

    const sellerMatch: any = { role: "seller" };
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      sellerMatch.$and = [
        { $or: [{ storeName: rx }, { name: rx }, { email: rx }] },
      ];
    }
    if (regionFilter) sellerMatch.marketplaceRegion = regionFilter;

    const sellers = await User.find(sellerMatch)
      .select(
        "name email storeName storeLogo marketplaceRegion createdAt sellerAppliedAt isSellerVerified isSellerSuspended payout"
      )
      .lean();

    const sellerIds = sellers.map((s: any) => s._id);

    const [sellerGmv, sellerFees, sellerPending, sellerPaidOut, sellerSubs] =
      await Promise.all([
        Order.aggregate([
          { $match: { seller: { $in: sellerIds }, paymentStatus: "paid" } },
          {
            $group: {
              _id: "$seller",
              gmv: {
                $sum: {
                  $ifNull: [
                    "$feeBreakdown.grossAmount",
                    { $ifNull: ["$totalAmount", 0] },
                  ],
                },
              },
              fees: { $sum: { $ifNull: ["$feeBreakdown.platformFee", 0] } },
              orders: { $sum: 1 },
              currency: {
                $first: {
                  $ifNull: [
                    "$feeBreakdown.currency",
                    { $ifNull: ["$currency", "NGN"] },
                  ],
                },
              },
            },
          },
        ]),
        Order.aggregate([
          { $match: { seller: { $in: sellerIds }, paymentStatus: "paid" } },
          {
            $group: {
              _id: {
                seller: "$seller",
                currency: {
                  $toUpper: {
                    $ifNull: [
                      "$feeBreakdown.currency",
                      { $ifNull: ["$currency", "NGN"] },
                    ],
                  },
                },
              },
              fees: { $sum: { $ifNull: ["$feeBreakdown.platformFee", 0] } },
              gmv: {
                $sum: {
                  $ifNull: [
                    "$feeBreakdown.grossAmount",
                    { $ifNull: ["$totalAmount", 0] },
                  ],
                },
              },
              sellerNet: {
                $sum: { $ifNull: ["$feeBreakdown.sellerPayoutAmount", 0] },
              },
              orders: { $sum: 1 },
            },
          },
        ]),
        Order.aggregate([
          {
            $match: {
              seller: { $in: sellerIds },
              paymentStatus: "paid",
              "payout.status": { $in: ["eligible", "queued", "initiated"] },
            },
          },
          {
            $group: {
              _id: "$seller",
              pending: {
                $sum: {
                  $ifNull: [
                    "$feeBreakdown.sellerPayoutAmount",
                    { $ifNull: ["$payout.amount", 0] },
                  ],
                },
              },
              orders: { $sum: 1 },
            },
          },
        ]),
        Order.aggregate([
          {
            $match: {
              seller: { $in: sellerIds },
              "payout.status": "completed",
            },
          },
          {
            $group: {
              _id: "$seller",
              paidOut: {
                $sum: {
                  $ifNull: [
                    "$payout.amount",
                    { $ifNull: ["$feeBreakdown.sellerPayoutAmount", 0] },
                  ],
                },
              },
              orders: { $sum: 1 },
            },
          },
        ]),
        (async () => {
          try {
            return await SellerSubscription.aggregate([
              { $match: { seller: { $in: sellerIds } } },
              {
                $group: {
                  _id: "$seller",
                  subRevenue: { $sum: { $ifNull: ["$amountPaid", 0] } },
                  planId: { $first: "$planId" },
                  status: { $first: "$status" },
                },
              },
            ]);
          } catch {
            return [];
          }
        })(),
      ]);

    const gmvMap = new Map(sellerGmv.map((r: any) => [String(r._id), r]));
    const pendingMap = new Map(sellerPending.map((r: any) => [String(r._id), r]));
    const paidMap = new Map(sellerPaidOut.map((r: any) => [String(r._id), r]));
    const subMap = new Map(sellerSubs.map((r: any) => [String(r._id), r]));

    const bySellerCurrency = new Map<string, any[]>();
    for (const r of sellerFees as any[]) {
      const sid = String(r._id.seller);
      if (!bySellerCurrency.has(sid)) bySellerCurrency.set(sid, []);
      bySellerCurrency.get(sid)!.push({
        currency: r._id.currency,
        gmv: r.gmv,
        fees: r.fees,
        sellerNet: r.sellerNet,
        orders: r.orders,
      });
    }

    let ledger = sellers.map((s: any) => {
      const id = String(s._id);
      const g = gmvMap.get(id) as any;
      const p = pendingMap.get(id) as any;
      const po = paidMap.get(id) as any;
      const sub = subMap.get(id) as any;
      const buckets = bySellerCurrency.get(id) || [];
      const primaryCurrency = buckets[0]?.currency || g?.currency || "NGN";
      return {
        _id: s._id,
        name: s.name,
        email: s.email,
        storeName: s.storeName,
        storeLogo: s.storeLogo,
        region: s.marketplaceRegion || "",
        joinedAt: s.sellerAppliedAt || s.createdAt,
        createdAt: s.createdAt,
        verified: !!s.isSellerVerified,
        suspended: !!s.isSellerSuspended,
        bankReady: !!(s.payout?.accountNumber || s.paystackRecipientCode),
        currency: primaryCurrency,
        gmv: Number(g?.gmv) || 0,
        platformFees: Number(g?.fees) || 0,
        orders: Number(g?.orders) || 0,
        pendingPayout: Number(p?.pending) || 0,
        pendingOrders: Number(p?.orders) || 0,
        paidOut: Number(po?.paidOut) || 0,
        paidOutOrders: Number(po?.orders) || 0,
        subscriptionRevenue: Number(sub?.subRevenue) || 0,
        planId: sub?.planId || null,
        planStatus: sub?.status || null,
        byCurrency: buckets,
        sellerRevenue: Math.max(0, (Number(g?.gmv) || 0) - (Number(g?.fees) || 0)),
      };
    });

    const sortFn = (a: any, b: any) => {
      let av = 0;
      let bv = 0;
      switch (sortKey) {
        case "revenue":
        case "seller_revenue":
          av = a.sellerRevenue;
          bv = b.sellerRevenue;
          break;
        case "pending":
          av = a.pendingPayout;
          bv = b.pendingPayout;
          break;
        case "fees":
          av = a.platformFees;
          bv = b.platformFees;
          break;
        case "subs":
        case "subscription":
          av = a.subscriptionRevenue;
          bv = b.subscriptionRevenue;
          break;
        case "orders":
          av = a.orders;
          bv = b.orders;
          break;
        case "joined":
          av = new Date(a.joinedAt || 0).getTime();
          bv = new Date(b.joinedAt || 0).getTime();
          break;
        case "name":
          return (
            sortDir *
            String(a.storeName || a.name || "").localeCompare(
              String(b.storeName || b.name || "")
            )
          );
        case "gmv":
        default:
          av = a.gmv;
          bv = b.gmv;
      }
      return sortDir * (av - bv);
    };
    ledger.sort(sortFn);

    if (String(req.query.filter || "") === "active") {
      ledger = ledger.filter(
        (s) => s.orders > 0 || s.pendingPayout > 0 || s.subscriptionRevenue > 0
      );
    }

    const totalSellers = ledger.length;
    const pageItems = ledger.slice(skip, skip + limit);

    return res.json({
      success: true,
      data: {
        totals,
        sellers: pageItems,
        pagination: {
          page,
          limit,
          total: totalSellers,
          pages: Math.ceil(totalSellers / limit) || 1,
        },
        sort: { key: sortKey, order: sortDir === 1 ? "asc" : "desc" },
      },
    });
  } catch (error: any) {
    console.error("getRevenueBoard:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to load revenue board",
    });
  }
};