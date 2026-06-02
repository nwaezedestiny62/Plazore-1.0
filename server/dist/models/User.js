import mongoose from "mongoose";
const userSchema = new mongoose.Schema({
    name: { type: String, trim: true },
    email: { type: String, unique: true, trim: true },
    clerkId: { type: String, unique: true, sparse: true },
    image: { type: String },
    role: { type: String, enum: ["user", "admin"], default: "user" },
}, { timestamps: true });
const User = mongoose.model('User', userSchema);
export default User;
