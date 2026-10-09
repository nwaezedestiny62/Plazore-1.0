/**
 * Stripe Transfers — release seller payout when order becomes eligible.
 * Uses the platform balance (money already collected via PaymentIntent).
 */

import { getStripe } from "./client.js";
import { toMinorUnits } from "../../config/payment.js";

export interface CreateTransferParams {
  amountMajor: number;
  currency: string;
  destination: string;        // Stripe Connect account ID (acct_...)
  reference: string;          // our payout reference
  orderId: string;
  orderNumber: string;
  sourceTransaction?: string; // charge ID to link the transfer (optional but recommended)
  description?: string;
}

export async function createTransfer(params: CreateTransferParams) {
  const stripe = getStripe();
  const amountMinor = toMinorUnits(params.amountMajor, params.currency);

  const transfer = await stripe.transfers.create(
    {
      amount: amountMinor,
      currency: params.currency.toLowerCase(),
      destination: params.destination,
      transfer_group: params.orderId,
      source_transaction: params.sourceTransaction || undefined,
      metadata: {
        plazore_payout_reference: params.reference,
        orderId: params.orderId,
        orderNumber: params.orderNumber,
      },
      description:
        params.description || `Plazore payout for ${params.orderNumber}`,
    },
    {
      idempotencyKey: `tr_${params.reference}`,
    }
  );

  return {
    transferId: transfer.id,
    amount: params.amountMajor,
    amountMinor,
    currency: params.currency.toUpperCase(),
    destination: transfer.destination,
    status: "pending", // Stripe transfers are usually immediate; status tracked by us
  };
}

export async function retrieveTransfer(transferId: string) {
  const stripe = getStripe();
  return stripe.transfers.retrieve(transferId);
}