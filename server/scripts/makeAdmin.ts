import { clerkClient } from "@clerk/express";
import User from "../models/User.js";
import AdminMembership from "../models/AdminMembership.js";

/**
 * Bootstraps the first Super Admin from ADMIN_EMAIL.
 * - Sets User.role = "admin" (legacy API authorize)
 * - Ensures an active AdminMembership (super_admin)
 * - Syncs Clerk publicMetadata
 */
const makeAdmin = async () => {
  try {
    const email = (process.env.ADMIN_EMAIL || "").toLowerCase().trim();
    if (!email) {
      console.warn("makeAdmin: ADMIN_EMAIL not set — skip");
      return;
    }

    const user = await User.findOneAndUpdate(
      { email },
      { role: "admin" },
      { new: true }
    );

    if (!user) {
      console.warn(
        "makeAdmin: no User with email",
        email,
        "— sign up once, then restart server"
      );
      return;
    }

    const membership = await AdminMembership.findOneAndUpdate(
      { userId: user._id },
      {
        $set: {
          clerkId: user.clerkId || "",
          email: (user.email || email).toLowerCase(),
          name: user.name || "",
          role: "super_admin",
          status: "active",
          deactivatedAt: null,
          deactivatedByUserId: null,
          lastActiveAt: new Date(),
        },
        $setOnInsert: {
          userId: user._id,
          activatedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    if (user.clerkId) {
      try {
        await clerkClient.users.updateUserMetadata(user.clerkId, {
          publicMetadata: {
            role: "admin",
            plazoreAdmin: true,
            plazoreAdminRole: "super_admin",
          },
        });
      } catch (metaErr: any) {
        console.warn(
          "makeAdmin: Clerk metadata update failed:",
          metaErr?.message || metaErr
        );
      }
    }

    console.log(
      "✅ Super Admin ready:",
      email,
      "| membership:",
      String(membership._id)
    );
  } catch (error: any) {
    console.error("Admin promotion failed:", error?.message || error);
  }
};

export default makeAdmin;