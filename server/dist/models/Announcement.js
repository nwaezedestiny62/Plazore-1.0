import mongoose, { Schema } from "mongoose";
const designSchema = new Schema({
    layout: {
        type: String,
        enum: ["stack", "split", "banner"],
        default: "stack",
    },
    theme: {
        type: String,
        enum: ["dark", "light", "brand"],
        default: "dark",
    },
    accent: {
        type: String,
        enum: ["green", "amber", "blue", "neutral"],
        default: "green",
    },
    titleSize: {
        type: String,
        enum: ["sm", "md", "lg"],
        default: "md",
    },
    mediaAspect: {
        type: String,
        enum: ["16:9", "1:1", "4:5", "auto"],
        default: "16:9",
    },
    showMediaTop: { type: Boolean, default: true },
}, { _id: false });
const announcementSchema = new Schema({
    headline: { type: String, required: true, trim: true, maxlength: 180 },
    body: { type: String, required: true, trim: true, maxlength: 4000 },
    mediaType: {
        type: String,
        enum: ["none", "image", "video"],
        default: "none",
    },
    mediaUrl: { type: String, default: "" },
    mediaPosterUrl: { type: String, default: "" },
    audience: {
        type: String,
        enum: ["all", "buyers", "sellers"],
        required: true,
        index: true,
    },
    status: {
        type: String,
        enum: ["draft", "published", "archived"],
        default: "draft",
        index: true,
    },
    actionLabel: { type: String, default: "", trim: true, maxlength: 40 },
    actionRoute: { type: String, default: "", trim: true },
    design: {
        type: designSchema,
        default: () => ({}),
    },
    /** Announcements are always one-way */
    allowsReply: { type: Boolean, default: false },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    publishedAt: { type: Date },
    expiresAt: { type: Date, default: null },
    deliveredCount: { type: Number, default: 0 },
    openedCount: { type: Number, default: 0 },
    readCount: { type: Number, default: 0 },
}, { timestamps: true });
announcementSchema.index({ status: 1, publishedAt: -1 });
announcementSchema.index({ audience: 1, status: 1 });
export default mongoose.model("Announcement", announcementSchema);
