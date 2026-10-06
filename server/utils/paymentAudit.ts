import PaymentAuditLog from "../models/PaymentAuditLog.js";

export async function writePaymentAudit(params: {
  order?: string | null;
  payment?: string | null;
  payout?: string | null;
  refund?: string | null;
  dispute?: string | null;
  action: string;
  actorType: "buyer" | "seller" | "admin" | "system" | "webhook";
  actorId?: string | null;
  fromLifecycle?: string | null;
  toLifecycle?: string | null;
  amount?: number | null;
  currency?: string | null;
  reference?: string | null;
  note?: string;
  meta?: Record<string, unknown>;
}) {
  try {
    await PaymentAuditLog.create({
      order: params.order || null,
      payment: params.payment || null,
      payout: params.payout || null,
      refund: params.refund || null,
      dispute: params.dispute || null,
      action: params.action,
      actorType: params.actorType,
      actorId: params.actorId || null,
      fromLifecycle: params.fromLifecycle || null,
      toLifecycle: params.toLifecycle || null,
      amount: params.amount ?? null,
      currency: params.currency || null,
      reference: params.reference || null,
      note: params.note || "",
      meta: params.meta || {},
    });
  } catch (err) {
    console.error("[PaymentAudit] write failed:", err);
  }
}
