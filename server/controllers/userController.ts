import { Request, Response } from "express";
import User from "../models/User.js";

const ALLOWED_REGIONS = [
  "NG", // Nigeria
  "GH", // Ghana
  "BJ", // Benin
  "CM", // Cameroon
  "KE", // Kenya
  "ZA", // South Africa
  "EG", // Egypt
  "US", // United States
  "CA", // Canada
  "GB", // United Kingdom
  "DE", // Germany
  "FR", // France
  "AU", // Australia
];

// Optional: accept legacy alias
const REGION_ALIASES: Record<string, string> = {
  EU: "FR",
  EUROPE: "FR",
  UK: "GB",
  USA: "US",
};

export const updateMe = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { phone, name, marketplaceRegion } = req.body;

    const updates: any = {};

    if (phone !== undefined) {
      const cleaned = String(phone).trim();
      if (cleaned.length > 0 && cleaned.length < 7) {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid phone number",
        });
      }
      updates.phone = cleaned;
    }

    if (name !== undefined && String(name).trim()) {
      updates.name = String(name).trim();
    }

    if (marketplaceRegion !== undefined) {
  let code = String(marketplaceRegion).trim().toUpperCase();
  code = REGION_ALIASES[code] || code;

  if (!ALLOWED_REGIONS.includes(code)) {
    return res.status(400).json({
      success: false,
      message: "Invalid marketplace region",
    });
  }
  updates.marketplaceRegion = code;
}

    const updated = await User.findByIdAndUpdate(user._id, updates, {
      new: true,
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMe = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const full = await User.findById(user._id);
    res.json({ success: true, data: full });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};