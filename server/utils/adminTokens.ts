import crypto from "crypto";

export function generateInviteToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString("base64url");
  const hash = hashInviteToken(raw);
  return { raw, hash };
}

export function hashInviteToken(raw: string): string {
  return crypto.createHash("sha256").update(raw, "utf8").digest("hex");
}

export function inviteExpiry(days = 7): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}