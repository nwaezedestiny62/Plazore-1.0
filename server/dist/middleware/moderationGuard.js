import { resolveExpired, getCtx, sellerWorldBlocked, buyerEnvBlocked, } from "../utils/moderation.js";
export const requireSellerAccess = async (req, res, next) => {
    try {
        let user = req.user;
        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Not authorized. Please sign in.",
            });
        }
        user = await resolveExpired(user, "seller");
        req.user = user;
        const ctx = getCtx(user, "seller");
        if (sellerWorldBlocked(ctx.status)) {
            return res.status(403).json({
                success: false,
                code: "SELLER_MODERATION",
                moderation: {
                    context: "seller",
                    status: ctx.status,
                    publicReason: ctx.publicReason,
                    startedAt: ctx.startedAt,
                    endsAt: ctx.endsAt,
                    lastOutcome: ctx.lastOutcome,
                },
                message: "Seller World access is currently restricted.",
            });
        }
        // Capability restrictions (listings) without full lock
        if (ctx.status === "NORMAL" &&
            ctx.restrictions?.preventNewListings &&
            req.method === "POST" &&
            req.path.includes("/products")) {
            return res.status(403).json({
                success: false,
                code: "SELLER_RESTRICTION",
                message: "Creating new listings is temporarily restricted.",
            });
        }
        next();
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};
export const requireBuyerAccess = async (req, res, next) => {
    try {
        let user = req.user;
        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Not authorized. Please sign in.",
            });
        }
        user = await resolveExpired(user, "buyer");
        req.user = user;
        const ctx = getCtx(user, "buyer");
        if (buyerEnvBlocked(ctx.status)) {
            return res.status(403).json({
                success: false,
                code: "BUYER_MODERATION",
                moderation: {
                    context: "buyer",
                    status: ctx.status,
                    publicReason: ctx.publicReason,
                    startedAt: ctx.startedAt,
                    endsAt: ctx.endsAt,
                    lastOutcome: ctx.lastOutcome,
                },
                message: "Plazore access is currently restricted.",
            });
        }
        next();
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};
