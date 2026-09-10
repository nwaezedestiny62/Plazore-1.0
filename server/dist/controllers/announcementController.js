import Announcement from "../models/Announcement.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import { uploadAnnouncementMedia } from "../utils/supabaseUpload.js";
const AUDIENCES = ["all", "buyers", "sellers"];
const STATUSES = ["draft", "published", "archived"];
const MEDIA = ["none", "image", "video"];
function sanitizeDesign(raw) {
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
function userFilterForAudience(audience) {
    if (audience === "buyers")
        return { role: "buyer" };
    if (audience === "sellers")
        return { role: "seller" };
    return {};
}
export const getAdminAnnouncements = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
        const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || "20"), 10)));
        const status = String(req.query.status || "").trim();
        const audience = String(req.query.audience || "").trim();
        const filter = {};
        if (status && STATUSES.includes(status)) {
            filter.status = status;
        }
        if (audience && AUDIENCES.includes(audience)) {
            filter.audience = audience;
        }
        const [items, total] = await Promise.all([
            Announcement.find(filter)
                .sort({ updatedAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .populate("createdBy", "name email")
                .lean(),
            Announcement.countDocuments(filter),
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
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
export const getAdminAnnouncement = async (req, res) => {
    try {
        const item = await Announcement.findById(req.params.id)
            .populate("createdBy", "name email")
            .lean();
        if (!item) {
            return res.status(404).json({ success: false, message: "Not found" });
        }
        res.json({ success: true, data: item });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
export const createAdminAnnouncement = async (req, res) => {
    try {
        const admin = req.user;
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
        const audience = AUDIENCES.includes(req.body.audience)
            ? req.body.audience
            : "all";
        const mediaType = MEDIA.includes(req.body.mediaType)
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
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
export const updateAdminAnnouncement = async (req, res) => {
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
        if (MEDIA.includes(req.body.mediaType)) {
            item.mediaType = req.body.mediaType;
        }
        if (typeof req.body.mediaUrl === "string") {
            item.mediaUrl = req.body.mediaUrl.trim();
        }
        if (typeof req.body.mediaPosterUrl === "string") {
            item.mediaPosterUrl = req.body.mediaPosterUrl.trim();
        }
        if (AUDIENCES.includes(req.body.audience)) {
            item.audience = req.body.audience;
        }
        if (typeof req.body.actionLabel === "string") {
            item.actionLabel = req.body.actionLabel.trim().slice(0, 40);
        }
        if (typeof req.body.actionRoute === "string") {
            item.actionRoute = req.body.actionRoute.trim();
        }
        if (req.body.design) {
            item.design = sanitizeDesign(req.body.design);
        }
        if (req.body.expiresAt !== undefined) {
            item.expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : null;
        }
        if (req.body.status === "archived" || req.body.status === "draft") {
            item.status = req.body.status;
        }
        item.allowsReply = false;
        await item.save();
        res.json({ success: true, data: item });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
export const publishAdminAnnouncement = async (req, res) => {
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
        const users = await User.find(userFilter).select("_id").lean();
        const now = new Date();
        item.status = "published";
        item.publishedAt = now;
        item.allowsReply = false;
        item.deliveredCount = users.length;
        await item.save();
        const chunkSize = 500;
        for (let i = 0; i < users.length; i += chunkSize) {
            const slice = users.slice(i, i + chunkSize);
            const ops = slice.map((u) => ({
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
                    await Notification.bulkWrite(ops, { ordered: false });
                }
                catch (e) {
                    console.error("Announcement notify chunk failed:", e?.message);
                }
            }
        }
        res.json({
            success: true,
            data: item,
            deliveredCount: users.length,
        });
    }
    catch (error) {
        console.error("publishAdminAnnouncement:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
export const archiveAdminAnnouncement = async (req, res) => {
    try {
        const item = await Announcement.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ success: false, message: "Not found" });
        }
        item.status = "archived";
        await item.save();
        res.json({ success: true, data: item });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
export const uploadAnnouncementMediaHandler = async (req, res) => {
    try {
        const file = req.file;
        if (!file?.buffer) {
            return res.status(400).json({
                success: false,
                message: "No file uploaded (field name: file)",
            });
        }
        const kind = String(req.body.kind || req.query.kind || "").toLowerCase() === "video"
            ? "video"
            : "image";
        const { publicUrl, path } = await uploadAnnouncementMedia(file, kind);
        res.json({
            success: true,
            data: { url: publicUrl, path, kind },
        });
    }
    catch (error) {
        console.error("uploadAnnouncementMedia:", error);
        res.status(500).json({
            success: false,
            message: error?.message || "Upload failed",
        });
    }
};
export const getPublicAnnouncements = async (req, res) => {
    try {
        const limit = Math.min(30, Math.max(1, parseInt(String(req.query.limit || "10"), 10)));
        const audience = String(req.query.audience || "all").trim();
        const now = new Date();
        const filter = {
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
        const items = await Announcement.find(filter)
            .sort({ publishedAt: -1 })
            .limit(limit)
            .select("headline body mediaType mediaUrl mediaPosterUrl audience actionLabel actionRoute design publishedAt")
            .lean();
        res.json({ success: true, data: items });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
