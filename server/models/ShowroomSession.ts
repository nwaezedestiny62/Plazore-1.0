import mongoose from "mongoose";

const showroomSessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    region: { type: String, default: "NG" },
    behaviorSig: { type: String, default: "" },
    productIdsByRoom: {
      1: [{ type: String }],
      2: [{ type: String }],
      3: [{ type: String }],
      4: [{ type: String }],
    },
    exposureCounts: { type: Map, of: Number, default: {} },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

showroomSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const ShowroomSession = mongoose.model("ShowroomSession", showroomSessionSchema);
export default ShowroomSession;