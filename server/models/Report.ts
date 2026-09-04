import mongoose, { Schema } from "mongoose";

const PRODUCT_REASONS = [
  "counterfeit",
  "misleading_info",
  "photos_mismatch",
  "incorrect_specs",
  "misleading_price",
  "unavailable",
  "unsafe_prohibited",
  "ip_concern",
  "suspicious_listing",
  "other_product",
] as const;

const STORE_REASONS = [
  "fraudulent_store",
  "impersonation",
  "misleading_business",
  "abusive_behaviour",
  "repeated_misleading",
  "prohibited_activity",
  "ip_concern_store",
  "suspicious_activity",
  "other_store",
] as const;

const reportSchema = new Schema(
  {
    reporter: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    reporterRole: {
      type: String,
      enum: ["buyer", "seller", "admin"],
      default: "buyer",
    },
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
      enum: [...PRODUCT_REASONS, ...STORE_REASONS, "counterfeit", "misleading", "prohibited", "offensive", "scam", "policy_violation", "other"],
      required: true,
      index: true,
    },
    description: { type: String, default: "", maxlength: 4000 },
    email: { type: String, default: "", trim: true },
    location: {
      country: { type: String, default: "" },
      state: { type: String, default: "" },
      city: { type: String, default: "" },
      street: { type: String, default: "" },
    },
    priority: {
      type: String,
      enum: ["normal", "high", "critical"],
      default: "normal",
      index: true,
    },
    status: {
      type: String,
      enum: ["Submitted", "Under Review", "Resolved", "Closed", "new", "under_review", "action_required", "no_action", "resolved", "closed"],
      default: "Submitted",
      index: true,
    },
    assignedAdmin: { type: Schema.Types.ObjectId, ref: "User", default: null },
    resolutionNote: { type: String, default: "", maxlength: 2000 },
    resolvedAt: { type: Date },
    closedAt: { type: Date },
  },
  { timestamps: true }
);

export const PRODUCT_REPORT_REASONS = PRODUCT_REASONS;
export const STORE_REPORT_REASONS = STORE_REASONS;
export default mongoose.model("Report", reportSchema);