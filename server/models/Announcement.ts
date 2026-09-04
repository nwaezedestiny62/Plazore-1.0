import mongoose, { Schema } from "mongoose";

const announcementSchema = new Schema(
  {
    headline: { type: String, required: true, trim: true, maxlength: 300 },
    body: { type: String, required: true, trim: true, maxlength: 20000 },
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
    action: {
      label: { type: String, default: "" },
      href: { type: String, default: "" },
    },
    status: {
      type: String,
      enum: ["Draft", "Published", "Archived"],
      default: "Draft",
      index: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    publishedAt: { type: Date },
    deliveryCount: { type: Number, default: 0 },
    openCount: { type: Number, default: 0 },
    readCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("Announcement", announcementSchema);