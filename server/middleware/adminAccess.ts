import { NextFunction, Request, Response } from "express";
import AdminMembership, {
  type AdminPermission,
  type AdminRole,
} from "../models/AdminMembership.js";
import { hasPermission } from "../utils/adminPermissions.js";

export type AdminContext = {
  membershipId: string;
  role: AdminRole;
  email: string;
  permissions: AdminPermission[];
};

/**
 * After `protect`. Loads active AdminMembership OR legacy User.role === "admin".
 * Attaches req.adminContext.
 */
export const requireAdminAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = (req as any).user;
    if (!user?._id) {
      return res.status(401).json({
        success: false,
        message: "Not authorized. Please sign in.",
      });
    }

    let membership = await AdminMembership.findOne({
      userId: user._id,
      status: "active",
    });

    // Legacy bridge: User.role === admin without membership row
    if (!membership && user.role === "admin") {
      membership = await AdminMembership.findOneAndUpdate(
        { userId: user._id },
        {
          $setOnInsert: {
            userId: user._id,
            clerkId: user.clerkId || "",
            email: (user.email || "").toLowerCase(),
            name: user.name || "",
            role: "super_admin",
            status: "active",
            activatedAt: new Date(),
          },
        },
        { upsert: true, new: true }
      );
    }

    if (!membership || membership.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Administrator access required",
      });
    }

    // Touch last activity (non-blocking)
    AdminMembership.updateOne(
      { _id: membership._id },
      { $set: { lastActiveAt: new Date() } }
    ).catch(() => {});

    const role = membership.role as AdminRole;
    const extra = (membership.extraPermissions || []) as string[];
    const perms = [
      ...new Set(
        Object.values(
          // flatten via hasPermission helper usage
          (await import("../utils/adminPermissions.js")).permissionsForRole(
            role,
            extra
          )
        )
      ),
    ] as unknown as AdminPermission[];

    // Simpler: use permissionsForRole properly
    const { permissionsForRole } = await import("../utils/adminPermissions.js");
    const set = permissionsForRole(role, extra);

    (req as any).adminMembership = membership;
    (req as any).adminContext = {
      membershipId: String(membership._id),
      role,
      email: membership.email,
      permissions: [...set],
    } satisfies AdminContext;

    next();
  } catch (e: any) {
    console.error("requireAdminAccess:", e?.message || e);
    return res.status(500).json({
      success: false,
      message: "Admin authorization failed",
    });
  }
};

export const requireAdminPermission = (...needed: AdminPermission[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const ctx = (req as any).adminContext as AdminContext | undefined;
    if (!ctx) {
      return res.status(403).json({
        success: false,
        message: "Administrator access required",
      });
    }
    const ok = needed.every((p) =>
      hasPermission(ctx.role, [], p) || ctx.permissions.includes(p)
    );
    // Re-check with extras from membership
    const membership = (req as any).adminMembership;
    const allOk = needed.every((p) =>
      hasPermission(ctx.role, membership?.extraPermissions || [], p)
    );
    if (!allOk && !ok) {
      return res.status(403).json({
        success: false,
        message: "Insufficient administrator permissions",
      });
    }
    next();
  };
};