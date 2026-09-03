import mongoose from "mongoose";

const moderationCaseSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    context: {
      type: String,
      enum: ["buyer", "seller"],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: [
        "ACTIVITY_CHECK",
        "UNDER_REVIEW",
        "SUSPENDED",
        "BLOCKED",
        "PARDONED",
        "RESTORED",
        "CLOSED",
      ],
      required: true,
      index: true,
    },
    previousStatus: { type: String, default: "NORMAL" },
    reason: { type: String, default: "" },
    publicReason: { type: String, default: "" },
    internalNotes: [
      {
        admin: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        body: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    startedAt: { type: Date, default: Date.now },
    endsAt: { type: Date },
    resolvedAt: { type: Date },
    openedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

moderationCaseSchema.index({ user: 1, context: 1, active: 1 });
moderationCaseSchema.index({ status: 1, active: 1, updatedAt: -1 });

export default mongoose.model("ModerationCase", moderationCaseSchema);