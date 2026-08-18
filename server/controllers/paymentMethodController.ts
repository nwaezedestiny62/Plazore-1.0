import { Request, Response } from "express";
import PaymentMethod from "../models/PaymentMethod.js";

// GET /api/payment-methods
export const getPaymentMethods = async (req: Request, res: Response) => {
  try {
    const cards = await PaymentMethod.find({ user: (req as any).user._id })
      .sort({ isDefault: -1, createdAt: -1 });

    res.json({ success: true, data: cards });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/payment-methods
export const addPaymentMethod = async (req: Request, res: Response) => {
  try {
    const { brand, name, last4, expMonth, expYear, isDefault } = req.body;
    const userId = (req as any).user._id;

    if (!name?.trim() || !last4 || !expMonth || !expYear) {
      return res.status(400).json({
        success: false,
        message: "Name, last4, expMonth and expYear are required",
      });
    }

    // Basic validation
    if (String(last4).length !== 4 || !/^\d{4}$/.test(String(last4))) {
      return res.status(400).json({
        success: false,
        message: "last4 must be exactly 4 digits",
      });
    }

    if (isDefault) {
      await PaymentMethod.updateMany(
        { user: userId },
        { $set: { isDefault: false } }
      );
    }

    // If this is the first card, force it as default
    const existingCount = await PaymentMethod.countDocuments({ user: userId });
    const shouldBeDefault = isDefault || existingCount === 0;

    const card = await PaymentMethod.create({
      user: userId,
      brand: brand || "Other",
      name: name.trim(),
      last4: String(last4),
      expMonth: String(expMonth).padStart(2, "0"),
      expYear: String(expYear),
      isDefault: shouldBeDefault,
    });

    res.status(201).json({ success: true, data: card });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/payment-methods/:id/default
export const setDefaultPaymentMethod = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user._id;

    const card = await PaymentMethod.findOne({
      _id: req.params.id,
      user: userId,
    });

    if (!card) {
      return res.status(404).json({
        success: false,
        message: "Card not found",
      });
    }

    await PaymentMethod.updateMany(
      { user: userId },
      { $set: { isDefault: false } }
    );

    card.isDefault = true;
    await card.save();

    res.json({ success: true, data: card });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/payment-methods/:id
export const deletePaymentMethod = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user._id;

    const card = await PaymentMethod.findOne({
      _id: req.params.id,
      user: userId,
    });

    if (!card) {
      return res.status(404).json({
        success: false,
        message: "Card not found",
      });
    }

    const wasDefault = card.isDefault;
    await card.deleteOne();

    // If we deleted the default, promote the newest remaining card
    if (wasDefault) {
      const next = await PaymentMethod.findOne({ user: userId }).sort({
        createdAt: -1,
      });
      if (next) {
        next.isDefault = true;
        await next.save();
      }
    }

    res.json({
      success: true,
      message: "Card removed successfully",
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};