/**
 * Plazore — dual delivery.
 * Native push ALWAYS runs when the user has a token.
 * Indoor Notification.create failure must NOT cancel the popup.
 */

import Notification, {
  NOTIFICATION_TYPES,
  type NotificationType,
} from "../models/Notification.js";
import User from "../models/User.js";
import { sendPushToToken } from "./sendExpoPush.js";

export type { NotificationType };
export { NOTIFICATION_TYPES };

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

function normalizeType(raw: string | undefined): NotificationType {
  const t = String(raw || "general").trim();
  if ((NOTIFICATION_TYPES as readonly string[]).includes(t)) {
    return t as NotificationType;
  }
  return "general";
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

function isObjectIdLike(value?: string): boolean {
  return !!value && /^[a-fA-F0-9]{24}$/.test(value);
}

export async function sendNotification(opts: SendNotificationOptions) {
  const userId = String(opts.userId || "").trim();
  if (!userId) return null;

  const type = normalizeType(opts.type);
  let fullMessage = opts.message || "";
  const timing = formatReleaseTiming(opts.releaseAt);
  if (
    timing &&
    !fullMessage.includes("payment release") &&
    !fullMessage.includes("until")
  ) {
    fullMessage = `${fullMessage} ${timing}`.trim();
  }

  // Indoor record — never block the push
  let doc: unknown = null;
  try {
    const base: Record<string, unknown> = {
      user: userId,
      type,
      title: opts.title,
      message: fullMessage,
      isRead: false,
      link: opts.link || "",
    };
    if (isObjectIdLike(opts.orderId)) base.order = opts.orderId;
    if (opts.orderNumber) base.orderNumber = opts.orderNumber;
    if (isObjectIdLike(opts.conversationId)) base.conversation = opts.conversationId;
    if (isObjectIdLike(opts.productId)) base.product = opts.productId;
    if (opts.productName) base.productName = opts.productName;
    if (isObjectIdLike(opts.contactId)) base.contact = opts.contactId;
    if (isObjectIdLike(opts.reportId)) base.report = opts.reportId;
    if (isObjectIdLike(opts.announcementId)) base.announcement = opts.announcementId;

    try {
      doc = await Notification.create(base);
    } catch (firstErr) {
      console.error("[notify] indoor create failed, retry general:", firstErr);
      doc = await Notification.create({
        user: userId,
        type: "general",
        title: opts.title,
        message: fullMessage,
        isRead: false,
        link: opts.link || "",
        orderNumber: opts.orderNumber || undefined,
        productName: opts.productName || undefined,
      });
    }
  } catch (indoorErr) {
    console.error("[notify] indoor notification skipped:", indoorErr);
  }

  if (!opts.skipPush) {
    try {
      await pushNative({
        userId,
        type,
        title: opts.title,
        body: fullMessage,
        orderId: opts.orderId,
        orderNumber: opts.orderNumber,
        conversationId: opts.conversationId,
        productId: opts.productId,
        link: opts.link,
        releaseAt: opts.releaseAt
          ? new Date(opts.releaseAt).toISOString()
          : undefined,
      });
    } catch (err) {
      console.error("[notify] native push failed:", err);
    }
  }

  return doc;
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
  if (!isObjectIdLike(opts.userId)) {
    console.warn("[pushNative] userId is not an ObjectId", opts.userId);
    return;
  }

  const user = await User.findById(opts.userId)
    .select("expoPushToken pushEnabled")
    .lean();

  const token = String((user as any)?.expoPushToken || "").trim();
  if (!user) {
    console.warn("[pushNative] user not found", opts.userId);
    return;
  }
  if ((user as any)?.pushEnabled === false) {
    console.warn("[pushNative] push disabled", opts.userId);
    return;
  }
  if (!token) {
    console.warn("[pushNative] no expoPushToken on user", opts.userId);
    return;
  }

  console.log(
    "[pushNative] sending",
    opts.type,
    "to",
    opts.userId,
    token.slice(0, 28)
  );

  await sendPushToToken({
    token,
    title: opts.title,
    body: opts.body,
    priority: "high",
    data: {
      type: opts.type,
      orderId: opts.orderId || "",
      orderNumber: opts.orderNumber || "",
      conversationId: opts.conversationId || "",
      productId: opts.productId || "",
      link: opts.link || "",
      releaseAt: opts.releaseAt || "",
    },
  });
}

export async function notifySellerShipRequired(opts: {
  sellerId: string;
  orderId: string;
  orderNumber: string;
  productName?: string;
}) {
  const name = opts.productName ? ` | ${opts.productName}` : "";
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