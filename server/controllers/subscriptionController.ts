import { Request, Response } from "express";
import {
  listPlansForSeller,
  initiatePlanPayment,
  verifyAndActivatePlan,
  activateFreePlan,
  activatePromoDominant,
  getActivePlanForSeller,
  getPromoOverview,
  setPromoEnabled,
  listSubscriptionsAdmin,
  onSellerOnboardingComplete,
  expireOverdueSubscriptions,
} from "../services/subscriptionService.js";
import type { PlanId } from "../config/plans.js";

const getUser = (req: Request) => (req as any).user;

/** GET /api/seller/plans */
export const getSellerPlans = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    if (!user?._id) {
      return res.status(401).json({ success: false, message: "Sign in required" });
    }
    const data = await listPlansForSeller(user._id.toString());
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(e.statusCode || 500).json({
      success: false,
      message: e.message || "Failed to load plans",
      code: e.code,
    });
  }
};

/** GET /api/seller/subscription */
export const getMySubscription = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    if (!user?._id) {
      return res.status(401).json({ success: false, message: "Sign in required" });
    }
    const data = await getActivePlanForSeller(user._id.toString());
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(e.statusCode || 500).json({
      success: false,
      message: e.message || "Failed to load subscription",
    });
  }
};

/**
 * POST /api/seller/subscriptions/initiate
 * Body: {
 *   planId: "dominant" | "business_plus" | "global_reach" | "free",
 *   callbackUrl?,
 *   provider?: "paystack" | "stripe"
 * }
 */
export const initiateSubscription = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    if (!user?._id) {
      return res.status(401).json({ success: false, message: "Sign in required" });
    }
    const planId = String(req.body?.planId || "free").toLowerCase() as PlanId;
    const callbackUrl = req.body?.callbackUrl;
    const provider = req.body?.provider;

    const result = await initiatePlanPayment(
      user._id.toString(),
      planId,
      callbackUrl,
      provider
    );

    if (result.free) {
      return res.json({
        success: true,
        data: {
          activated: true,
          planId: "free",
          subscription: result.subscription,
          message: "Free Seller plan is active. No payment required.",
        },
      });
    }

    res.status(201).json({
      success: true,
      data: {
        activated: false,
        paymentRequired: true,
        provider: result.provider,
        reference: result.reference,
        // Paystack
        authorizationUrl: result.authorizationUrl || null,
        authorization_url: result.authorizationUrl || null,
        accessCode: result.accessCode || null,
        // Stripe
        clientSecret: result.clientSecret || null,
        paymentIntentId: result.paymentIntentId || null,
        publicKey: result.publicKey || null,
        amount: result.amount,
        currency: result.currency,
        planId: result.planId,
        country: result.country,
        message:
          result.provider === "stripe"
            ? "Complete payment with Stripe. Plan activates only after verification."
            : "Complete payment on Paystack. Plan activates only after verification.",
      },
    });
  } catch (e: any) {
    res.status(e.statusCode || 500).json({
      success: false,
      message: e.message || "Could not start subscription payment",
      code: e.code,
    });
  }
};

/**
 * POST /api/seller/subscriptions/verify
 * Body: { reference }
 */
export const verifySubscription = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    if (!user?._id) {
      return res.status(401).json({ success: false, message: "Sign in required" });
    }
    const reference = String(req.body?.reference || "").trim();
    if (!reference) {
      return res.status(400).json({
        success: false,
        message: "Payment reference is required",
      });
    }

    const result = await verifyAndActivatePlan(user._id.toString(), reference);
    res.json({
      success: true,
      data: {
        activated: true,
        alreadyActive: !!(result as any).alreadyActive,
        subscription: result.subscription,
        message: "Payment verified. Plan is now active for one month.",
      },
    });
  } catch (e: any) {
    res.status(e.statusCode || 500).json({
      success: false,
      message: e.message || "Verification failed — plan not activated",
      code: e.code,
    });
  }
};

/** POST /api/seller/subscriptions/activate-promo */
export const activatePromo = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    if (!user?._id) {
      return res.status(401).json({ success: false, message: "Sign in required" });
    }
    const result = await activatePromoDominant(user._id.toString());
    res.json({
      success: true,
      data: {
        activated: true,
        promotional: true,
        subscription: result.subscription,
        claim: result.claim,
        message:
          "Dominant Niche promotional access is active for 7 months at no charge.",
      },
    });
  } catch (e: any) {
    res.status(e.statusCode || 500).json({
      success: false,
      message: e.message || "Could not activate promotional plan",
      code: e.code,
    });
  }
};

/** POST /api/seller/subscriptions/activate-free */
export const activateFree = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    if (!user?._id) {
      return res.status(401).json({ success: false, message: "Sign in required" });
    }
    const sub = await activateFreePlan(user._id.toString());
    res.json({
      success: true,
      data: {
        activated: true,
        planId: "free",
        subscription: sub.subscription || sub,
      },
    });
  } catch (e: any) {
    res.status(e.statusCode || 500).json({
      success: false,
      message: e.message || "Could not activate Free Seller",
    });
  }
};

/** POST /api/seller/onboarding/complete-hook */
export const onboardingCompleteHook = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    if (!user?._id) {
      return res.status(401).json({ success: false, message: "Sign in required" });
    }
    const claim = await onSellerOnboardingComplete(user._id.toString());
    res.json({ success: true, data: { claim } });
  } catch (e: any) {
    res.status(e.statusCode || 500).json({
      success: false,
      message: e.message || "Onboarding hook failed",
    });
  }
};

// ── Admin ──────────────────────────────────────────────

/** GET /api/admin/subscriptions/overview */
export const adminSubscriptionsOverview = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    if (user?.role !== "admin") {
      return res.status(403).json({ success: false, message: "Admin only" });
    }
    const [promo, subscriptions] = await Promise.all([
      getPromoOverview(),
      listSubscriptionsAdmin(100),
    ]);
    res.json({
      success: true,
      data: {
        promo,
        subscriptions,
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

/** POST /api/admin/subscriptions/promo  body: { enabled: boolean } */
export const adminSetPromo = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    if (user?.role !== "admin") {
      return res.status(403).json({ success: false, message: "Admin only" });
    }
    const enabled = !!req.body?.enabled;
    const promo = await setPromoEnabled(enabled);
    res.json({ success: true, data: { promo } });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

/** POST /api/admin/subscriptions/expire-overdue — manual trigger / cron */
export const adminExpireOverdue = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    if (user?.role !== "admin") {
      return res.status(403).json({ success: false, message: "Admin only" });
    }
    const result = await expireOverdueSubscriptions(200);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};
