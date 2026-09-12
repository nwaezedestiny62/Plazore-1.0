import { Request, Response } from "express";
import {
  convertAmount,
  formatCurrencyAmount,
  getPublicRateConfig,
  getRateHistory,
  listAdminRates,
  updateRate,
  isSupportedCurrency,
} from "../services/currencyService.js";

/** Public — web + mobile consume this (no secrets) */
export const getCurrencyConfig = async (_req: Request, res: Response) => {
  try {
    const data = await getPublicRateConfig();
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

/** Public convert helper (silent — clients should not show rate math) */
export const postConvert = async (req: Request, res: Response) => {
  try {
    const amount = Number(req.body?.amount);
    const from = String(req.body?.from || "").toUpperCase();
    const to = String(req.body?.to || "").toUpperCase();
    if (!Number.isFinite(amount) || amount < 0) {
      return res.status(400).json({ success: false, message: "Invalid amount" });
    }
    if (!isSupportedCurrency(from) || !isSupportedCurrency(to)) {
      return res.status(400).json({ success: false, message: "Unsupported currency" });
    }
    const result = await convertAmount(amount, from, to);
    if (!result) {
      return res.status(422).json({
        success: false,
        message: "Conversion unavailable — missing active rate",
        conversionUnavailable: true,
      });
    }
    res.json({
      success: true,
      data: {
        ...result,
        formatted: formatCurrencyAmount(result.amount, to),
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const getAdminCurrencyRates = async (_req: Request, res: Response) => {
  try {
    const data = await listAdminRates();
    res.json({
      success: true,
      data: {
        baseCurrency: "NGN",
        reviewThresholdPct: 8,
        rates: data,
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const getAdminCurrencyHistory = async (req: Request, res: Response) => {
  try {
    const code = String(req.params.code || "").toUpperCase();
    const history = await getRateHistory(code, 40);
    res.json({ success: true, data: history });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const patchAdminCurrencyRate = async (req: Request, res: Response) => {
  try {
    const code = String(req.params.code || "").toUpperCase();
    const admin = (req as any).user;
    const { rateToNgn, reason, sourceNote, confirmSignificant } = req.body || {};

    if (rateToNgn == null || rateToNgn === "") {
      return res.status(400).json({ success: false, message: "rateToNgn required" });
    }

    // Pre-check significant without saving
    const preview = await updateRate({
      currencyCode: code,
      newRateToNgn: rateToNgn,
      adminId: admin?._id?.toString(),
      adminName: admin?.name || admin?.email || "admin",
      reason: reason || "Admin update",
      sourceNote,
    }).catch((err) => {
      throw err;
    });

    // If significant and client did not confirm, still saved —
    // V1: always save but return warning. To require confirm, uncomment:
    // if (preview.significant && !confirmSignificant) { rollback... }

    res.json({
      success: true,
      data: preview.rate,
      significant: preview.significant,
      percentChange: preview.percentChange,
      warning: preview.warning,
      note: preview.note,
    });
  } catch (e: any) {
    res.status(400).json({ success: false, message: e.message });
  }
};