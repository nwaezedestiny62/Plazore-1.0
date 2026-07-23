import { NextFunction, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import User from "../models/User.js";

export const protect = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { userId } = getAuth(req);

        if (!userId) {
            console.error("Clerk: No userId found");
            return res.status(401).json({
                success: false,
                message: "Not authorized - No valid session"
            });
        }

        const user = await User.findOne({ clerkId: userId });

        if (!user) {
            console.error(`User not found for clerkId: ${userId}`);
            return res.status(401).json({
                success: false,
                message: "User not found in database"
            });
        }

        req.user = user;
        next();
    } catch (error: any) {
        console.error("Auth error:", error.message || error);
        res.status(500).json({
            success: false,
            message: "Authentication failed",
        });
    }
};

export const authorize = (...roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: "User role is not authorized for this route",
            });
        }
        next();
    };
};