import { getAuth } from "@clerk/express";
import User from "../models/User.js";
export const protect = async (req, res, next) => {
    try {
        const { userId } = getAuth(req);
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Not authorized"
            });
        }
        const user = await User.findOne({ clerkId: userId });
        req.user = user;
        next();
    }
    catch (error) {
        console.error("Auth error:", error);
        res.status(500).json({
            success: false,
            message: "Authentication failed",
        });
    }
};
