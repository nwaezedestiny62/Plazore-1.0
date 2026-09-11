import mongoose from "mongoose";

const PerformanceAggregateSchema = new mongoose.Schema(
  {
    environment: {
      type: String,
      enum: ["production", "development", "test"],
      required: true,
    },
    surface: {
      type: String,
      enum: ["app", "web", "admin", "api", "unknown", "all"],
      default: "all",
    },
    bucketStart: { type: Date, required: true },
    bucketSize: {
      type: String,
      enum: ["1m", "5m", "1h", "1d"],
      required: true,
    },
    requests: { type: Number, default: 0 },
    errors: { type: Number, default: 0 },
    totalDurationMs: { type: Number, default: 0 },
    maxDurationMs: { type: Number, default: 0 },
    slowRequests: { type: Number, default: 0 },
    status2xx: { type: Number, default: 0 },
    status4xx: { type: Number, default: 0 },
    status5xx: { type: Number, default: 0 },
    dbOps: { type: Number, default: 0 },
    dbErrors: { type: Number, default: 0 },
    crashes: { type: Number, default: 0 },
  },
  { timestamps: false }
);

PerformanceAggregateSchema.index(
  { environment: 1, surface: 1, bucketSize: 1, bucketStart: 1 },
  { unique: true }
);
PerformanceAggregateSchema.index(
  { bucketStart: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 }
);

const PerformanceAggregate =
  mongoose.models.PerformanceAggregate ||
  mongoose.model("PerformanceAggregate", PerformanceAggregateSchema);

export default PerformanceAggregate;