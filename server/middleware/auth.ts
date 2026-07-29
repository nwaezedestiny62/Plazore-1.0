import { NextFunction, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import User from "../models/User.js";

export const protect = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, isAuthenticated } = getAuth(req);

    if (!userId || !isAuthenticated) {
      return res.status(401).json({
        success: false,
        message: "Not authorized. Please sign in.",
      });
    }

    let user = await User.findOne({ clerkId: userId });

    // Auto-create user if not found
    if (!user) {
      console.log("User not found in DB. Creating new user for clerkId:", userId);

      user = await User.create({
        clerkId: userId,
        email: `user_${userId}@plazore.temp`,
        name: "Plazore User",
        role: "buyer",
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