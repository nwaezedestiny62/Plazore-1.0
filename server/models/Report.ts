import mongoose, { Schema } from "mongoose";

const reportSchema = new Schema(
  {
    reporter: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    targetType: {
      type: String,
      enum: ["product", "store"],
      required: true,
      index: true,
    },
    product: { type: Schema.Types.ObjectId, ref: "Product", default: null, index: true },
    seller: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    reason: {
      type: String,
      enum: [
        "counterfeit",
        "misleading",
        "prohibited",
        "offensive",
        "scam",
        "policy_violation",
        "other",
      ],
      required: true,
      index: true,
    },
    description: { type: String, default: "", maxlength: 2000 },
    priority: {
      type: String,
      enum: ["normal", "high", "critical"],
      default: "normal",
      index: true,
    },
    status: {
      type: String,
      enum: ["new", "under_review", "action_required", "no_action", "resolved", "closed"],
      default: "new",
      index: true,
    },
    assignedAdmin: { type: Schema.Types.ObjectId, ref: "User", default: null },
    resolutionNote: { type: String, default: "", maxlength: 2000 },
    resolvedAt: { type: Date },
    closedAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model("Report", reportSchema);