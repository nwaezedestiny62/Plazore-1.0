import { Request, Response } from "express";
import SavedStore from "../models/SavedStores.js";
import User from "../models/User.js";

const getUser = (req: Request) => (req as any).user;

// GET /api/saved-stores
export const getSavedStores = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);

    let doc = await SavedStore.findOne({ user: user._id }).populate(
      "stores",
      "storeName storeDescription storeLogo storeBanner isSellerVerified shippingDefaults"
    );

    if (!doc) {
      doc = await SavedStore.create({ user: user._id, stores: [] });
      doc = await SavedStore.findById(doc._id).populate(
        "stores",
        "storeName storeDescription storeLogo storeBanner isSellerVerified shippingDefaults"
      );
    }

    const stores = (doc!.stores || []).filter((s: any) => s != null);

    res.json({ success: true, data: stores });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/saved-stores/toggle
// body: { storeId }
export const toggleSavedStore = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const { storeId } = req.body;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: "storeId is required",
      });
    }

    // Seller cannot save their own store
    if (String(storeId) === String(user._id)) {
      return res.status(400).json({
        success: false,
        message: "You cannot save your own store",
      });
    }

    const seller = await User.findById(storeId).select(
      "storeName role isSellerSuspended"
    );
    if (!seller || seller.role !== "seller") {
      return res.status(404).json({
        success: false,
        message: "Store not found",
      });
    }

    let doc = await SavedStore.findOne({ user: user._id });
    if (!doc) {
      doc = await SavedStore.create({ user: user._id, stores: [] });
    }

    const idStr = storeId.toString();
    const exists = doc.stores.some((s) => s.toString() === idStr);

    if (exists) {
      await SavedStore.updateOne(
        { _id: doc._id },
        { $pull: { stores: storeId } }
      );
    } else {
      await SavedStore.updateOne(
        { _id: doc._id },
        { $addToSet: { stores: storeId } }
      );
    }

    const populated = await SavedStore.findById(doc._id).populate(
      "stores",
      "storeName storeDescription storeLogo storeBanner isSellerVerified shippingDefaults"
    );

    const stores = (populated!.stores || []).filter((s: any) => s != null);

    res.json({
      success: true,
      saved: !exists,
      changed: true,
      data: stores,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};