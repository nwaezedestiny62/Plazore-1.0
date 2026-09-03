import mongoose from "mongoose";

const moderationEventSchema = new mongoose.Schema(
  {
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: "ModerationCase", index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    context: { type: String, enum: ["buyer", "seller"], required: true },
    action: {
      type: String,
      enum: [
        "ACTIVITY_CHECK_REQUESTED",
        "MOVED_TO_REVIEW",
        "PARDONED",
        "SUSPENDED",
        "BLOCKED",
        "LIFTED_SUSPENSION",
        "LIFTED_BLOCK",
        "RESTORED",
        "NOTE_ADDED",
        "RESTRICTION_SET",
        "EXPIRED_AUTO_LIFT",
      ],
      required: true,
    },
    previousState: { type: String, default: "NORMAL" },
    newState: { type: String, required: true },
    reason: { type: String, default: "" },
    publicReason: { type: String, default: "" },
    durationDays: { type: Number },
    endsAt: { type: Date },
    admin: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    meta: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

export default mongoose.model("ModerationEvent", moderationEventSchema);