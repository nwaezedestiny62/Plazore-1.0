import { Request, Response } from "express";
import Product from "../models/Products.js";
import User from "../models/User.js";

function escapeRegex(q: string) {
  return q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function firstImage(images: unknown): string | undefined {
  if (!Array.isArray(images) || images.length === 0) return undefined;
  const u = String(images[0] ?? "").trim();
  return u || undefined;
}

function asMapSpecs(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  if (raw instanceof Map) {
    raw.forEach((v, k) => {
      const key = String(k ?? "").trim();
      const val = String(v ?? "").trim();
      if (key && val) out[key] = val;
    });
    return out;
  }
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = String(k ?? "").trim();
    const val = String(v ?? "").trim();
    if (key && val) out[key] = val;
  }
  return out;
}

type LocKind = "city" | "state" | "region";

export const searchSuggest = async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || "").trim();
    const region = String(req.query.region || "").trim().toUpperCase();

    const empty = {
      items: [] as unknown[],
      products: [] as unknown[],
      stores: [] as unknown[],
      brands: [] as string[],
      categories: [] as string[],
      specs: [] as { key: string; value: string }[],
      locations: [] as { kind: LocKind; name: string }[],
    };

    if (q.length < 1) {
      return res.json({ success: true, data: empty });
    }

    const regex = new RegExp(escapeRegex(q), "i");
    const ql = q.toLowerCase();
    const baseFilter: Record<string, unknown> = { isActive: true };
    if (region) baseFilter.region = region;

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
      .map((c) => String(c || "").trim())
      .filter(Boolean)
      .slice(0, 6);

    const brands = (matchingBrands || [])
      .map((b) => String(b || "").trim())
      .filter((b) => b && b.toLowerCase().includes(ql))
      .slice(0, 6);

    const brandImageMap = new Map<string, string>();
    if (brands.length) {
      const brandProducts = await Product.find({
        ...baseFilter,
        brand: { $in: brands },
        "images.0": { $exists: true },
      })
        .select("brand images")
        .limit(40)
        .lean();

      for (const p of brandProducts as any[]) {
        const b = String(p.brand || "")
          .trim()
          .toLowerCase();
        const img = firstImage(p.images);
        if (b && img && !brandImageMap.has(b)) brandImageMap.set(b, img);
      }
    }

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
      const img = firstImage(p.images);
      for (const [key, value] of Object.entries(asMapSpecs(p.specifications))) {
        if (
          !key.toLowerCase().includes(ql) &&
          !value.toLowerCase().includes(ql)
        ) {
          continue;
        }
        const id = `${key}::${value}`.toLowerCase();
        if (specSeen.has(id)) continue;
        specSeen.add(id);
        specHits.push({ key, value, image: img });
      }
    }
    // FIX: define specs from specHits
    const specs = specHits.slice(0, 8);

    const locPool = await Product.find({
      ...baseFilter,
      "fulfillmentLocation.city": { $exists: true },
    })
      .select("region fulfillmentLocation")
      .limit(120)
      .lean();

    const locSeen = new Set<string>();
    const locations: { kind: LocKind; name: string }[] = [];
    for (const p of locPool as any[]) {
      const fl = p.fulfillmentLocation || {};
      for (const c of [
        { kind: "city" as const, name: String(fl.city || "").trim() },
        { kind: "state" as const, name: String(fl.state || "").trim() },
        {
          kind: "region" as const,
          name: String(p.region || fl.country || "").trim(),
        },
      ]) {
        if (!c.name) continue;
        if (ql.length > 1 && !c.name.toLowerCase().includes(ql)) continue;
        const id = `${c.kind}:${c.name}`.toLowerCase();
        if (locSeen.has(id)) continue;
        locSeen.add(id);
        locations.push(c);
      }
    }

    const items: Array<{
      kind: string;
      id: string;
      label: string;
      sub?: string;
      value: string;
      meta?: string;
      image?: string;
    }> = [];

    for (const p of products as any[]) {
      items.push({
        kind: "product",
        id: String(p._id),
        label: p.name,
        sub: p.brand || p.category || undefined,
        value: p.name,
        meta: String(p._id),
        image: firstImage(p.images),
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
        image: brandImageMap.get(b.toLowerCase()),
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
        image: s.image,
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

    const seen = new Set<string>();
    const deduped: typeof items = [];
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
      message: error?.message || "Search suggest failed",
    });
  }
};