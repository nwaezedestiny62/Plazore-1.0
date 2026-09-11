import mongoose from "mongoose";

const PerformanceEventSchema = new mongoose.Schema(
  {
    environment: {
      type: String,
      enum: ["production", "development", "test"],
      required: true,
      index: true,
    },
    surface: {
      type: String,
      enum: ["app", "web", "admin", "api", "unknown"],
      default: "unknown",
      index: true,
    },
    service: { type: String, default: "api", index: true },
    eventType: {
      type: String,
      enum: ["request", "error", "db", "crash", "integration", "job"],
      required: true,
      index: true,
    },
    method: String,
    route: { type: String, index: true },
    statusCode: Number,
    durationMs: Number,
    success: { type: Boolean, default: true },
    errorType: String,
    message: String,
    version: String,
    meta: mongoose.Schema.Types.Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Raw events expire after 7 days
PerformanceEventSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 7 * 24 * 60 * 60 }
);
PerformanceEventSchema.index({ environment: 1, eventType: 1, createdAt: -1 });
PerformanceEventSchema.index({ environment: 1, surface: 1, createdAt: -1 });

const PerformanceEvent =
  mongoose.models.PerformanceEvent ||
  mongoose.model("PerformanceEvent", PerformanceEventSchema);

export default PerformanceEvent;