/**
 * Stripe webhook handler.
 * Mount with express.raw({ type: "application/json" }) BEFORE express.json().
 *
 * Route: POST /api/payments/stripe/webhook
 */

import { Request, Response } from "express";
import Payment from "../models/Payment.js";
import PaymentEvent from "../models/PaymentEvent.js";
import {
  constructStripeEvent,
  buildStripeEventId,
} from "../services/stripe/webhook.js";
import { verifyPaymentByReference } from "../services/paymentService.js";
import { markPayoutSuccess } from "../services/payoutService.js";
import { writePaymentAudit } from "../utils/paymentAudit.js";

export const stripeWebhook = async (req: Request, res: Response) => {
  const signature = req.headers["stripe-signature"] as string;
  if (!signature) {
    return res.status(400).json({ error: "Missing stripe-signature header" });
  }

  let event: any;
  try {
    // req.body must be the raw Buffer (set up in server.ts)
    const rawBody = (req as any).rawBody || req.body;
    event = constructStripeEvent(rawBody, signature);
  } catch (err: any) {
    console.error("[stripeWebhook] signature verification failed:", err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  const eventId = buildStripeEventId(event);

  // Idempotency — never process the same event twice
  const existing = await PaymentEvent.findOne({ eventId });
  if (existing?.processed) {
    return res.json({ received: true, duplicate: true });
  }

  await PaymentEvent.findOneAndUpdate(
    { eventId },
    {
      eventId,
      event: event.type,
      reference: event.data?.object?.metadata?.plazore_reference || null,
      payload: event,
      signatureValid: true,
      processed: false,
    },
    { upsert: true, new: true }
  );

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const intent = event.data.object;
        const reference =
          intent.metadata?.plazore_reference ||
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
        const reference =
          intent.metadata?.plazore_reference ||
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

      case "charge.refunded": {
        // Optional: mark refund status on our side if you want deeper tracking
        await PaymentEvent.updateOne(
          { eventId },
          { processed: true, processedAt: new Date() }
        );
        break;
      }

      case "transfer.created":
      case "transfer.paid": {
        // Optional: if you link transfer metadata to our payout reference
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
        // Unhandled event type — still mark processed so we don't retry forever
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
    // Return 200 so Stripe does not retry aggressively while we investigate
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