import mongoose from "mongoose";
const AddressSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User",
        required: true, unique: true },
    type: { type: String, required: true, enum: ["Home", "Work",
            "Other"], default: "Home" },
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
});
export default mongoose.model("Address", AddressSchema);
