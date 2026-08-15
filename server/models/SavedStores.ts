import mongoose from "mongoose";

const savedStoreSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    stores: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

const SavedStore = mongoose.model("SavedStore", savedStoreSchema);
export default SavedStore;