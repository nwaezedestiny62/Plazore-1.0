import mongoose, { Schema } from "mongoose";

const announcementSchema = new Schema(
  {
    headline: { type: String, required: true, trim: true, maxlength: 180 },
    body: { type: String, required: true, trim: true },
    mediaType: {
      type: String,
      enum: ["none", "image", "video"],
      default: "none",
    },
    mediaUrl: { type: String, default: "" },
    audience: {
      type: String,
      enum: ["all", "sellers"],
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
    actionRoute: { type: String, default: "", trim: true }, // internal routes only
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    publishedAt: { type: Date },
    // delivery stats (updated async)
    deliveredCount: { type: Number, default: 0 },
    openedCount: { type: Number, default: 0 },
    readCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

announcementSchema.index({ status: 1, publishedAt: -1 });

export default mongoose.model("Announcement", announcementSchema);