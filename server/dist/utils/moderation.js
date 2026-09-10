import ModerationEvent from "../models/ModerationEvent.js";
import ModerationCase from "../models/ModerationCase.js";
export function getCtx(user, context) {
    const m = user?.moderation?.[context];
    return {
        status: m?.status || "NORMAL",
        reason: m?.reason || "",
        publicReason: m?.publicReason || "",
        startedAt: m?.startedAt ? new Date(m.startedAt) : null,
        endsAt: m?.endsAt ? new Date(m.endsAt) : null,
        caseId: m?.caseId || null,
        lastOutcome: m?.lastOutcome || null,
        restrictions: {
            preventNewListings: Boolean(m?.restrictions?.preventNewListings),
            preventPublishing: Boolean(m?.restrictions?.preventPublishing),
        },
    };
}
export function sellerWorldBlocked(status) {
    return ["SUSPENDED", "BLOCKED", "ACTIVITY_CHECK", "UNDER_REVIEW"].includes(status);
}
export function buyerEnvBlocked(status) {
    return ["SUSPENDED", "BLOCKED", "ACTIVITY_CHECK", "UNDER_REVIEW"].includes(status);
}
function ensureShape(user, context) {
    if (!user.moderation) {
        user.moderation = { buyer: {}, seller: {} };
    }
    if (!user.moderation.buyer) {
        user.moderation.buyer = {};
    }
    if (!user.moderation.seller) {
        user.moderation.seller = {};
    }
    if (!user.moderation[context]) {
        user.moderation[context] = {};
    }
}
/**
 * If a time-limited SUSPENDED state has passed endsAt,
 * auto-lift to NORMAL and write an audit event.
 * Safe to call on every request.
 */
export async function resolveExpired(user, context) {
    if (!user)
        return user;
    const ctx = getCtx(user, context);
    if (ctx.status !== "SUSPENDED" || !ctx.endsAt) {
        return user;
    }
    if (new Date(ctx.endsAt).getTime() > Date.now()) {
        return user;
    }
    const prev = ctx.status;
    ensureShape(user, context);
    user.moderation[context].status = "NORMAL";
    user.moderation[context].reason = "";
    user.moderation[context].publicReason = "Your access has been restored";
    user.moderation[context].endsAt = undefined;
    user.moderation[context].lastOutcome = "RESTORED";
    user.moderation[context].updatedAt = new Date();
    if (context === "seller") {
        user.isSellerSuspended = false;
    }
    if (typeof user.markModified === "function") {
        user.markModified("moderation");
    }
    await user.save();
    if (ctx.caseId) {
        await ModerationCase.findByIdAndUpdate(ctx.caseId, {
            status: "RESTORED",
            active: false,
            resolvedAt: new Date(),
        }).catch(() => undefined);
    }
    await ModerationEvent.create({
        caseId: ctx.caseId || undefined,
        user: user._id,
        context,
        action: "EXPIRED_AUTO_LIFT",
        previousState: prev,
        newState: "NORMAL",
        reason: "Suspension period ended",
        publicReason: "Your access has been restored",
    }).catch(() => undefined);
    return user;
}
