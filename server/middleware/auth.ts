import { NextFunction, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import User from "../models/User.js";

export const protect = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { userId } = getAuth(req);   // Make sure you have `import { getAuth } from "@clerk/express";`

        console.log("🔍 Clerk Debug - userId received:", userId);

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Not authorized - No userId"
            });
        }

        const user = await User.findOne({ clerkId: userId });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User not found in database"
            });
        }

        req.user = user;
        next();
    } catch (error: any) {
        console.error("Auth error:", error.message);
        res.status(500).json({
            success: false,
            message: "Authentication failed",
        });
    }
};