import mongoose from "mongoose";

/**
 * ShowroomEvent — user activity for The Watch (Room 3) and interest signals.
 * MUST stay separate from ShowroomSession.
 */
const showroomEventSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, index: true },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        "impression",
        "open",
        "cart",
        "wishlist",
        "purchase",
        "skip",
        "search",
      ],
      required: true,
      index: true,
    },
    room: { type: Number, min: 1, max: 4, index: true },
    position: { type: Number, default: 0 },
    region: { type: String, default: "NG", index: true },
    /** Optional free-text for type=search */
    query: { type: String, default: "" },
  },
  { timestamps: true }
);

showroomEventSchema.index({ sessionId: 1, createdAt: -1 });
showroomEventSchema.index({ user: 1, createdAt: -1 });
showroomEventSchema.index({ product: 1, type: 1, createdAt: -1 });

const ShowroomEvent = mongoose.model("ShowroomEvent", showroomEventSchema);
export default ShowroomEvent;
