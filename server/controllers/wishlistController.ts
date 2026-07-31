import { Request, Response } from "express";
import Wishlist from "../models/Wishlist.js";
import Product from "../models/Products.js";

const getUser = (req: Request) => (req as any).user;

// GET /api/wishlist
export const getWishlist = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);

    let wishlist = await Wishlist.findOne({ user: user._id }).populate(
      "products"
    );

    if (!wishlist) {
      wishlist = await Wishlist.create({ user: user._id, products: [] });
      wishlist = await Wishlist.findById(wishlist._id).populate("products");
    }

    // Only active products
    const products = (wishlist!.products || []).filter(
      (p: any) => p && p.isActive !== false
    );

    res.json({ success: true, data: products });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/wishlist/toggle  body: { productId }
export const toggleWishlist = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "productId is required",
      });
    }

    const product = await Product.findById(productId);
    if (!product || product.isActive === false) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    let wishlist = await Wishlist.findOne({ user: user._id });

    if (!wishlist) {
      // First time → create and add
      wishlist = await Wishlist.create({
        user: user._id,
        products: [productId],
      });

      await Product.findByIdAndUpdate(productId, {
        $inc: { wishlistCount: 1 },
      });

      const populated = await Wishlist.findById(wishlist._id).populate("products");
      return res.json({
        success: true,
        added: true,
        data: (populated!.products || []).filter((p: any) => p && p.isActive !== false),
        wishlistCount: (await Product.findById(productId).select("wishlistCount"))?.wishlistCount ?? 1,
      });
    }

    const idStr = productId.toString();
    const exists = wishlist.products.some((p) => p.toString() === idStr);

    if (exists) {
      // REMOVE
      await Wishlist.updateOne(
        { _id: wishlist._id },
        { $pull: { products: productId } }
      );

      await Product.findByIdAndUpdate(productId, {
        $inc: { wishlistCount: -1 },
      });

      // Safety: never go below 0
      await Product.updateOne(
        { _id: productId, wishlistCount: { $lt: 0 } },
        { $set: { wishlistCount: 0 } }
      );
    } else {
      // ADD (guaranteed unique)
      await Wishlist.updateOne(
        { _id: wishlist._id },
        { $addToSet: { products: productId } }
      );

      await Product.findByIdAndUpdate(productId, {
        $inc: { wishlistCount: 1 },
      });
    }

    const populated = await Wishlist.findById(wishlist._id).populate("products");
    const products = (populated!.products || []).filter(
      (p: any) => p && p.isActive !== false
    );

    const updatedProduct = await Product.findById(productId).select("wishlistCount");

    res.json({
      success: true,
      added: !exists,
      data: products,
      wishlistCount: updatedProduct?.wishlistCount ?? 0,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/wishlist/:productId
export const removeFromWishlist = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const { productId } = req.params;

    const wishlist = await Wishlist.findOne({ user: user._id });
    if (!wishlist) {
      return res.json({ success: true, data: [] });
    }

    const idStr = productId.toString();
    const exists = wishlist.products.some((p) => p.toString() === idStr);

    if (exists) {
      wishlist.products = wishlist.products.filter(
        (p) => p.toString() !== idStr
      );
      await wishlist.save();

      // Decrement the count
      await Product.findByIdAndUpdate(productId, {
        $inc: { wishlistCount: -1 },
      });

      // Guard against negative counts
      await Product.updateOne(
        { _id: productId, wishlistCount: { $lt: 0 } },
        { $set: { wishlistCount: 0 } }
      );
    }

    const populated = await Wishlist.findById(wishlist._id).populate(
      "products"
    );
    const products = (populated!.products || []).filter(
      (p: any) => p && p.isActive !== false
    );

    const updatedProduct = await Product.findById(productId).select(
      "wishlistCount"
    );

    res.json({
      success: true,
      data: products,
      wishlistCount: updatedProduct?.wishlistCount ?? 0,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};