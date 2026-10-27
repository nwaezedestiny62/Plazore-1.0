import { Request, Response } from "express";
import Product from "../models/Products.js";
import User from "../models/User.js";

function escapeRegex(q: string) {
  return q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function firstImage(images: any): string | undefined {
  if (!Array.isArray(images) || !images.length) return undefined;
  const u = String(images[0] || "").trim();
  return u || undefined;
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
 *
 * Returns typed items WITH images:
 *  - product  → product.images[0]
 *  - store    → storeLogo
 *  - brand    → first product image for that brand
 *  - category → (no image on server; client uses floor art)
 *  - spec / location
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

    // ── Products (with images) ───────────────────────────────
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
      .limit(10)
      .lean();

    // ── Brands + categories ──────────────────────────────────
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
      .map((c: any) => String(c || "").trim())
      .filter(Boolean)
      .slice(0, 6);

    const brands = (matchingBrands || [])
      .map((b: any) => String(b || "").trim())
      .filter((b) => b && b.toLowerCase().includes(ql))
      .slice(0, 6);

    // Brand → sample product image
    const brandImageMap = new Map<string, string>();
    if (brands.length) {
      const brandProducts = await Product.find({
        ...baseFilter,
        brand: { $in: brands },
        images: { $exists: true, $ne: [] },
      })
        .select("brand images")
        .limit(40)
        .lean();

      for (const p of brandProducts as any[]) {
        const b = String(p.brand || "").trim();
        const img = firstImage(p.images);
        if (b && img && !brandImageMap.has(b.toLowerCase())) {
          brandImageMap.set(b.toLowerCase(), img);
        }
      }
    }

    // ── Stores (with logos) ──────────────────────────────────
    const storeDocs = await User.find({
      role: "seller",
      $or: [{ storeName: regex }, { name: regex }],
    })
      .select("storeName name storeLogo")
      .limit(6)
      .lean();

    const stores = storeDocs.map((s: any) => ({
      _id: String(s._id),
      storeName: s.storeName || s.name || "Store",
      storeLogo: s.storeLogo ? String(s.storeLogo) : "",
    }));

    // ── Specs ────────────────────────────────────────────────
    const specPool = await Product.find({
      ...baseFilter,
      $or: [
        { name: regex },
        { brand: regex },
        { category: regex },
        { subCategory: regex },
      ],
    })
      .select("specifications images")
      .limit(80)
      .lean();

    const specHits: { key: string; value: string; image?: string }[] = [];
    const specSeen = new Set<string>();
    for (const p of specPool as any[]) {
      const specs = asMapSpecs(p.specifications);
      const img = firstImage(p.images);
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
          specHits.push({ key, value, image: img });
        }
      }
    }
    const specs = specHits.slice(0, 8);

    // ── Locations ────────────────────────────────────────────
    const locPool = await Product.find({
      ...baseFilter,
      "fulfillmentLocation.city": { $exists: true },
    })
      .select("region fulfillmentLocation")
      .limit(120)
      .lean();

    const locSeen = new Set<string>();
    const locations: { kind: "city" | "state" | "region"; name: string }[] = [];
    for (const p of locPool as any[]) {
      const fl = p.fulfillmentLocation || {};
      const candidates: { kind: "city" | "state" | "region"; name: string }[] = [
        { kind: "city", name: String(fl.city || "").trim() },
        { kind: "state", name: String(fl.state || "").trim() },
        { kind: "region", name: String(p.region || fl.country || "").trim() },
      ];
      for (const c of candidates) {
        if (!c.name) continue;
        if (ql.length > 1 && !c.name.toLowerCase().includes(ql)) continue;
        const id = `${c.kind}:${c.name}`.toLowerCase();
        if (locSeen.has(id)) continue;
        locSeen.add(id);
        locations.push(c);
      }
    }

    // ── Typed items WITH images (this is what Browse uses) ───
    const items: any[] = [];

    for (const p of products as any[]) {
      const seller = p.seller || {};
      items.push({
        kind: "product",
        id: String(p._id),
        label: p.name,
        sub: p.brand || p.category || undefined,
        value: p.name,
        meta: String(p._id),
        image: firstImage(p.images), // ← product photo
      });
      // also surface store from product seller if name matches
      const storeName = seller.storeName || seller.name;
      if (
        storeName &&
        String(storeName).toLowerCase().includes(ql) &&
        seller._id
      ) {
        items.push({
          kind: "store",
          id: `store-from-p-${seller._id}`,
          label: storeName,
          sub: "Storefront",
          value: storeName,
          meta: String(seller._id),
          image: seller.storeLogo || undefined,
        });
      }
    }

    for (const s of stores) {
      items.push({
        kind: "store",
        id: s._id,
        label: s.storeName,
        sub: "Storefront",
        value: s.storeName,
        meta: s._id,
        image: s.storeLogo || undefined, // ← store logo
      });
    }

    for (const b of brands) {
      items.push({
        kind: "brand",
        id: `brand-${b}`,
        label: b,
        sub: "Brand",
        value: b,
        image: brandImageMap.get(b.toLowerCase()), // ← sample product image
      });
    }

    for (const c of categories) {
      items.push({
        kind: "category",
        id: `cat-${c}`,
        label: c,
        sub: "Category",
        value: c,
        // image filled on client from FLOORS
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
        image: s.image, // product that carries this spec
      });
    }

    for (const l of locations.slice(0, 8)) {
      items.push({
        kind: "location",
        id: `loc-${l.kind}-${l.name}`,
        label: l.name,
        sub: l.kind,
        value: l.name,
        meta: l.kind,
      });
    }

    // Dedupe by kind+value, prefer ones with image
    const seen = new Set<string>();
    const deduped: any[] = [];
    for (const it of items) {
      const key = `${it.kind}:${String(it.value || "").toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(it);
    }

    return res.json({
      success: true,
      data: {
        items: deduped.slice(0, 16),
        products,
        stores,
        brands,
        categories,
        specs: specs.map(({ key, value }) => ({ key, value })),
        locations: locations.slice(0, 8),
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