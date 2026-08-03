import { Request, Response } from "express";
import Product from "../models/Products.js";
import User from "../models/User.js";
import ProductAI from "../models/ProductAI.js";
import { trackProductPerformance } from "../utils/performance.js";
import cloudinary from "../config/cloudinary.js";
import { enqueueProductAI } from "../services/jobs/generateProductAI.js";
import { generateProductFingerprint } from "../services/plazoreAI/index.js";

const getUser = (req: Request) => (req as any).user;

/** Public seller fields — includes shippingDefaults for Shipping Route */
const SELLER_PUBLIC_FIELDS =
  "name storeName storeLogo storeDescription isSellerVerified marketplaceRegion shippingDefaults";

/** Parse structured fulfillment location from form body (multipart or JSON) */
function parseFulfillmentLocation(body: any) {
  const countryCode = String(body.fulfillmentCountryCode || "").trim();
  const country = String(body.fulfillmentCountry || "").trim();
  const stateCode = String(body.fulfillmentStateCode || "").trim();
  const state = String(body.fulfillmentState || "").trim();
  const city = String(body.fulfillmentCity || "").trim();

  if (!countryCode || !country || !city) {
    return null;
  }

  const displayLabel = `${city}, ${country}`;

  return {
    countryCode,
    country,
    stateCode,
    state,
    city,
    displayLabel,
  };
}

// ======================================================
// PUBLIC - Get products (regional prioritization)
// ======================================================
export const getProducts = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 12));
    const buyerRegion = String(req.query.region || "NG").trim() || "NG";

    const baseQuery: any = { isActive: true };

    if (req.query.seller) baseQuery.seller = req.query.seller;
    if (req.query.category) {
      baseQuery.category = String(req.query.category).trim();
    }

    const localQuery = {
      ...baseQuery,
      $or: [
        { region: buyerRegion },
        { region: { $exists: false } },
        { region: null },
      ],
    };

    const otherQuery = {
      ...baseQuery,
      region: { $nin: [buyerRegion, null] },
    };

    const [localProducts, total, localCount] = await Promise.all([
      Product.find(localQuery)
        .populate("seller", SELLER_PUBLIC_FIELDS)
        .sort({ isFeatured: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Product.countDocuments(baseQuery),
      Product.countDocuments(localQuery),
    ]);

    let products = localProducts;
    const usedLocal = localProducts.length;

    if (usedLocal < limit) {
      const remaining = limit - usedLocal;
      const otherProducts = await Product.find(otherQuery)
        .populate("seller", SELLER_PUBLIC_FIELDS)
        .sort({ isFeatured: -1, createdAt: -1 })
        .limit(remaining)
        .lean();

      products = [...products, ...otherProducts];
    }

    res.json({
      success: true,
      data: products,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit) || 1,
        limit,
      },
      meta: {
        prioritizedRegion: buyerRegion,
        localCount,
        showingLocal: usedLocal,
      },
    });
  } catch (error: any) {
    console.error("getProducts error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch products",
    });
  }
};

// ======================================================
// PUBLIC - Get single product
// ======================================================
export const getProduct = async (req: Request, res: Response) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate("seller", SELLER_PUBLIC_FIELDS)
      .lean();

    if (!product || product.isActive === false) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    // Performance: product view (+1) — non-blocking
    const actor = getUser(req);
    trackProductPerformance({
      productId: String(product._id),
      action: "view",
      actorUserId: actor?._id?.toString?.() || null,
    }).catch(() => {});

    res.json({ success: true, data: product });
  } catch (error: any) {
    console.error("getProduct error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch product",
    });
  }
};

// ======================================================
// CREATE PRODUCT
// ======================================================
export const createProduct = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    if (!user?._id) {
      return res.status(401).json({
        success: false,
        message: "Not authorized",
      });
    }

    let images: string[] = [];

    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      try {
        const uploadPromises = (req.files as Express.Multer.File[]).map(
          (file) =>
            new Promise<string>((resolve, reject) => {
              const uploadStream = cloudinary.uploader.upload_stream(
                { folder: "plazore/products" },
                (error, result) => {
                  if (error) reject(error);
                  else if (!result?.secure_url) {
                    reject(new Error("Cloudinary returned no URL"));
                  } else {
                    resolve(result.secure_url);
                  }
                }
              );
              uploadStream.end(file.buffer);
            })
        );
        images = await Promise.all(uploadPromises);
      } catch (uploadErr: any) {
        console.error("Cloudinary upload error:", uploadErr);
        return res.status(502).json({
          success: false,
          message:
            uploadErr?.message?.includes("EAI_AGAIN") ||
            uploadErr?.code === "EAI_AGAIN"
              ? "Image upload failed (network). Check internet and try again."
              : "Image upload failed. Please try again.",
        });
      }
    }

    if (images.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please upload at least one image",
      });
    }

    const {
      name,
      description,
      price,
      stock,
      category,
      subCategory,
      brand,
      shippingMethod,
      courierCompany,
      deliveryFee,
    } = req.body;

    if (!name?.trim() || !description?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Name and description are required",
      });
    }

    if (!category?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Category is required",
      });
    }

    const numericPrice = Number(price);
    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      return res.status(400).json({
        success: false,
        message: "A valid price (number ≥ 0) is required",
      });
    }

    const numericStock = Number(stock);
    const safeStock =
      Number.isFinite(numericStock) && numericStock >= 0 ? numericStock : 0;

    const method = shippingMethod === "self" ? "self" : "courier";
    const fee = Number(deliveryFee);
    const safeFee = Number.isFinite(fee) && fee >= 0 ? fee : 0;

    if (method === "courier" && !(courierCompany || "").trim()) {
      return res.status(400).json({
        success: false,
        message: "Courier company is required for courier delivery",
      });
    }

    const fulfillmentLocation = parseFulfillmentLocation(req.body);
    if (!fulfillmentLocation) {
      return res.status(400).json({
        success: false,
        message:
          "Fulfillment location is required (country and city — where this product ships from)",
      });
    }

    const seller = await User.findById(user._id)
      .select("marketplaceRegion")
      .lean();
    const region = seller?.marketplaceRegion || "NG";

    const product = await Product.create({
      name: String(name).trim(),
      description: String(description).trim(),
      price: numericPrice,
      stock: safeStock,
      category: String(category).trim(),
      subCategory: String(subCategory || "").trim(),
      brand: String(brand || "").trim(),
      images,
      seller: user._id,
      region,
      isFeatured: false,
      isActive: true,
      shipping: {
        method,
        courierCompany:
          method === "courier" ? String(courierCompany || "").trim() : "",
        deliveryFee: safeFee,
      },
      fulfillmentLocation,
    });

    // ── Plazore AI: enqueue generation (non-blocking) ──
    enqueueProductAI(String(product._id));

    res.status(201).json({ success: true, data: product });
  } catch (error: any) {
    console.error("createProduct error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create product",
    });
  }
};

// ======================================================
// UPDATE PRODUCT
// ======================================================
export const updateProduct = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    if (!user?._id) {
      return res.status(401).json({
        success: false,
        message: "Not authorized",
      });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    if (
      product.seller.toString() !== user._id.toString() &&
      user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this product",
      });
    }

    let images: string[] = [];

    if (req.body.existingImages) {
      images = Array.isArray(req.body.existingImages)
        ? [...req.body.existingImages]
        : [req.body.existingImages];
    }

    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      try {
        const uploadPromises = (req.files as Express.Multer.File[]).map(
          (file) =>
            new Promise<string>((resolve, reject) => {
              const uploadStream = cloudinary.uploader.upload_stream(
                { folder: "plazore/products" },
                (error, result) => {
                  if (error) reject(error);
                  else if (!result?.secure_url) {
                    reject(new Error("Cloudinary returned no URL"));
                  } else {
                    resolve(result.secure_url);
                  }
                }
              );
              uploadStream.end(file.buffer);
            })
        );
        const newImages = await Promise.all(uploadPromises);
        images = [...images, ...newImages];
      } catch (uploadErr: any) {
        console.error("Cloudinary upload error:", uploadErr);
        return res.status(502).json({
          success: false,
          message: "Image upload failed. Please try again.",
        });
      }
    }

    const updates: any = {};

    if (req.body.name !== undefined) {
      updates.name = String(req.body.name).trim();
    }
    if (req.body.description !== undefined) {
      updates.description = String(req.body.description).trim();
    }

    if (req.body.price !== undefined) {
      const p = Number(req.body.price);
      if (!Number.isFinite(p) || p < 0) {
        return res.status(400).json({
          success: false,
          message: "A valid price (number ≥ 0) is required",
        });
      }
      updates.price = p;
    }

    if (req.body.stock !== undefined) {
      const s = Number(req.body.stock);
      if (!Number.isFinite(s) || s < 0) {
        return res.status(400).json({
          success: false,
          message: "A valid stock (number ≥ 0) is required",
        });
      }
      updates.stock = s;
    }

    if (req.body.category !== undefined) {
      updates.category = String(req.body.category).trim();
    }
    if (req.body.subCategory !== undefined) {
      updates.subCategory = String(req.body.subCategory).trim();
    }
    if (req.body.brand !== undefined) {
      updates.brand = String(req.body.brand).trim();
    }

    if (
      req.body.shippingMethod !== undefined ||
      req.body.courierCompany !== undefined ||
      req.body.deliveryFee !== undefined
    ) {
      const method =
        req.body.shippingMethod === "self"
          ? "self"
          : req.body.shippingMethod === "courier"
            ? "courier"
            : product.shipping?.method || "courier";

      const fee =
        req.body.deliveryFee !== undefined
          ? Number(req.body.deliveryFee)
          : product.shipping?.deliveryFee || 0;

      updates.shipping = {
        method,
        courierCompany:
          method === "courier"
            ? String(
                req.body.courierCompany ??
                  product.shipping?.courierCompany ??
                  ""
              ).trim()
            : "",
        deliveryFee: Number.isFinite(fee) && fee >= 0 ? fee : 0,
      };
    }

    if (
      req.body.fulfillmentCountryCode !== undefined ||
      req.body.fulfillmentCountry !== undefined ||
      req.body.fulfillmentCity !== undefined
    ) {
      const fulfillmentLocation = parseFulfillmentLocation(req.body);
      if (!fulfillmentLocation) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid fulfillment location — country and city are required",
        });
      }
      updates.fulfillmentLocation = fulfillmentLocation;
    }

    if (images.length > 0) {
      updates.images = images;
    }

    const updated = await Product.findByIdAndUpdate(req.params.id, updates, {
      returnDocument: "after",
      runValidators: true,
    });

    // ── Plazore AI: only regenerate if meaningful fields changed ──
    if (updated) {
      const newFingerprint = generateProductFingerprint(updated);
      const existingAI = await ProductAI.findOne({ productId: updated._id });

      if (!existingAI || existingAI.fingerprint !== newFingerprint) {
        enqueueProductAI(String(updated._id));
      }
    }

    res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("updateProduct error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update product",
    });
  }
};

// ======================================================
// DELETE PRODUCT
// ======================================================
export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    if (!user?._id) {
      return res.status(401).json({
        success: false,
        message: "Not authorized",
      });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    if (
      product.seller.toString() !== user._id.toString() &&
      user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this product",
      });
    }

    if (product.images?.length > 0) {
      await Promise.all(
        product.images.map(async (imageUrl: string) => {
          try {
            const publicId = imageUrl
              .split("/upload/")[1]
              ?.split("/")
              .slice(1)
              .join("/")
              .replace(/\.[^/.]+$/, "");

            if (publicId) {
              await cloudinary.uploader.destroy(publicId);
            }
          } catch (err) {
            console.error("Failed to delete image from Cloudinary:", err);
          }
        })
      );
    }

    // Also remove the associated Plazore AI document
    await ProductAI.deleteOne({ productId: product._id });

    await Product.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: "Product deleted successfully" });
  } catch (error: any) {
    console.error("deleteProduct error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to delete product",
    });
  }
};