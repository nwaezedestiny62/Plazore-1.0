import { Request, Response } from "express";
import Announcement from "../models/Announcement.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import { uploadAnnouncementMedia } from "../utils/supabaseUpload.js";

const AUDIENCES = ["all", "buyers", "sellers"] as const;
const STATUSES = ["draft", "published", "archived"] as const;
const MEDIA = ["none", "image", "video"] as const;

function sanitizeDesign(raw: any) {
  const d = raw && typeof raw === "object" ? raw : {};
  return {
    layout: ["stack", "split", "banner"].includes(d.layout) ? d.layout : "stack",
    theme: ["dark", "light", "brand"].includes(d.theme) ? d.theme : "dark",
    accent: ["green", "amber", "blue", "neutral"].includes(d.accent)
      ? d.accent
      : "green",
    titleSize: ["sm", "md", "lg"].includes(d.titleSize) ? d.titleSize : "md",
    mediaAspect: ["16:9", "1:1", "4:5", "auto"].includes(d.mediaAspect)
      ? d.mediaAspect
      : "16:9",
    showMediaTop: d.showMediaTop !== false,
  };
}

function userFilterForAudience(audience: string): Record<string, unknown> {
  if (audience === "buyers") return { role: "buyer" };
  if (audience === "sellers") return { role: "seller" };
  return {};
}

export const getAdminAnnouncements = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(String(req.query.limit || "20"), 10))
    );
    const status = String(req.query.status || "").trim();
    const audience = String(req.query.audience || "").trim();

    const filter: Record<string, unknown> = {};
    if (status && (STATUSES as readonly string[]).includes(status)) {
      filter.status = status;
    }
    if (audience && (AUDIENCES as readonly string[]).includes(audience)) {
      filter.audience = audience;
    }

    const [items, total] = await Promise.all([
      Announcement.find(filter as any)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("createdBy", "name email")
        .lean(),
      Announcement.countDocuments(filter as any),
    ]);

    res.json({
      success: true,
      data: items,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAdminAnnouncement = async (req: Request, res: Response) => {
  try {
    const item = await Announcement.findById(req.params.id)
      .populate("createdBy", "name email")
      .lean();
    if (!item) {
      return res.status(404).json({ success: false, message: "Not found" });
    }
    res.json({ success: true, data: item });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createAdminAnnouncement = async (req: Request, res: Response) => {
  try {
    const admin = (req as any).user;
    if (!admin?._id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const headline = String(req.body.headline || "").trim();
    const body = String(req.body.body || "").trim();
    if (!headline || !body) {
      return res.status(400).json({
        success: false,
        message: "headline and body are required",
      });
    }

    const audience = (AUDIENCES as readonly string[]).includes(req.body.audience)
      ? req.body.audience
      : "all";

    const mediaType = (MEDIA as readonly string[]).includes(req.body.mediaType)
      ? req.body.mediaType
      : "none";

    const doc = await Announcement.create({
      headline: headline.slice(0, 180),
      body: body.slice(0, 4000),
      mediaType,
      mediaUrl: String(req.body.mediaUrl || "").trim(),
      mediaPosterUrl: String(req.body.mediaPosterUrl || "").trim(),
      audience,
      status: "draft",
      actionLabel: String(req.body.actionLabel || "").trim().slice(0, 40),
      actionRoute: String(req.body.actionRoute || "").trim(),
      design: sanitizeDesign(req.body.design),
      allowsReply: false,
      createdBy: admin._id,
    });

    res.status(201).json({ success: true, data: doc });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateAdminAnnouncement = async (req: Request, res: Response) => {
  try {
    const item = await Announcement.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    if (typeof req.body.headline === "string") {
      item.headline = req.body.headline.trim().slice(0, 180);
    }
    if (typeof req.body.body === "string") {
      item.body = req.body.body.trim().slice(0, 4000);
    }
    if ((MEDIA as readonly string[]).includes(req.body.mediaType)) {
      (item as any).mediaType = req.body.mediaType;
    }
    if (typeof req.body.mediaUrl === "string") {
      item.mediaUrl = req.body.mediaUrl.trim();
    }
    if (typeof req.body.mediaPosterUrl === "string") {
      (item as any).mediaPosterUrl = req.body.mediaPosterUrl.trim();
    }
    if ((AUDIENCES as readonly string[]).includes(req.body.audience)) {
      (item as any).audience = req.body.audience;
    }
    if (typeof req.body.actionLabel === "string") {
      item.actionLabel = req.body.actionLabel.trim().slice(0, 40);
    }
    if (typeof req.body.actionRoute === "string") {
      item.actionRoute = req.body.actionRoute.trim();
    }
    if (req.body.design) {
      (item as any).design = sanitizeDesign(req.body.design);
    }
    if (req.body.expiresAt !== undefined) {
      item.expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : null;
    }
    if (req.body.status === "archived" || req.body.status === "draft") {
      item.status = req.body.status;
    }

    (item as any).allowsReply = false;
    await item.save();

    res.json({ success: true, data: item });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const publishAdminAnnouncement = async (req: Request, res: Response) => {
  try {
    const item = await Announcement.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    if (item.status === "published") {
      return res.status(400).json({
        success: false,
        message: "Already published",
      });
    }

    const headline = String(item.headline || "").trim();
    const body = String(item.body || "").trim();
    if (!headline || !body) {
      return res.status(400).json({
        success: false,
        message: "headline and body required before publish",
      });
    }

    const userFilter = userFilterForAudience(String(item.audience));
    const users = await User.find(userFilter as any).select("_id").lean();

    const now = new Date();
    item.status = "published";
    item.publishedAt = now;
    (item as any).allowsReply = false;
    item.deliveredCount = users.length;
    await item.save();

    const chunkSize = 500;
    for (let i = 0; i < users.length; i += chunkSize) {
      const slice = users.slice(i, i + chunkSize);
      const ops = slice.map((u: any) => ({
        insertOne: {
          document: {
            user: u._id,
            type: "announcement",
            title: headline.slice(0, 120),
            message: body.slice(0, 200) + (body.length > 200 ? "…" : ""),
            announcement: item._id,
            link: item.actionRoute || "",
          },
        },
      }));
      if (ops.length) {
        try {
          await Notification.bulkWrite(ops as any, { ordered: false });
        } catch (e) {
          console.error(
            "Announcement notify chunk failed:",
            (e as any)?.message
          );
        }
      }
    }

    res.json({
      success: true,
      data: item,
      deliveredCount: users.length,
    });
  } catch (error: any) {
    console.error("publishAdminAnnouncement:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const archiveAdminAnnouncement = async (req: Request, res: Response) => {
  try {
    const item = await Announcement.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: "Not found" });
    }
    item.status = "archived";
    await item.save();
    res.json({ success: true, data: item });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const uploadAnnouncementMediaHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file?.buffer) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded (field name: file)",
      });
    }

    const kind =
      String(req.body.kind || req.query.kind || "").toLowerCase() === "video"
        ? "video"
        : "image";

    const { publicUrl, path } = await uploadAnnouncementMedia(file, kind);

    res.json({
      success: true,
      data: { url: publicUrl, path, kind },
    });
  } catch (error: any) {
    console.error("uploadAnnouncementMedia:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Upload failed",
    });
  }
};

export const getPublicAnnouncements = async (req: Request, res: Response) => {
  try {
    const limit = Math.min(
      30,
      Math.max(1, parseInt(String(req.query.limit || "10"), 10))
    );
    const audience = String(req.query.audience || "all").trim();

    const now = new Date();
    const filter: any = {
      status: "published",
      $or: [
        { expiresAt: null },
        { expiresAt: { $exists: false } },
        { expiresAt: { $gt: now } },
      ],
    };

    if (audience === "buyers" || audience === "sellers") {
      filter.audience = { $in: ["all", audience] };
    }

    const items = await Announcement.find(filter as any)
      .sort({ publishedAt: -1 })
      .limit(limit)
      .select(
        "headline body mediaType mediaUrl mediaPosterUrl audience actionLabel actionRoute design publishedAt"
      )
      .lean();

    res.json({ success: true, data: items });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};