import { Request, Response, NextFunction } from "express";
import {
  resolveExpired,
  getCtx,
  sellerWorldBlocked,
  buyerEnvBlocked,
} from "../utils/moderation.js";

export const requireSellerAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    let user = (req as any).user;
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Not authorized. Please sign in.",
      });
    }

    user = await resolveExpired(user, "seller");
    (req as any).user = user;

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
    if (
      ctx.status === "NORMAL" &&
      ctx.restrictions?.preventNewListings &&
      req.method === "POST" &&
      req.path.includes("/products")
    ) {
      return res.status(403).json({
        success: false,
        code: "SELLER_RESTRICTION",
        message: "Creating new listings is temporarily restricted.",
      });
    }

    next();
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const requireBuyerAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    let user = (req as any).user;
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Not authorized. Please sign in.",
      });
    }

    user = await resolveExpired(user, "buyer");
    (req as any).user = user;

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
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};