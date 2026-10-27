import { Request, Response } from "express";
import Product from "../models/Products.js";
import User from "../models/User.js";

function escapeRegex(q: string) {
  return q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function asMapSpecs(raw: any): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  if (raw instanceof Map) {
    raw.forEach((v: any, k: any) => {
      const key = String(k || "").trim();
      const val = String(v ?? "").trim();
      if (key && val) out[key] = val;
    });
    return out;
  }
  Object.entries(raw).forEach(([k, v]) => {
    const key = String(k || "").trim();
    const val = String(v ?? "").trim();
    if (key && val) out[key] = val;
  });
  return out;
}

/**
 * GET /api/search/suggest?q=iphone&region=NG
 * Rich typed suggestions for Browse / mobile search.
 */
export const searchSuggest = async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || "").trim();
    const region = String(req.query.region || "").trim().toUpperCase();

    if (q.length < 1) {
      return res.json({
        success: true,
        data: {
          items: [],
          products: [],
          stores: [],
          brands: [],
          categories: [],
          specs: [],
          locations: [],
        },
      });
    }

    const cleanQ = escapeRegex(q);
    const regex = new RegExp(cleanQ, "i");
    const ql = q.toLowerCase();

    const baseFilter: any = { isActive: true };
    if (region) baseFilter.region = region;

    // ── Products ──────────────────────────────────────────────
    const products = await Product.find({
      ...baseFilter,
      $or: [
        { name: regex },
        { brand: regex },
        { category: regex },
        { subCategory: regex },
        { description: regex },
      ],
    })
      .select(
        "name brand category subCategory images price region seller specifications fulfillmentLocation",
      )
      .populate("seller", "storeName name storeLogo")
      .limit(8)
      .lean();

    // ── Distinct categories / brands ──────────────────────────
    const [matchingCategories, matchingBrands] = await Promise.all([
      Product.distinct("category", {
        ...baseFilter,
        $or: [{ category: regex }, { subCategory: regex }, { name: regex }],
      }),
      Product.distinct("brand", {
        ...baseFilter,
        brand: { $exists: true, $ne: "" },
        $or: [{ brand: regex }, { name: regex }],
      }),
    ]);

    const categories = (matchingCategories || [])
      .filter((c: any) => c && String(c).trim())
      .map((c: any) => String(c).trim())
      .filter((c) => c.toLowerCase().includes(ql) || true)
      .slice(0, 6);

    const brands = (matchingBrands || [])
      .filter((b: any) => b && String(b).trim())
      .map((b: any) => String(b).trim())
      .filter((b) => b.toLowerCase().includes(ql))
      .slice(0, 6);

    // ── Stores (sellers) ──────────────────────────────────────
    const storeDocs = await User.find({
      role: "seller",
      $or: [
        { storeName: regex },
        { name: regex },
      ],
    })
      .select("storeName name storeLogo")
      .limit(6)
      .lean();

    const stores = storeDocs.map((s: any) => ({
      _id: String(s._id),
      storeName: s.storeName || s.name || "Store",
      storeLogo: s.storeLogo || "",
    }));

    // ── Specs from a wider product slice ──────────────────────
    const specPool = await Product.find({
      ...baseFilter,
      $or: [
        { name: regex },
        { brand: regex },
        { category: regex },
        { subCategory: regex },
      ],
    })
      .select("specifications")
      .limit(80)
      .lean();

    const specHits: { key: string; value: string }[] = [];
    const specSeen = new Set<string>();
    for (const p of specPool as any[]) {
      const specs = asMapSpecs(p.specifications);
      for (const [key, value] of Object.entries(specs)) {
        const blob = `${key} ${value}`.toLowerCase();
        if (
          key.toLowerCase().includes(ql) ||
          value.toLowerCase().includes(ql) ||
          blob.includes(ql)
        ) {
          const id = `${key}::${value}`.toLowerCase();
          if (specSeen.has(id)) continue;
          specSeen.add(id);
          specHits.push({ key, value });
        }
      }
    }
    const specs = specHits.slice(0, 8);

    // ── Locations from fulfillment ────────────────────────────
    const locPool = await Product.find({
      ...baseFilter,
      "fulfillmentLocation.city": { $exists: true },
    })
      .select("region fulfillmentLocation")
      .limit(120)
      .lean();

    const locSeen = new Set<string>();
    const locations: {
      kind: "city" | "state" | "region";
      name: string;
    }[] = [];

    for (const p of locPool as any[]) {
      const fl = p.fulfillmentLocation || {};
      const candidates: { kind: "city" | "state" | "region"; name: string }[] = [
        { kind: "city", name: String(fl.city || "").trim() },
        { kind: "state", name: String(fl.state || "").trim() },
        {
          kind: "region",
          name: String(p.region || fl.country || "").trim(),
        },
      ];
      for (const c of candidates) {
        if (!c.name) continue;
        if (!c.name.toLowerCase().includes(ql) && ql.length > 1) continue;
        const id = `${c.kind}:${c.name}`.toLowerCase();
        if (locSeen.has(id)) continue;
        locSeen.add(id);
        locations.push(c);
      }
    }
    const locationsOut = locations.slice(0, 8);

    // ── Flat typed items (for UI ranking) ─────────────────────
    const items: any[] = [];

    for (const p of products as any[]) {
      items.push({
        kind: "product",
        id: String(p._id),
        label: p.name,
        sub: p.brand || p.category || undefined,
        value: p.name,
        meta: String(p._id),
        image: p.images?.[0] || undefined,
      });
    }
    for (const s of stores) {
      items.push({
        kind: "store",
        id: s._id,
        label: s.storeName,
        sub: "Storefront",
        value: s.storeName,
        meta: s._id,
        image: s.storeLogo || undefined,
      });
    }
    for (const b of brands) {
      items.push({
        kind: "brand",
        id: `brand-${b}`,
        label: b,
        sub: "Brand",
        value: b,
      });
    }
    for (const c of categories) {
      items.push({
        kind: "category",
        id: `cat-${c}`,
        label: c,
        sub: "Category",
        value: c,
      });
    }
    for (const s of specs) {
      items.push({
        kind: "spec",
        id: `spec-${s.key}-${s.value}`,
        label: s.value,
        sub: s.key,
        value: `${s.key}: ${s.value}`,
        meta: JSON.stringify({ key: s.key, value: s.value }),
      });
    }
    for (const l of locationsOut) {
      items.push({
        kind: "location",
        id: `loc-${l.kind}-${l.name}`,
        label: l.name,
        sub: l.kind,
        value: l.name,
        meta: l.kind,
      });
    }

    return res.json({
      success: true,
      data: {
        items: items.slice(0, 16),
        products,
        stores,
        brands,
        categories,
        specs,
        locations: locationsOut,
      },
    });
  } catch (error: any) {
    console.error("searchSuggest error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Search suggest failed",
    });
  }
};