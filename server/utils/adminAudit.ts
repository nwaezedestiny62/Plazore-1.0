import type { Request } from "express";
import AdminAuditLog from "../models/AdminAuditLog.js";

export async function writeAdminAudit(opts: {
  actorUserId: string;
  actorEmail?: string;
  action: string;
  targetType: "invitation" | "membership" | "user";
  targetId?: string;
  metadata?: Record<string, unknown>;
  req?: Request;
}) {
  try {
    await AdminAuditLog.create({
      actorUserId: opts.actorUserId,
      actorEmail: opts.actorEmail || "",
      action: opts.action,
      targetType: opts.targetType,
      targetId: opts.targetId || "",
      metadata: opts.metadata || {},
      ip:
        (opts.req?.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
        opts.req?.socket?.remoteAddress ||
        "",
      userAgent: opts.req?.headers["user-agent"] || "",
    });
  } catch (e) {
    console.error("Admin audit log failed:", e);
  }
}