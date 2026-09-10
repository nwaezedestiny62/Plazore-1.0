import { clerkClient } from "@clerk/express";
import User from "../models/User.js";
const makeAdmin = async () => {
    try {
        const email = process.env.ADMIN_EMAIL;
        const user = await User.findOneAndUpdate({ email }, { role: "admin" }, { new: true });
        if (user) {
            await clerkClient.users.updateUserMetadata(user.clerkId, {
                publicMetadata: { role: "admin" },
            });
            console.log("✅ Admin promoted:", email);
        }
    }
    catch (error) {
        console.error("Admin promotion failed:", error.message);
    }
};
export default makeAdmin;
