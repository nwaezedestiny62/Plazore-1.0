/**
 * Plazore — dual delivery:
 *  1) Indoor Notification document
 *  2) Native Expo push when user has expoPushToken
 */

import Notification, {
  NOTIFICATION_TYPES,
  type NotificationType,
} from "../models/Notification.js";
import User from "../models/User.js";
import { sendPushToToken } from "./sendExpoPush.js";

export type { NotificationType };
export { NOTIFICATION_TYPES };

const CRITICAL_TYPES = new Set<string>([
  "new_order",
  "ship_required",
  "confirm_delivery",
  "payment_released",
  "payment_pending_release",
  "order_shipped",
  "order_delivered",
]);

/** Map any unknown type → schema-safe enum value */
function normalizeType(raw: string | undefined): NotificationType {
  const t = String(raw || "general").trim();
  if ((NOTIFICATION_TYPES as readonly string[]).includes(t)) {
    return t as NotificationType;
  }
  return "general";
}

export interface SendNotificationOptions {
  userId: string;
  type?: NotificationType | string;
  title: string;
  message: string;
  orderId?: string;
  orderNumber?: string;
  conversationId?: string;
  productId?: string;
  productName?: string;
  link?: string;
  contactId?: string;
  reportId?: string;
  announcementId?: string;
  releaseAt?: string | Date | null;
  skipPush?: boolean;
}

function formatReleaseTiming(releaseAt?: string | Date | null): string {
  if (!releaseAt) return "";
  const d = new Date(releaseAt);
  if (Number.isNaN(d.getTime())) return "";
  const ms = d.getTime() - Date.now();
  if (ms <= 0) return "Payment can release now";
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `~${days}d ${hours % 24}h until payment release`;
  }
  if (hours > 0) return `~${hours}h ${mins}m until payment release`;
  return `~${mins}m until payment release`;
}

export async function sendNotification(opts: SendNotificationOptions) {
  try {
    const {
      userId,
      title,
      message,
      orderId,
      orderNumber,
      conversationId,
      productId,
      productName,
      link,
      contactId,
      reportId,
      announcementId,
      releaseAt,
      skipPush,
    } = opts;

    if (!userId) return null;

    const type = normalizeType(opts.type);

    let fullMessage = message;
    const timing = formatReleaseTiming(releaseAt);
    if (timing && !message.includes("payment release") && !message.includes("until")) {
      fullMessage = `${message} ${timing}`.trim();
    }

    const base: Record<string, unknown> = {
      user: userId,
      type,
      title,
      message: fullMessage,
      isRead: false,
      link: link || "",
    };

    if (orderId) base.order = orderId;
    if (orderNumber) base.orderNumber = orderNumber;
    if (conversationId) base.conversation = conversationId;
    if (productId) base.product = productId;
    if (productName) base.productName = productName;
    if (contactId) base.contact = contactId;
    if (reportId) base.report = reportId;
    if (announcementId) base.announcement = announcementId;

    let doc: unknown = null;
    try {
      doc = await Notification.create(base);
    } catch (firstErr: unknown) {
      // Last-resort: force type general if enum still lagging in DB
      try {
        doc = await Notification.create({
          ...base,
          type: "general" as NotificationType,
        });
      } catch (e) {
        console.error("Failed to send notification:", firstErr);
        return null;
      }
    }

    if (!skipPush) {
      pushNative({
        userId,
        type,
        title,
        body: fullMessage,
        orderId,
        orderNumber,
        conversationId,
        productId,
        link,
        releaseAt: releaseAt ? new Date(releaseAt).toISOString() : undefined,
      }).catch((err) => console.error("native push failed:", err));
    }

    return doc;
  } catch (error) {
    console.error("Failed to send notification:", error);
    return null;
  }
}

async function pushNative(opts: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  orderId?: string;
  orderNumber?: string;
  conversationId?: string;
  productId?: string;
  link?: string;
  releaseAt?: string;
}) {
  try {
    const user = await User.findById(opts.userId)
      .select("expoPushToken pushEnabled")
      .lean();

    const token = (user as any)?.expoPushToken;
    if (!token || (user as any)?.pushEnabled === false) return;

    const isCritical = CRITICAL_TYPES.has(opts.type);

    await sendPushToToken({
      token: String(token),
      title: opts.title,
      body: opts.body,
      data: {
        type: opts.type,
        orderId: opts.orderId || "",
        orderNumber: opts.orderNumber || "",
        conversationId: opts.conversationId || "",
        productId: opts.productId || "",
        link: opts.link || "",
        releaseAt: opts.releaseAt || "",
      },
      channelId: isCritical ? "plazore_critical" : "plazore_default",
      priority: isCritical ? "high" : "default",
    });
  } catch (e) {
    console.error("pushNative error:", e);
  }
}

// ─── Critical helpers ───────────────────────────────────────────

export async function notifySellerShipRequired(opts: {
  sellerId: string;
  orderId: string;
  orderNumber: string;
  productName?: string;
}) {
  const name = opts.productName ? ` · ${opts.productName}` : "";
  return sendNotification({
    userId: opts.sellerId,
    type: "ship_required",
    title: "Ship this order now",
    message: `Payment confirmed for ${opts.orderNumber}${name}. Pack and ship as soon as you can.`,
    orderId: opts.orderId,
    orderNumber: opts.orderNumber,
    productName: opts.productName,
    link: `/seller/orders/${opts.orderId}`,
  });
}

export async function notifySellerPaymentReleased(opts: {
  sellerId: string;
  orderId: string;
  orderNumber: string;
  amountLabel?: string;
}) {
  const amt = opts.amountLabel ? ` (${opts.amountLabel})` : "";
  return sendNotification({
    userId: opts.sellerId,
    type: "payment_released",
    title: "Payout released",
    message: `Your payout for ${opts.orderNumber}${amt} has been released.`,
    orderId: opts.orderId,
    orderNumber: opts.orderNumber,
    link: `/seller/orders/${opts.orderId}`,
  });
}

export async function notifyBuyerConfirmDelivery(opts: {
  buyerId: string;
  orderId: string;
  orderNumber: string;
  productName?: string;
  releaseAt?: Date | string | null;
}) {
  const name = opts.productName ? ` (${opts.productName})` : "";
  return sendNotification({
    userId: opts.buyerId,
    type: "confirm_delivery",
    title: "Confirm you received your order",
    message: `Order ${opts.orderNumber}${name} was delivered. Confirm receipt so the seller can get paid.`,
    orderId: opts.orderId,
    orderNumber: opts.orderNumber,
    productName: opts.productName,
    releaseAt: opts.releaseAt,
    link: `/orders/${opts.orderId}`,
  });
}

export async function notifyBuyerPaymentTiming(opts: {
  buyerId: string;
  orderId: string;
  orderNumber: string;
  releaseAt?: Date | string | null;
}) {
  return sendNotification({
    userId: opts.buyerId,
    type: "payment_pending_release",
    title: "Thanks — delivery confirmed",
    message: `You confirmed ${opts.orderNumber}. Seller payout is on the way.`,
    orderId: opts.orderId,
    orderNumber: opts.orderNumber,
    releaseAt: opts.releaseAt,
    link: `/orders/${opts.orderId}`,
  });
}

export async function notifyShowroomRefresh(opts: {
  userId: string;
  rooms: number[];
}) {
  const labels: string[] = [];
  if (opts.rooms.includes(1)) labels.push("Expanded View");
  if (opts.rooms.includes(2)) labels.push("Private Selection");
  const roomText = labels.length ? labels.join(" & ") : "Showroom";

  return sendNotification({
    userId: opts.userId,
    type: "showroom_refresh",
    title: "Showroom updated",
    message: `${roomText} has new picks for you. Take a look.`,
    link: "/showroom",
  });
}

export default sendNotification;
