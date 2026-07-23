import { NextFunction, Request, Response } from "express"
import { getAuth } from "@clerk/express"
import User from "../models/User.js";

export const protect = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { userId } = getAuth(req);

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Not authorized"
            })
        }

        const user = await User.findOne({ clerkId: userId });
        req.user = user;
        next();
    } catch (error) {
        console.error("Auth error:", error);
        res.status(50).json({
            success: false,
            message: "Authentication failed",
        })
    }
}

export const authorize = (...roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: "User role is not authorized for this route",
            })
        }
        next();  // <-- This was also missing! Without next(), the request hangs.
    }
}
