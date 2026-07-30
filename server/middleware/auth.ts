import { NextFunction, Request, Response } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import User from "../models/User.js";

const isBadEmail = (email: string) => {
  const e = (email || "").toLowerCase();
  return (
    !e ||
    e.includes("@plazore.temp") ||
    e.startsWith("user_user_") ||
    e.startsWith("pending_")
  );
};

const isBadName = (name: string) => {
  const n = (name || "").trim();
  return !n || n === "Plazore User" || n === "User";
};

const buildFromClerk = (clerkUser: any) => {
  const email =
    clerkUser.emailAddresses?.find(
      (e: any) => e.id === clerkUser.primaryEmailAddressId
    )?.emailAddress ||
    clerkUser.emailAddresses?.[0]?.emailAddress ||
    "";

  const phone =
    clerkUser.phoneNumbers?.find(
      (p: any) => p.id === clerkUser.primaryPhoneNumberId
    )?.phoneNumber ||
    clerkUser.phoneNumbers?.[0]?.phoneNumber ||
    "";

  const name =
    `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() ||
    clerkUser.username ||
    (email ? email.split("@")[0] : "User");

  return {
    clerkId: clerkUser.id as string,
    email: (email || "").toLowerCase().trim(),
    name,
    phone: phone || "",
    image: clerkUser.imageUrl || "",
  };
};

export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId, isAuthenticated } = getAuth(req);

    if (!userId || !isAuthenticated) {
      return res.status(401).json({
        success: false,
        message: "Not authorized. Please sign in.",
      });
    }

    let user = await User.findOne({ clerkId: userId });

    // Always try Clerk when missing OR placeholder data
    const needsRefresh = !user || isBadName(user.name) || isBadEmail(user.email);

    if (needsRefresh) {
      try {
        const clerkUser = await clerkClient.users.getUser(userId);
        const data = buildFromClerk(clerkUser);

        if (user) {
          // Update existing row — keep role / store fields
          if (data.name) user.name = data.name;
          if (data.email && !isBadEmail(data.email)) {
            const taken = await User.findOne({
              email: data.email,
              _id: { $ne: user._id },
            });
            if (!taken) user.email = data.email;
          }
          if (data.phone) (user as any).phone = data.phone;
          if (data.image) user.image = data.image;
          await user.save();
        } else {
          // Maybe already exists by real email
          let byEmail =
            data.email && !isBadEmail(data.email)
              ? await User.findOne({ email: data.email })
              : null;

          if (byEmail) {
            byEmail.clerkId = userId;
            if (data.name) byEmail.name = data.name;
            if (data.phone) (byEmail as any).phone = data.phone;
            if (data.image) byEmail.image = data.image;
            await byEmail.save();
            user = byEmail;
          } else {
            user = await User.create({
              clerkId: userId,
              email:
                data.email && !isBadEmail(data.email)
                  ? data.email
                  : `pending_${userId.slice(-8)}@plazore.temp`,
              name: data.name || "User",
              phone: data.phone || "",
              image: data.image || "",
              role: "buyer",
            } as any);
          }
        }
      } catch (e: any) {
        console.error("Clerk refresh error:", e?.message || e);
        if (!user) {
          return res.status(500).json({
            success: false,
            message: "Could not load user profile",
          });
        }
      }
    }

    (req as any).user = user;
    next();
  } catch (error: any) {
    console.error("Auth error:", error?.message || error);
    res.status(500).json({
      success: false,
      message: "Authentication failed",
    });
  }
};

export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: "User role is not authorized for this route",
      });
    }
    next();
  };
};