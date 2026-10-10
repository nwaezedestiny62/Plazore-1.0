/**
 * Stripe webhook handler.
 * Mount with express.raw({ type: "application/json" }) BEFORE express.json().
 *
 * Route: POST /api/payments/stripe/webhook
 *
 * Handles:
 * - payment_intent.succeeded / failed / canceled  (orders + seller subscriptions)
 * - charge.refunded / refund.updated               (refund status sync)
 * - transfer.created / transfer.paid               (seller payouts)
 */

import { Request, Response } from "express";
import Payment from "../models/Payment.js";
import PaymentEvent from "../models/PaymentEvent.js";
import Refund from "../models/Refund.js";
import {
  constructStripeEvent,
  buildStripeEventId,
} from "../services/stripe/webhook.js";
import { verifyPaymentByReference } from "../services/paymentService.js";
import { markPayoutSuccess } from "../services/payoutService.js";
import { activatePlanFromWebhook } from "../services/subscriptionService.js";
import { mapStripeRefundStatus } from "../services/stripe/refunds.js";

export const stripeWebhook = async (req: Request, res: Response) => {
  const signature = req.headers["stripe-signature"] as string;
  if (!signature) {
    return res.status(400).json({ error: "Missing stripe-signature header" });
  }

  let event: any;
  try {
    const rawBody = (req as any).rawBody || req.body;
    event = constructStripeEvent(rawBody, signature);
  } catch (err: any) {
    console.error("[stripeWebhook] signature verification failed:", err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  const eventId = buildStripeEventId(event);

  // Idempotency
  const existing = await PaymentEvent.findOne({ eventId });
  if (existing?.processed) {
    return res.json({ received: true, duplicate: true });
  }

  await PaymentEvent.findOneAndUpdate(
    { eventId },
    {
      eventId,
      event: event.type,
      reference:
        event.data?.object?.metadata?.plazore_reference ||
        event.data?.object?.metadata?.plazore_refund_reference ||
        null,
      payload: event,
      signatureValid: true,
      processed: false,
      provider: "stripe",
    },
    { upsert: true, new: true }
  );

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const intent = event.data.object;
        const meta = intent.metadata || {};

        // Seller subscription path
        if (String(meta.type || "") === "seller_subscription") {
          const reference =
            meta.plazore_reference ||
            (await findSubReferenceByPaymentIntent(intent.id));
          if (reference) {
            let chargeId: string | null = null;
            const charge = intent.latest_charge;
            if (typeof charge === "string") chargeId = charge;
            else if (charge?.id) chargeId = charge.id;

            await activatePlanFromWebhook({
              provider: "stripe",
              reference,
              metadata: meta,
              amountMinor: intent.amount,
              currency: intent.currency,
              stripePaymentIntentId: intent.id,
              stripeChargeId: chargeId,
            });
          }
          await PaymentEvent.updateOne(
            { eventId },
            {
              processed: true,
              processedAt: new Date(),
              reference: meta.plazore_reference || null,
            }
          );
          break;
        }

        // Order payment path
        const reference =
          meta.plazore_reference ||
          (await findReferenceByPaymentIntent(intent.id));

        if (!reference) {
          console.warn("[stripeWebhook] no reference for PI", intent.id);
          break;
        }

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
        break;
      }

      case "payment_intent.payment_failed":
      case "payment_intent.canceled": {
        const intent = event.data.object;
        const meta = intent.metadata || {};

        if (String(meta.type || "") === "seller_subscription") {
          // Leave subscription in pending_payment; seller can retry
          await PaymentEvent.updateOne(
            { eventId },
            { processed: true, processedAt: new Date() }
          );
          break;
        }

        const reference =
          meta.plazore_reference ||
          (await findReferenceByPaymentIntent(intent.id));

        if (reference) {
          await verifyPaymentByReference(reference, "webhook");
        }
        await PaymentEvent.updateOne(
          { eventId },
          { processed: true, processedAt: new Date() }
        );
        break;
      }

      case "charge.refunded":
      case "refund.updated":
      case "refund.created": {
        await handleStripeRefundEvent(event);
        await PaymentEvent.updateOne(
          { eventId },
          { processed: true, processedAt: new Date() }
        );
        break;
      }

      case "transfer.created":
      case "transfer.paid": {
        const transfer = event.data.object;
        const payoutRef = transfer.metadata?.plazore_payout_reference;
        if (payoutRef) {
          await markPayoutSuccess(payoutRef, transfer).catch(() => {});
        }
        await PaymentEvent.updateOne(
          { eventId },
          { processed: true, processedAt: new Date() }
        );
        break;
      }

      default:
        await PaymentEvent.updateOne(
          { eventId },
          { processed: true, processedAt: new Date() }
        );
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error("[stripeWebhook] processing error:", err);
    await PaymentEvent.updateOne(
      { eventId },
      { processingError: err.message || "processing failed" }
    );
    // 200 so Stripe does not retry aggressively while we investigate
    res.status(200).json({ received: true, error: err.message });
  }
};

async function findReferenceByPaymentIntent(
  paymentIntentId: string
): Promise<string | null> {
  const payment = await Payment.findOne({
    stripePaymentIntentId: paymentIntentId,
  });
  return payment?.reference || null;
}

async function findSubReferenceByPaymentIntent(
  paymentIntentId: string
): Promise<string | null> {
  try {
    const SellerSubscription = (await import("../models/SellerSubscription.js"))
      .default;
    const sub: any = await (SellerSubscription as any).findOne({
      stripePaymentIntentId: paymentIntentId,
    });
    return sub?.paymentReference || null;
  } catch {
    return null;
  }
}

/**
 * Sync Refund document status from Stripe charge.refunded / refund.* events.
 */
async function handleStripeRefundEvent(event: any) {
  const obj = event.data?.object;
  if (!obj) return;

  // charge.refunded → object is Charge with refunds list
  // refund.updated / refund.created → object is Refund
  let refundId: string | null = null;
  let status: string | null = null;
  let plazoreRef: string | null = null;

  if (event.type === "charge.refunded") {
    const refunds = obj.refunds?.data || [];
    const latest = refunds[0];
    if (latest) {
      refundId = latest.id;
      status = latest.status;
      plazoreRef = latest.metadata?.plazore_refund_reference || null;
    }
  } else {
    refundId = obj.id;
    status = obj.status;
    plazoreRef = obj.metadata?.plazore_refund_reference || null;
  }

  if (!refundId && !plazoreRef) return;

  const mapped = mapStripeRefundStatus(status);

  const query: any = { provider: "stripe" };
  if (plazoreRef) query.reference = plazoreRef;
  else if (refundId) query.providerRefundId = refundId;

  const refundDoc: any = await Refund.findOne(query);
  if (!refundDoc) return;

  refundDoc.status = mapped;
  if (refundId) refundDoc.providerRefundId = refundId;
  if (mapped === "processed") {
    refundDoc.processedAt = new Date();
  }
  if (mapped === "failed") {
    refundDoc.failureReason =
      obj.failure_reason || obj.reason || "Stripe refund failed";
  }
  refundDoc.gatewayPayload = {
    eventType: event.type,
    status,
    refundId,
  };
  await refundDoc.save();
}
