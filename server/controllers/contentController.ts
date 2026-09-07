import { Request, Response } from "express";
import cloudinary from "../config/cloudinary.js";
import HeroBanner from "../models/HeroBanner.js";
import PersonalizedBannerState from "../models/PersonalizedBannerState.js";
import {
  ensureHeroSlots,
  resolvePublicHero,
  BANNER_CYCLE_MS,
} from "../services/heroBannerService.js";

function clampText(s: string, max: number) {
  return String(s || "").trim().slice(0, max);
}

function uploadBufferToCloudinary(
  buffer: Buffer,
  folder: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        transformation: [
          { width: 2400, height: 1350, crop: "limit", quality: "auto:good" },
        ],
      },
      (err, result) => {
        if (err || !result?.secure_url) {
          reject(err || new Error("Cloudinary returned no URL"));
          return;
        }
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}

function sanitizeCreative(body: any) {
  return {
    imageUrl: clampText(body?.imageUrl, 2000),
    headline: clampText(body?.headline, 80),
    subheadline: clampText(body?.subheadline, 160),
    ctaLabel: clampText(body?.ctaLabel || "Explore", 40),
    ctaAction: clampText(body?.ctaAction || "scroll_showroom", 40),
    ctaTarget: clampText(body?.ctaTarget, 500),
    kicker: clampText(body?.kicker, 40),
  };
}

/** Public — mixed 5-slot hero for web/app */
export const getPublicHero = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?._id || null;
    const sessionId = String(
      req.query.sessionId || req.body?.sessionId || ""
    ).trim();
    const region = String(req.query.region || "NG").trim();
    const forceRefresh =
      String(req.query.forceRefresh || "") === "1" ||
      String(req.query.return || "") === "1";

    const banners = await resolvePublicHero({
      userId,
      sessionId,
      region,
      forceRefresh: Boolean(forceRefresh),
    });

    res.json({
      success: true,
      data: {
        banners,
        cycleMs: BANNER_CYCLE_MS,
      },
    });
  } catch (error: any) {
    console.error("getPublicHero:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/** Admin — full content control center payload */
export const getAdminContent = async (req: Request, res: Response) => {
  try {
    await ensureHeroSlots();

    const slots = await HeroBanner.find({})
      .sort({ position: 1 })
      .populate("updatedBy", "name email")
      .lean();

    const recentPersonal = await PersonalizedBannerState.find({})
      .sort({ generatedAt: -1 })
      .limit(12)
      .populate("user", "name email")
      .select(
        "position user sessionId mode primarySignal categoryContext headline imageUrl generatedAt expiresAt cycleId signalScore visualSource usedName"
      )
      .lean();

    const counts = {
      adminPublished: (slots as any[]).filter(
        (s) => s.controlType === "admin" && s.published?.headline
      ).length,
      systemSlots: (slots as any[]).filter((s) => s.controlType === "system")
        .length,
      activePersonalCycles: await PersonalizedBannerState.countDocuments({
        expiresAt: { $gt: new Date() },
      }),
    };

    res.json({
      success: true,
      data: {
        slots,
        recentPersonal,
        counts,
        cycleMs: BANNER_CYCLE_MS,
      },
    });
  } catch (error: any) {
    console.error("getAdminContent:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAdminBannerSlot = async (req: Request, res: Response) => {
  try {
    const position = parseInt(String(req.params.position), 10);
    if (![1, 2, 3, 4, 5].includes(position)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid position" });
    }
    await ensureHeroSlots();
    const slot = await HeroBanner.findOne({ position })
      .populate("updatedBy", "name email")
      .lean();
    if (!slot)
      return res.status(404).json({ success: false, message: "Not found" });

    let samplePersonal: any[] = [];
    if ((slot as any).controlType === "system") {
      samplePersonal = await PersonalizedBannerState.find({ position })
        .sort({ generatedAt: -1 })
        .limit(8)
        .populate("user", "name email")
        .lean();
    }

    res.json({ success: true, data: { slot, samplePersonal } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/** Save draft for admin-controlled slots only */
export const saveAdminBannerDraft = async (req: Request, res: Response) => {
  try {
    const position = parseInt(String(req.params.position), 10);
    const slot = await HeroBanner.findOne({ position });
    if (!slot)
      return res.status(404).json({ success: false, message: "Not found" });
    if (slot.controlType !== "admin") {
      return res.status(403).json({
        success: false,
        message:
          "System personalized banners cannot be manually edited. Controlled by Plazore adaptive experience.",
      });
    }

    const creative = sanitizeCreative(req.body);
    if (!creative.headline) {
      return res
        .status(400)
        .json({ success: false, message: "Headline is required" });
    }

    slot.draft = creative as any;
    slot.updatedBy = (req as any).user?._id;
    await slot.save();

    res.json({ success: true, data: slot });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/** Publish draft → live, push previous published into history */
export const publishAdminBanner = async (req: Request, res: Response) => {
  try {
    const position = parseInt(String(req.params.position), 10);
    const slot = await HeroBanner.findOne({ position });
    if (!slot)
      return res.status(404).json({ success: false, message: "Not found" });
    if (slot.controlType !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Cannot publish system-personalized slots.",
      });
    }

    const creative = req.body?.headline
      ? sanitizeCreative(req.body)
      : (slot.draft as any);

    if (!creative?.headline) {
      return res
        .status(400)
        .json({ success: false, message: "Nothing to publish" });
    }

    const nextVersion = (slot.publishedVersion || 0) + 1;

    if (slot.publishedVersion > 0 && (slot.published as any)?.headline) {
      if (!Array.isArray(slot.history)) (slot as any).history = [];
      (slot.history as any).push({
        version: slot.publishedVersion,
        creative: slot.published,
        status: "archived",
        publishedAt: slot.updatedAt || new Date(),
        archivedAt: new Date(),
        createdBy: slot.updatedBy,
        note: "Superseded by publish",
      });
    }

    slot.published = creative as any;
    slot.draft = creative as any;
    slot.publishedVersion = nextVersion;
    slot.isActive = req.body?.isActive === false ? false : true;
    slot.updatedBy = (req as any).user?._id;

    (slot.history as any).push({
      version: nextVersion,
      creative,
      status: "published",
      publishedAt: new Date(),
      createdBy: (req as any).user?._id,
      note: String(req.body?.note || "Published"),
    });

    if ((slot.history as any).length > 40) {
      (slot as any).history = (slot.history as any).slice(-40);
    }

    await slot.save();
    res.json({ success: true, data: slot });
  } catch (error: any) {
    console.error("publishAdminBanner:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const uploadBannerImage = async (req: Request, res: Response) => {
  try {
    const file = (req as any).file as
      | { buffer: Buffer; mimetype?: string; originalname?: string }
      | undefined;

    if (!file?.buffer) {
      return res.status(400).json({
        success: false,
        message: 'No image file. Send multipart field "image".',
      });
    }

    if (file.mimetype && !String(file.mimetype).startsWith("image/")) {
      return res.status(400).json({
        success: false,
        message: "File must be an image",
      });
    }

    const imageUrl = await uploadBufferToCloudinary(
      file.buffer,
      "plazore/hero-banners"
    );

    return res.json({
      success: true,
      data: { imageUrl },
    });
  } catch (error: any) {
    console.error("uploadBannerImage:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Upload failed",
    });
  }
};

export const setAdminBannerActive = async (req: Request, res: Response) => {
  try {
    const position = parseInt(String(req.params.position), 10);
    const slot = await HeroBanner.findOne({ position });
    if (!slot)
      return res.status(404).json({ success: false, message: "Not found" });
    if (slot.controlType !== "admin") {
      return res.status(403).json({
        success: false,
        message: "System slots stay active for personalization.",
      });
    }
    slot.isActive = Boolean(req.body?.isActive);
    slot.updatedBy = (req as any).user?._id;
    await slot.save();
    res.json({ success: true, data: slot });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAdminPersonalDiagnostics = async (
  req: Request,
  res: Response
) => {
  try {
    const position = parseInt(String(req.query.position || "1"), 10);
    if (![1, 4].includes(position)) {
      return res.status(400).json({
        success: false,
        message: "Diagnostics only for positions 1 and 4",
      });
    }

    const items = await PersonalizedBannerState.find({ position })
      .sort({ generatedAt: -1 })
      .limit(20)
      .populate("user", "name email marketplaceRegion")
      .lean();

    res.json({
      success: true,
      data: items,
      cycleMs: BANNER_CYCLE_MS,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};