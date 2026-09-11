import mongoose from "mongoose";

const IncidentSchema = new mongoose.Schema(
  {
    environment: {
      type: String,
      enum: ["production", "development", "test"],
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ["critical", "high", "medium", "low", "observation"],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["detected", "investigating", "monitoring", "resolved", "ignored"],
      default: "detected",
      index: true,
    },
    source: { type: String, required: true },
    surface: String,
    area: String,
    endpoint: String,
    title: { type: String, required: true },
    description: String,
    firstDetected: { type: Date, required: true },
    lastDetected: { type: Date, required: true },
    occurrences: { type: Number, default: 1 },
    affectedSessions: Number,
    meta: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

IncidentSchema.index({ environment: 1, status: 1, lastDetected: -1 });

const Incident =
  mongoose.models.Incident || mongoose.model("Incident", IncidentSchema);

export default Incident;