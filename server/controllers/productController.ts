import { Request, Response } from "express";
import Product from "../models/Products.js";
import User from "../models/User.js";
import ShowroomEvent from "../models/ShowroomEvent.js";
import ProductAI from "../models/ProductAI.js";
import ProductPerformance from "../models/ProductPerformance.js";
import { trackProductPerformance } from "../utils/performance.js";
import cloudinary from "../config/cloudinary.js";
import { enqueueProductAI } from "../services/jobs/generateProductAI.js";
import { generateProductFingerprint } from "../services/plazoreAI/index.js";
import { generateShowroom, rankProductsForSearch } from "../services/showroomRanker.js";

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

/** Client sends specifications as JSON string or object */
function parseSpecifications(body: any): Record<string, string> {
  let raw = body?.specifications;
  if (!raw) return {};

  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return {};
    }
  }

  if (typeof raw !== "object" || Array.isArray(raw) || raw === null) {
    return {};
  }

  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const key = String(k).trim();
    const val = String(v ?? "").trim();
    if (key && val) out[key] = val;
  }
  return out;
}

/** Support both upload.array (legacy) and upload.fields */
function getImageFiles(req: Request): Express.Multer.File[] {
  const f = req.files as
    | { [fieldname: string]: Express.Multer.File[] }
    | Express.Multer.File[]
    | undefined;

  if (!f) return [];
  if (Array.isArray(f)) return f;
  return f.images || [];
}

function getDocumentFiles(req: Request): Express.Multer.File[] {
  const f = req.files as
    | { [fieldname: string]: Express.Multer.File[] }
    | undefined;

  if (!f || Array.isArray(f as any)) return [];
  return f.documents || [];
}

function uploadToCloudinary(
  buffer: Buffer,
  folder: string,
  resourceType: "image" | "auto" = "image"
): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (error, result) => {
        if (error) reject(error);
        else if (!result?.secure_url) {
          reject(new Error("Cloudinary returned no URL"));
        } else {
          resolve(result.secure_url);
        }
      }
    );
    stream.end(buffer);
  });
}

/** Upload verification docs — store only name, type, secureUrl */
async function uploadVerificationDocs(
  files: Express.Multer.File[],
  body: any
): Promise<{ documentName: string; documentType: string; secureUrl: string }[]> {
  if (!files || files.length === 0) return [];

  const types = Array.isArray(body.documentTypes)
    ? body.documentTypes
    : body.documentTypes
      ? [body.documentTypes]
      : [];

  const names = Array.isArray(body.documentNames)
    ? body.documentNames
    : body.documentNames
      ? [body.documentNames]
      : [];

  const results = await Promise.all(
    files.map(async (file, i) => {
      const secureUrl = await uploadToCloudinary(
        file.buffer,
        "plazore/documents",
        "auto"
      );
      return {
        documentName: String(
          names[i] || file.originalname || `Document ${i + 1}`
        ).trim(),
        documentType: String(types[i] || "other").trim(),
        secureUrl,
      };
    })
  );

  return results;
}

function parseExistingDocuments(body: any, fallback: any[] = []): any[] {
  if (body.existingDocuments === undefined) return fallback;

  try {
    const raw =
      typeof body.existingDocuments === "string"
        ? JSON.parse(body.existingDocuments)
        : body.existingDocuments;

    if (!Array.isArray(raw)) return fallback;

    return raw
      .filter(
        (d) =>
          d &&
          typeof d.documentName === "string" &&
          typeof d.documentType === "string" &&
          typeof d.secureUrl === "string"
      )
      .map((d) => ({
        documentName: String(d.documentName).trim(),
        documentType: String(d.documentType).trim(),
        secureUrl: String(d.secureUrl).trim(),
      }));
  } catch {
    return fallback;
  }
}

// ======================================================
// PUBLIC - Get products (regional prioritization + sort)
// ======================================================
export const getProducts = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 12));
    const buyerRegion = String(req.query.region || "NG").trim() || "NG";
    const sortParam = String(req.query.sort || "").toLowerCase().trim();

    const baseQuery: any = { isActive: true };

    if (req.query.seller) {
      baseQuery.seller = req.query.seller;
    }
    if (req.query.category) {
      baseQuery.category = String(req.query.category).trim();
    }
    if (req.query.subCategory) {
      baseQuery.subCategory = String(req.query.subCategory).trim();
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

    // Default sort: featured first, then newest
    let mongoSort: any = { isFeatured: -1, createdAt: -1 };

    if (sortParam === "newest") {
      mongoSort = { createdAt: -1 };
    }
    // For "trending" we still fetch with a reasonable sort,
    // then re-rank in memory using ProductPerformance + wishlistCount

    const [localProducts, total, localCount] = await Promise.all([
      Product.find(localQuery)
        .populate("seller", SELLER_PUBLIC_FIELDS)
        .sort(mongoSort)
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
        .sort(mongoSort)
        .limit(remaining)
        .lean();

      products = [...products, ...otherProducts];
    }

    // ── Trending re-rank (real performance data + wishlist) ──
        // ── Rank by commerce / interest / search when requested ──
    const wantsRank =
      sortParam === "trending" ||
      sortParam === "relevant" ||
      Boolean(req.query.q || req.query.search);

    if (wantsRank && products.length > 0) {
      const user = getUser(req);
      products = await rankProductsForSearch({
        products,
        region: buyerRegion,
        userId: user?._id ? String(user._id) : null,
        sessionId: String(req.query.sessionId || "list"),
        searchQuery: String(req.query.q || req.query.search || ""),
      });
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
        sort: sortParam || "default",
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

    // Normalize Map → plain object for client
    if (product.specifications instanceof Map) {
      (product as any).specifications = Object.fromEntries(
        product.specifications as Map<string, string>
      );
    }

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

    // ── Images ──
    let images: string[] = [];
    const imageFiles = getImageFiles(req);

    if (imageFiles.length > 0) {
      try {
        images = await Promise.all(
          imageFiles.map((file) =>
            uploadToCloudinary(file.buffer, "plazore/products", "image")
          )
        );
      } catch (uploadErr: any) {
        console.error("Cloudinary image upload error:", uploadErr);
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

    // ── Verification documents (optional) ──
    let verificationDocuments: {
      documentName: string;
      documentType: string;
      secureUrl: string;
    }[] = [];

    try {
      verificationDocuments = await uploadVerificationDocs(
        getDocumentFiles(req),
        req.body
      );
    } catch (docErr: any) {
      console.error("Document upload error:", docErr);
      return res.status(502).json({
        success: false,
        message: "Document upload failed. Please try again.",
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

    const specifications = parseSpecifications(req.body);

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
      specifications,
      verificationDocuments,
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

    // ── Images: keep existing + optional new uploads ──
    let images: string[] = [];

    if (req.body.existingImages) {
      images = Array.isArray(req.body.existingImages)
        ? [...req.body.existingImages]
        : [req.body.existingImages];
    }

    const imageFiles = getImageFiles(req);
    if (imageFiles.length > 0) {
      try {
        const newImages = await Promise.all(
          imageFiles.map((file) =>
            uploadToCloudinary(file.buffer, "plazore/products", "image")
          )
        );
        images = [...images, ...newImages];
      } catch (uploadErr: any) {
        console.error("Cloudinary image upload error:", uploadErr);
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

    // ── Visibility (hide / show in mall) — MUST be before findByIdAndUpdate ──
    if (req.body.isActive !== undefined) {
      const raw = req.body.isActive;
      updates.isActive =
        raw === true ||
        raw === "true" ||
        raw === 1 ||
        raw === "1";
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

    // ── Specifications ──
    if (req.body.specifications !== undefined) {
      updates.specifications = parseSpecifications(req.body);
    }

    // ── Verification documents: keep selected existing + new uploads ──
    // Only touch docs when the client is actually editing them (multipart edit),
    // so a plain JSON hide/show { isActive } does not wipe documents.
    const isDocEdit =
      req.body.existingDocuments !== undefined ||
      req.body.specifications !== undefined ||
      getDocumentFiles(req).length > 0 ||
      req.body.name !== undefined;

    if (isDocEdit) {
      const existingDocs = parseExistingDocuments(
        req.body,
        product.verificationDocuments || []
      );

      try {
        const newDocs = await uploadVerificationDocs(
          getDocumentFiles(req),
          req.body
        );
        updates.verificationDocuments = [...existingDocs, ...newDocs];
      } catch (docErr: any) {
        console.error("Document upload error:", docErr);
        return res.status(502).json({
          success: false,
          message: "Document upload failed. Please try again.",
        });
      }
    }

    const updated = await Product.findByIdAndUpdate(req.params.id, updates, {
      returnDocument: "after",
      runValidators: true,
    });

    // ── Plazore AI: only regenerate if meaningful fields changed ──
    if (updated) {
      const onlyVisibility =
        Object.keys(updates).length === 1 && updates.isActive !== undefined;

      if (!onlyVisibility) {
        const newFingerprint = generateProductFingerprint(updated);
        const existingAI = await ProductAI.findOne({ productId: updated._id });

        if (!existingAI || existingAI.fingerprint !== newFingerprint) {
          enqueueProductAI(String(updated._id));
        }
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

    // Best-effort cleanup of verification docs on Cloudinary
    if (product.verificationDocuments?.length) {
      await Promise.all(
        product.verificationDocuments.map(async (doc: any) => {
          try {
            const publicId = doc.secureUrl
              ?.split("/upload/")[1]
              ?.split("/")
              .slice(1)
              .join("/")
              .replace(/\.[^/.]+$/, "");
            if (publicId) {
              await cloudinary.uploader.destroy(publicId, {
                resource_type: "raw",
              });
            }
          } catch {
            /* ignore */
          }
        })
      );
    }

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
// ======================================================
// PUBLIC - Showroom (ranked rooms)
// ======================================================
export const getShowroom = async (req: Request, res: Response) => {
  try {
    const region = String(req.query.region || "NG").trim() || "NG";
    const sessionId = String(req.query.sessionId || "").trim() || undefined;
    const searchQuery = String(req.query.q || req.query.search || "").trim();
    const forceRefresh =
      String(req.query.refresh || "") === "1" ||
      String(req.query.refresh || "") === "true";

    const user = getUser(req);
    const userId = user?._id ? String(user._id) : null;

    const result = await generateShowroom({
      region,
      sessionId,
      userId,
      searchQuery: searchQuery || undefined,
      forceRefresh,
    });

    // Flat list also returned for backward compatibility with AdaptiveShowroom
    const flat = [
      ...(result.rooms[1] || []),
      ...(result.rooms[2] || []),
      ...(result.rooms[3] || []),
      ...(result.rooms[4] || []),
    ];

    // Dedupe while preserving order (rooms may reuse when inventory is tiny)
    const seen = new Set<string>();
    const data: any[] = [];
    for (const p of flat) {
      const id = String(p._id);
      if (seen.has(id)) continue;
      seen.add(id);
      data.push(p);
    }

    res.json({
      success: true,
      sessionId: result.sessionId,
      region: result.region,
      cached: result.cached,
      rooms: {
        1: result.rooms[1],
        2: result.rooms[2],
        3: result.rooms[3],
        4: result.rooms[4],
      },
      data, // flat ranked list (AdaptiveShowroom can still use this)
      meta: (result as any).meta || {},
    });
  } catch (error: any) {
    console.error("getShowroom error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to build showroom",
    });
  }
};

// ======================================================
// PUBLIC - Track showroom behavioural events
// ======================================================
export const trackShowroomEvent = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const { sessionId, productId, type, room, position, region } = req.body || {};

    const allowed = [
      "impression",
      "open",
      "cart",
      "wishlist",
      "purchase",
      "skip",
    ] as const;

    type EventType = (typeof allowed)[number];

    const eventType = String(type || "") as EventType;

    if (!sessionId || !productId || !allowed.includes(eventType)) {
      return res.status(400).json({
        success: false,
        message:
          "sessionId, productId and type (impression|open|cart|wishlist|purchase|skip) required",
      });
    }

    const doc = await ShowroomEvent.create({
      sessionId: String(sessionId),
      user: user?._id || null,
      product: productId,
      type: eventType,
      room: room != null ? Number(room) : undefined,
      position: position != null ? Number(position) : 0,
      region: String(region || "NG").trim() || "NG",
    });

    // Also feed ProductPerformance for commerce signals
    if (eventType === "open") {
      trackProductPerformance({
        productId: String(productId),
        action: "view",
        actorUserId: user?._id?.toString?.() || null,
      }).catch(() => {});
    }
    if (eventType === "cart") {
      trackProductPerformance({
        productId: String(productId),
        action: "cart",
        actorUserId: user?._id?.toString?.() || null,
      }).catch(() => {});
    }
    if (eventType === "purchase") {
      trackProductPerformance({
        productId: String(productId),
        action: "purchase",
        actorUserId: user?._id?.toString?.() || null,
      }).catch(() => {});
    }

    res.json({
      success: true,
      data: { id: String((doc as any)._id) },
    });
  } catch (error: any) {
    console.error("trackShowroomEvent error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to track event",
    });
  }
};

export const setProductVisibility = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    if (!user?._id) {
      return res.status(401).json({ success: false, message: "Not authorized" });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
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

    if (req.body.isActive === undefined) {
      return res.status(400).json({
        success: false,
        message: "isActive is required",
      });
    }

    const raw = req.body.isActive;
    const next =
      raw === true || raw === "true" || raw === 1 || raw === "1";

    product.isActive = next;
    await product.save();

    return res.json({
      success: true,
      data: {
        _id: product._id,
        isActive: product.isActive,
      },
    });
  } catch (error: any) {
    console.error("setProductVisibility error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update visibility",
    });
  }
};