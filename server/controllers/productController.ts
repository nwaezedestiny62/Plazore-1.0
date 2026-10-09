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
import {
  generateShowroom,
  rankProductsForSearch,
} from "../services/showroomRanker.js";
import crypto from "crypto";
import { assertImageLimit } from "../utils/planEnforcement.js";

const getUser = (req: Request) => (req as any).user;

const SELLER_PUBLIC_FIELDS =
  "name storeName storeLogo storeDescription isSellerVerified marketplaceRegion shippingDefaults";

const MAX_OPTION_GROUPS = 5;
const MAX_VALUES_PER_OPTION = 30;
const MAX_VARIANTS = 200;

/** Parse JSON that may arrive as a string from multipart FormData */
function parseJsonField<T = any>(raw: unknown, fallback: T): T {
  if (raw === undefined || raw === null || raw === "") return fallback;
  if (typeof raw === "object") return raw as T;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function parseFulfillmentLocation(body: any) {
  if (body.fulfillmentLocation !== undefined) {
    const fl = parseJsonField<any>(body.fulfillmentLocation, null);
    if (fl && typeof fl === "object") {
      const countryCode = String(fl.countryCode || "").trim();
      const country = String(fl.country || "").trim();
      const stateCode = String(fl.stateCode || "").trim();
      const state = String(fl.state || "").trim();
      const city = String(fl.city || "").trim();
      if (countryCode && country && city) {
        return {
          countryCode,
          country,
          stateCode,
          state,
          city,
          displayLabel:
            String(fl.displayLabel || "").trim() || `${city}, ${country}`,
        };
      }
    }
  }

  const countryCode = String(body.fulfillmentCountryCode || "").trim();
  const country = String(body.fulfillmentCountry || "").trim();
  const stateCode = String(body.fulfillmentStateCode || "").trim();
  const state = String(body.fulfillmentState || "").trim();
  const city = String(body.fulfillmentCity || "").trim();

  if (!countryCode || !country || !city) return null;

  return {
    countryCode,
    country,
    stateCode,
    state,
    city,
    displayLabel: `${city}, ${country}`,
  };
}

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

/** Stable combination key from option map (sorted by option name). */
export function buildVariantKey(
  options: Record<string, string> | Map<string, string>
): string {
  const entries =
    options instanceof Map
      ? [...options.entries()]
      : Object.entries(options || {});
  return entries
    .map(([k, v]) => [
      String(k).trim().toLowerCase(),
      String(v).trim().toLowerCase(),
    ])
    .filter(([k, v]) => k && v)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `${k}=${v}`)
    .join("|");
}

function newVariantId(): string {
  return `var_${crypto.randomBytes(8).toString("hex")}`;
}

function newOptionId(): string {
  return `opt_${crypto.randomBytes(6).toString("hex")}`;
}

/**
 * Parse options + variants from body.
 * Returns { hasVariants, options, variants } or throws with a message.
 */
function parseOptionsAndVariants(body: any): {
  hasVariants: boolean;
  options: { id: string; name: string; values: string[] }[];
  variants: {
    variantId: string;
    key: string;
    options: Record<string, string>;
    stock: number;
    price: number | null;
    available: boolean;
  }[];
} {
  const rawOptions = parseJsonField<any[]>(body.options, []);
  const rawVariants = parseJsonField<any[]>(body.variants, []);

  const optionsIn =
    Array.isArray(rawOptions) && rawOptions.length > 0 ? rawOptions : [];
  const variantsIn =
    Array.isArray(rawVariants) && rawVariants.length > 0 ? rawVariants : [];

  if (optionsIn.length === 0 && variantsIn.length === 0) {
    return { hasVariants: false, options: [], variants: [] };
  }

  if (optionsIn.length > MAX_OPTION_GROUPS) {
    throw new Error(
      `A product may have at most ${MAX_OPTION_GROUPS} option groups`
    );
  }

  const options: { id: string; name: string; values: string[] }[] = [];
  const seenOptionNames = new Set<string>();

  for (const o of optionsIn) {
    if (!o || typeof o !== "object") continue;
    const name = String(o.name || "").trim();
    if (!name) continue;
    const nameKey = name.toLowerCase();
    if (seenOptionNames.has(nameKey)) continue;
    seenOptionNames.add(nameKey);

    let values = Array.isArray(o.values)
      ? o.values.map((v: any) => String(v ?? "").trim()).filter(Boolean)
      : [];
    values = [...new Set(values)];
    if (values.length > MAX_VALUES_PER_OPTION) {
      throw new Error(
        `Option "${name}" may have at most ${MAX_VALUES_PER_OPTION} values`
      );
    }
    if (values.length === 0) continue;

    options.push({
      id: String(o.id || "").trim() || newOptionId(),
      name,
      values,
    });
  }

  if (options.length === 0) {
    return { hasVariants: false, options: [], variants: [] };
  }

  if (variantsIn.length > MAX_VARIANTS) {
    throw new Error(`A product may have at most ${MAX_VARIANTS} variants`);
  }

  const variants: {
    variantId: string;
    key: string;
    options: Record<string, string>;
    stock: number;
    price: number | null;
    available: boolean;
  }[] = [];
  const seenKeys = new Set<string>();

  for (const v of variantsIn) {
    if (!v || typeof v !== "object") continue;

    let optMap: Record<string, string> = {};
    if (v.options && typeof v.options === "object" && !Array.isArray(v.options)) {
      for (const [k, val] of Object.entries(v.options)) {
        const nk = String(k).trim();
        const nv = String(val ?? "").trim();
        if (nk && nv) optMap[nk] = nv;
      }
    }

    // Validate option names/values against defined options
    for (const opt of options) {
      const chosen = optMap[opt.name];
      if (!chosen || !opt.values.includes(chosen)) {
        // allow missing if seller disabled incomplete combos — skip invalid
        optMap = {};
        break;
      }
    }
    if (Object.keys(optMap).length !== options.length) continue;

    const key = buildVariantKey(optMap);
    if (!key || seenKeys.has(key)) continue;
    seenKeys.add(key);

    const stockNum = Number(v.stock);
    const stock =
      Number.isFinite(stockNum) && stockNum >= 0 ? Math.floor(stockNum) : 0;

    let price: number | null = null;
    if (v.price !== undefined && v.price !== null && v.price !== "") {
      const p = Number(v.price);
      if (Number.isFinite(p) && p >= 0) price = p;
    }

    const available =
      v.available === false || v.available === "false" || v.available === 0
        ? false
        : true;

    variants.push({
      variantId: String(v.variantId || "").trim() || newVariantId(),
      key,
      options: optMap,
      stock,
      price,
      available,
    });
  }

  if (variants.length === 0) {
    // Options defined but no valid variants — treat as simple product
    return { hasVariants: false, options: [], variants: [] };
  }

  return { hasVariants: true, options, variants };
}

/** Keys that only affect inventory — must NOT trigger Plazore AI */
function isInventoryOnlyUpdate(updates: Record<string, any>): boolean {
  const keys = Object.keys(updates);
  if (keys.length === 0) return true;

  const inventoryKeys = new Set(["stock", "variants"]);
  // variants payload only counts as inventory-only if structure is unchanged
  // Caller should pass contentFingerprintChanged separately for structure.
  return keys.every((k) => inventoryKeys.has(k));
}

function serializeProductLean(product: any) {
  if (!product) return product;

  if (product.specifications instanceof Map) {
    product.specifications = Object.fromEntries(product.specifications);
  }

  if (Array.isArray(product.variants)) {
    product.variants = product.variants.map((v: any) => ({
      ...v,
      options:
        v.options instanceof Map
          ? Object.fromEntries(v.options)
          : v.options || {},
    }));
  }

  if (Array.isArray(product.verificationDocuments)) {
    product.verificationDocuments = product.verificationDocuments.map(
      (d: any) => ({
        documentName: d.documentName || d.name || "Document",
        documentType: d.documentType || d.type || "other",
        secureUrl: d.secureUrl || d.url || "",
      })
    );
  }

  return product;
}

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
  resourceType: "image" | "raw" | "auto" = "image"
): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        use_filename: true,
        unique_filename: true,
      },
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

function isImageMime(m?: string) {
  return !!m && m.startsWith("image/");
}

function fieldAt(body: any, base: string, i: number): string {
  if (Array.isArray(body[base])) return String(body[base][i] ?? "");
  if (body[base] && typeof body[base] === "object") {
    return String(body[base][i] ?? body[base][String(i)] ?? "");
  }
  const bracket = body[`${base}[${i}]`];
  if (bracket != null) return String(bracket);
  if (i === 0 && typeof body[base] === "string") return body[base];
  return "";
}

async function uploadVerificationDocs(
  files: Express.Multer.File[],
  body: any
): Promise<
  { documentName: string; documentType: string; secureUrl: string }[]
> {
  if (!files || files.length === 0) return [];

  const results = await Promise.all(
    files.map(async (file, i) => {
      const resourceType: "image" | "raw" = isImageMime(file.mimetype)
        ? "image"
        : "raw";

      const secureUrl = await uploadToCloudinary(
        file.buffer,
        "plazore/documents",
        resourceType
      );

      const nameFromBody = fieldAt(body, "documentNames", i).trim();
      const typeFromBody = fieldAt(body, "documentTypes", i).trim();

      return {
        documentName: nameFromBody || file.originalname || `Document ${i + 1}`,
        documentType: typeFromBody || "other",
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
          typeof d.secureUrl === "string" &&
          String(d.secureUrl).startsWith("http")
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

function parseExistingImageUrls(body: any): string[] {
  const raw =
    body.existingImages !== undefined
      ? body.existingImages
      : body.keepImages !== undefined
        ? body.keepImages
        : body.imagesToKeep;

  if (raw === undefined || raw === null || raw === "") return [];

  let list: unknown = raw;

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
      try {
        list = JSON.parse(trimmed);
      } catch {
        return trimmed.startsWith("http") ? [trimmed] : [];
      }
    } else if (trimmed.startsWith("http")) {
      return [trimmed];
    } else {
      return [];
    }
  }

  if (!Array.isArray(list)) return [];

  return list
    .map((u) => {
      if (typeof u === "string") return u.trim();
      if (u && typeof u === "object") {
        const o = u as any;
        return String(
          o.secure_url || o.secureUrl || o.url || o.uri || ""
        ).trim();
      }
      return "";
    })
    .filter((u) => u.startsWith("http"));
}

function dedupeUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

function normalizeFeeMode(
  value: any,
  fallback: string = "fixed"
): "free" | "fixed" | "on_delivery" {
  const raw = String(value ?? fallback).toLowerCase().trim();
  if (raw === "free" || raw === "on_delivery") return raw;
  return "fixed";
}

// ======================================================
// PUBLIC - Get products
// ======================================================
export const getProducts = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 12));
    const buyerRegion = String(req.query.region || "NG").trim() || "NG";
    const sortParam = String(req.query.sort || "").toLowerCase().trim();
    const q = String(req.query.q || req.query.search || "").trim();

    const minPrice = Number(req.query.minPrice);
    const maxPrice = Number(req.query.maxPrice);
    const inStockRaw = String(
      req.query.inStock ?? req.query.inStockOnly ?? ""
    ).toLowerCase();
    const inStockOnly = inStockRaw === "1" || inStockRaw === "true";

    const filters: any[] = [{ isActive: true }];

    if (req.query.seller) {
      filters.push({ seller: req.query.seller });
    }
    if (req.query.category) {
      filters.push({ category: String(req.query.category).trim() });
    }
    if (req.query.subCategory) {
      filters.push({ subCategory: String(req.query.subCategory).trim() });
    }

    if (q) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rx = new RegExp(escaped, "i");
      filters.push({
        $or: [
          { name: rx },
          { brand: rx },
          { category: rx },
          { subCategory: rx },
          { description: rx },
        ],
      });
    }

    if (Number.isFinite(minPrice) && minPrice > 0) {
      filters.push({ price: { $gte: minPrice } });
    }
    if (Number.isFinite(maxPrice) && maxPrice > 0) {
      filters.push({ price: { $lte: maxPrice } });
    }

    // In stock: simple stock OR any available variant with stock
    if (inStockOnly) {
      filters.push({
        $or: [
          { hasVariants: { $ne: true }, stock: { $gt: 0 } },
          {
            hasVariants: true,
            variants: {
              $elemMatch: { available: true, stock: { $gt: 0 } },
            },
          },
        ],
      });
    }

    const baseQuery = filters.length === 1 ? filters[0] : { $and: filters };

    const localQuery = {
      $and: [
        ...filters,
        {
          $or: [
            { region: buyerRegion },
            { region: { $exists: false } },
            { region: null },
          ],
        },
      ],
    };

    const otherQuery = {
      $and: [...filters, { region: { $nin: [buyerRegion, null] } }],
    };

    let mongoSort: any = { isFeatured: -1, createdAt: -1 };
    switch (sortParam) {
      case "newest":
        mongoSort = { createdAt: -1 };
        break;
      case "oldest":
        mongoSort = { createdAt: 1 };
        break;
      case "price_asc":
      case "price_low":
        mongoSort = { price: 1 };
        break;
      case "price_desc":
      case "price_high":
        mongoSort = { price: -1 };
        break;
      case "name":
      case "name_az":
        mongoSort = { name: 1 };
        break;
      case "name_za":
        mongoSort = { name: -1 };
        break;
      default:
        mongoSort = { isFeatured: -1, createdAt: -1 };
    }

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

    let products = localProducts as any[];
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

    products = products.map(serializeProductLean);

    if (sortParam === "trending" && products.length > 0) {
      const user = getUser(req);
      products = await rankProductsForSearch({
        products,
        region: buyerRegion,
        userId: user?._id ? String(user._id) : null,
        sessionId: String(req.query.sessionId || "list"),
        searchQuery: q,
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
        q: q || undefined,
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

    serializeProductLean(product);

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
    const imageFiles = getImageFiles(req);

    if (imageFiles.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please upload at least one image",
      });
    }

    // Plan image limit BEFORE Cloudinary — Free=6, Dominant=12, Business+/Global=20
    // Avoids uploading files that would be rejected by plan.
    try {
      await assertImageLimit(user._id.toString(), imageFiles.length);
    } catch (limitErr: any) {
      return res.status(limitErr.statusCode || 400).json({
        success: false,
        code: limitErr.code || "PLAN_IMAGE_LIMIT",
        message:
          limitErr.message ||
          "Too many images for your current plan. Upgrade to add more.",
      });
    }

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

    let shippingMethod = req.body.shippingMethod;
    let courierCompany = req.body.courierCompany || req.body.courier;
    let deliveryFee = req.body.deliveryFee;
    let feeMode = req.body.feeMode;
    let deliveryNote = req.body.deliveryNote;

    if (req.body.shipping !== undefined) {
      const ship = parseJsonField<any>(req.body.shipping, null);
      if (ship && typeof ship === "object") {
        shippingMethod = ship.method ?? shippingMethod;
        courierCompany =
          ship.courierCompany || ship.courier || courierCompany;
        deliveryFee =
          ship.deliveryFee !== undefined ? ship.deliveryFee : deliveryFee;
        feeMode = ship.feeMode ?? feeMode;
        deliveryNote = ship.deliveryNote ?? deliveryNote;
      }
    }

    const {
      name,
      description,
      price,
      stock,
      category,
      subCategory,
      brand,
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
    const normalizedFeeMode = normalizeFeeMode(feeMode, "fixed");

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

    let optionsPayload: ReturnType<typeof parseOptionsAndVariants>;
    try {
      optionsPayload = parseOptionsAndVariants(req.body);
    } catch (optErr: any) {
      return res.status(400).json({
        success: false,
        message: optErr.message || "Invalid product options",
      });
    }

    // When variants exist, product.stock is sum of available variant stocks (display helper)
    let finalStock = safeStock;
    if (optionsPayload.hasVariants) {
      finalStock = optionsPayload.variants
        .filter((v) => v.available)
        .reduce((s, v) => s + v.stock, 0);
    }

    const seller = await User.findById(user._id)
      .select("marketplaceRegion")
      .lean();
    const region =
      String(req.body.region || "").trim() ||
      seller?.marketplaceRegion ||
      "NG";

    const product = await Product.create({
      name: String(name).trim(),
      description: String(description).trim(),
      price: numericPrice,
      stock: finalStock,
      category: String(category).trim(),
      subCategory: String(subCategory || "").trim(),
      brand: String(brand || "").trim(),
      images,
      seller: user._id,
      region,
      isFeatured: false,
      isActive: true,
      shipping: {
        feeMode: normalizedFeeMode,
        method,
        courierCompany:
          method === "courier" ? String(courierCompany || "").trim() : "",
        deliveryFee: safeFee,
        deliveryNote: String(deliveryNote || "").trim(),
      },
      fulfillmentLocation,
      specifications,
      verificationDocuments,
      hasVariants: optionsPayload.hasVariants,
      options: optionsPayload.options,
      variants: optionsPayload.variants,
    });

    enqueueProductAI(String(product._id));

    res.status(201).json({
      success: true,
      data: serializeProductLean(product.toObject()),
    });
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

    const keptUrls = parseExistingImageUrls(req.body);
    const imageFiles = getImageFiles(req);

    // Early plan check: kept + new files (order may dedupe later, so this is upper bound)
    // Final exact check still runs after merge.
    const clientWillTouchImages =
      req.body.existingImages !== undefined ||
      req.body.keepImages !== undefined ||
      req.body.imagesToKeep !== undefined ||
      req.body.imageOrder !== undefined ||
      imageFiles.length > 0;

    if (clientWillTouchImages && imageFiles.length > 0) {
      const projected = keptUrls.length + imageFiles.length;
      try {
        await assertImageLimit(user._id.toString(), projected);
      } catch (limitErr: any) {
        return res.status(limitErr.statusCode || 400).json({
          success: false,
          code: limitErr.code || "PLAN_IMAGE_LIMIT",
          message:
            limitErr.message ||
            "Too many images for your current plan. Upgrade to add more.",
        });
      }
    }

    let uploadedUrls: string[] = [];
    if (imageFiles.length > 0) {
      try {
        uploadedUrls = await Promise.all(
          imageFiles.map((file) =>
            uploadToCloudinary(file.buffer, "plazore/products", "image")
          )
        );
      } catch (uploadErr: any) {
        console.error("Cloudinary image upload error:", uploadErr);
        return res.status(502).json({
          success: false,
          message: "Image upload failed. Please try again.",
        });
      }
    }

    const orderRaw = parseJsonField<any[]>(req.body.imageOrder, []);
    let finalImages: string[] = [];

    if (Array.isArray(orderRaw) && orderRaw.length > 0) {
      for (const step of orderRaw) {
        if (!step || typeof step !== "object") continue;
        if (step.kind === "existing" && typeof step.url === "string") {
          const u = step.url.trim();
          if (u.startsWith("http")) finalImages.push(u);
        } else if (step.kind === "new") {
          const idx = Number(step.index);
          if (Number.isFinite(idx) && uploadedUrls[idx]) {
            finalImages.push(uploadedUrls[idx]);
          }
        }
      }
      for (const u of uploadedUrls) {
        if (!finalImages.includes(u)) finalImages.push(u);
      }
    } else {
      finalImages = [...keptUrls, ...uploadedUrls];
    }

    finalImages = dedupeUrls(finalImages);

    const coverRaw = String(req.body.coverImage || "").trim();
    if (coverRaw.startsWith("http")) {
      finalImages = [
        coverRaw,
        ...finalImages.filter((u) => u !== coverRaw),
      ];
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
    if (req.body.region !== undefined) {
      updates.region = String(req.body.region).trim() || product.region;
    }

    if (req.body.isActive !== undefined) {
      const raw = req.body.isActive;
      updates.isActive =
        raw === true || raw === "true" || raw === 1 || raw === "1";
    }

    // Options / variants (structure or stock)
    let optionsStructureChanged = false;
    if (req.body.options !== undefined || req.body.variants !== undefined) {
      let optionsPayload: ReturnType<typeof parseOptionsAndVariants>;
      try {
        optionsPayload = parseOptionsAndVariants(req.body);
      } catch (optErr: any) {
        return res.status(400).json({
          success: false,
          message: optErr.message || "Invalid product options",
        });
      }

      const prevKey = JSON.stringify({
        options: (product as any).options || [],
        variants: ((product as any).variants || []).map((v: any) => ({
          key: v.key,
          options: v.options,
          price: v.price,
          available: v.available,
        })),
      });
      const nextKey = JSON.stringify({
        options: optionsPayload.options,
        variants: optionsPayload.variants.map((v) => ({
          key: v.key,
          options: v.options,
          price: v.price,
          available: v.available,
        })),
      });
      optionsStructureChanged = prevKey !== nextKey;

      updates.hasVariants = optionsPayload.hasVariants;
      updates.options = optionsPayload.options;
      updates.variants = optionsPayload.variants;

      if (optionsPayload.hasVariants) {
        updates.stock = optionsPayload.variants
          .filter((v) => v.available)
          .reduce((s, v) => s + v.stock, 0);
      }
    }

    // Shipping
    {
      let shipBody: any = null;
      if (req.body.shipping !== undefined) {
        shipBody = parseJsonField(req.body.shipping, null);
      }

      const hasFlatShip =
        req.body.shippingMethod !== undefined ||
        req.body.feeMode !== undefined ||
        req.body.courierCompany !== undefined ||
        req.body.courier !== undefined ||
        req.body.deliveryFee !== undefined ||
        req.body.deliveryNote !== undefined;

      if (shipBody && typeof shipBody === "object") {
        const method =
          shipBody.method === "self"
            ? "self"
            : shipBody.method === "courier"
              ? "courier"
              : product.shipping?.method || "courier";

        const feeMode = normalizeFeeMode(
          shipBody.feeMode ?? product.shipping?.feeMode,
          "fixed"
        );

        const fee = Number(
          shipBody.deliveryFee ?? product.shipping?.deliveryFee ?? 0
        );

        updates.shipping = {
          feeMode,
          method,
          courierCompany:
            method === "courier"
              ? String(
                  shipBody.courierCompany ||
                    shipBody.courier ||
                    product.shipping?.courierCompany ||
                    ""
                ).trim()
              : "",
          deliveryFee: Number.isFinite(fee) && fee >= 0 ? fee : 0,
          deliveryNote: String(
            shipBody.deliveryNote ?? product.shipping?.deliveryNote ?? ""
          ).trim(),
        };
      } else if (hasFlatShip) {
        const method =
          req.body.shippingMethod === "self"
            ? "self"
            : req.body.shippingMethod === "courier"
              ? "courier"
              : product.shipping?.method || "courier";

        const feeMode = normalizeFeeMode(
          req.body.feeMode ?? product.shipping?.feeMode,
          "fixed"
        );

        const fee =
          req.body.deliveryFee !== undefined
            ? Number(req.body.deliveryFee)
            : product.shipping?.deliveryFee || 0;

        updates.shipping = {
          feeMode,
          method,
          courierCompany:
            method === "courier"
              ? String(
                  req.body.courierCompany ??
                    req.body.courier ??
                    product.shipping?.courierCompany ??
                    ""
                ).trim()
              : "",
          deliveryFee: Number.isFinite(fee) && fee >= 0 ? fee : 0,
          deliveryNote: String(
            req.body.deliveryNote ?? product.shipping?.deliveryNote ?? ""
          ).trim(),
        };
      }
    }

    // Fulfillment
    {
      const hasFulfillmentTouch =
        req.body.fulfillmentLocation !== undefined ||
        req.body.fulfillmentCountryCode !== undefined ||
        req.body.fulfillmentCountry !== undefined ||
        req.body.fulfillmentCity !== undefined;

      if (hasFulfillmentTouch) {
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
    }

    const clientTouchedImages =
      req.body.existingImages !== undefined ||
      req.body.keepImages !== undefined ||
      req.body.imagesToKeep !== undefined ||
      req.body.imageOrder !== undefined ||
      imageFiles.length > 0;

    if (clientTouchedImages) {
      if (finalImages.length === 0) {
        return res.status(400).json({
          success: false,
          message: "At least one product image is required",
        });
      }
      try {
        await assertImageLimit(user._id.toString(), finalImages.length);
      } catch (limitErr: any) {
        return res.status(limitErr.statusCode || 400).json({
          success: false,
          code: limitErr.code || "PLAN_IMAGE_LIMIT",
          message:
            limitErr.message ||
            "Too many images for your current plan. Upgrade to add more.",
        });
      }
      updates.images = finalImages;
    }

    if (req.body.specifications !== undefined) {
      updates.specifications = parseSpecifications(req.body);
    }

    const isDocEdit =
      req.body.existingDocuments !== undefined ||
      getDocumentFiles(req).length > 0;

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

    if (updated) {
      const onlyVisibility =
        Object.keys(updates).length === 1 && updates.isActive !== undefined;

      // Inventory-only: stock and/or variants where structure did not change
      const onlyInventory =
        !onlyVisibility &&
        !optionsStructureChanged &&
        isInventoryOnlyUpdate(updates) &&
        updates.name === undefined &&
        updates.description === undefined &&
        updates.price === undefined &&
        updates.category === undefined &&
        updates.subCategory === undefined &&
        updates.brand === undefined &&
        updates.images === undefined &&
        updates.specifications === undefined &&
        updates.shipping === undefined &&
        updates.fulfillmentLocation === undefined &&
        updates.verificationDocuments === undefined;

      if (!onlyVisibility && !onlyInventory) {
        const newFingerprint = generateProductFingerprint(updated);
        const existingAI = await ProductAI.findOne({ productId: updated._id });

        if (!existingAI || existingAI.fingerprint !== newFingerprint) {
          enqueueProductAI(String(updated._id));
        }
      }
    }

    res.json({
      success: true,
      data: updated ? serializeProductLean(updated.toObject()) : updated,
    });
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
            if (publicId) await cloudinary.uploader.destroy(publicId);
          } catch (err) {
            console.error("Failed to delete image from Cloudinary:", err);
          }
        })
      );
    }

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
// PUBLIC - Showroom
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

    const flat = [
      ...(result.rooms[1] || []),
      ...(result.rooms[2] || []),
      ...(result.rooms[3] || []),
      ...(result.rooms[4] || []),
    ];

    const seen = new Set<string>();
    const data: any[] = [];
    for (const p of flat) {
      const id = String(p._id);
      if (seen.has(id)) continue;
      seen.add(id);
      data.push(serializeProductLean(p));
    }

    res.json({
      success: true,
      sessionId: result.sessionId,
      region: result.region,
      cached: result.cached,
      rooms: {
        1: (result.rooms[1] || []).map(serializeProductLean),
        2: (result.rooms[2] || []).map(serializeProductLean),
        3: (result.rooms[3] || []).map(serializeProductLean),
        4: (result.rooms[4] || []).map(serializeProductLean),
      },
      data,
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
// PUBLIC - Track showroom events
// ======================================================
export const trackShowroomEvent = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const { sessionId, productId, type, room, position, region } =
      req.body || {};

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
      return res
        .status(401)
        .json({ success: false, message: "Not authorized" });
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

    if (req.body.isActive === undefined) {
      return res.status(400).json({
        success: false,
        message: "isActive is required",
      });
    }

    const raw = req.body.isActive;
    product.isActive =
      raw === true || raw === "true" || raw === 1 || raw === "1";
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