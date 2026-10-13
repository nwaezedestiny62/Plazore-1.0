import mongoose from "mongoose";

/**
 * ShowroomSession
 * Caches product IDs per room with per-room build timestamps
 * so Room 1 / 2 / 3 / 4 can rotate on different schedules:
 *   Room 1 → 2h
 *   Room 2 → 3h
 *   Room 3 → 20m
 *   Room 4 → always live (TTL 0)
 */
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
    /** When each room was last rebuilt (ISO date per room key "1"|"2"|"3"|"4") */
    roomBuiltAt: {
      type: Map,
      of: Date,
      default: {},
    },
    exposureCounts: { type: Map, of: Number, default: {} },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

showroomSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const ShowroomSession = mongoose.model(
  "ShowroomSession",
  showroomSessionSchema
);
export default ShowroomSession;
