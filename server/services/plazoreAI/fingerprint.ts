import crypto from "crypto";

function plainMap(
  raw: Map<string, string> | Record<string, string> | undefined | null
): Record<string, string> {
  if (!raw) return {};
  if (raw instanceof Map) return Object.fromEntries(raw);
  return { ...raw };
}

/**
 * Creates a deterministic fingerprint of the fields that should trigger
 * Plazore AI regeneration.
 *
 * Included (product understanding / content):
 * - name, description, images, base price
 * - category, subCategory, brand
 * - specifications
 * - shipping.method / courierCompany / deliveryFee
 * - fulfillmentLocation
 * - options structure (names + values)
 * - variant structure (keys, option values, available, price overrides)
 *   — NOT variant stock quantities
 *
 * Excluded on purpose (operational inventory only):
 * - product.stock
 * - variants[].stock
 */
export function generateProductFingerprint(product: any): string {
  const specifications = plainMap(product.specifications);
  const specKeys = Object.keys(specifications).sort();
  const specsNormalized: Record<string, string> = {};
  for (const k of specKeys) {
    specsNormalized[k] = String(specifications[k] ?? "").trim();
  }

  const options = Array.isArray(product.options)
    ? product.options
        .map((o: any) => ({
          name: String(o?.name || "")
            .trim()
            .toLowerCase(),
          values: Array.isArray(o?.values)
            ? [...o.values]
                .map((v: any) => String(v ?? "").trim().toLowerCase())
                .filter(Boolean)
                .sort()
            : [],
        }))
        .filter((o: any) => o.name)
        .sort((a: any, b: any) => a.name.localeCompare(b.name))
    : [];

  // Structure only — never stock
  const variants = Array.isArray(product.variants)
    ? product.variants
        .map((v: any) => {
          const opts = plainMap(v?.options);
          const optEntries = Object.entries(opts)
            .map(([k, val]) => [
              String(k).trim().toLowerCase(),
              String(val ?? "").trim().toLowerCase(),
            ])
            .filter(([k, val]) => k && val)
            .sort((a, b) => a[0].localeCompare(b[0]));

          return {
            key: String(v?.key || "").trim().toLowerCase(),
            options: Object.fromEntries(optEntries),
            available: v?.available === false ? false : true,
            price:
              v?.price != null && Number.isFinite(Number(v.price))
                ? Number(v.price)
                : null,
          };
        })
        .sort((a: any, b: any) => a.key.localeCompare(b.key))
    : [];

  const payload = {
    name: product.name?.trim() || "",
    description: product.description?.trim() || "",
    images: Array.isArray(product.images)
      ? [...product.images].map(String).sort()
      : [],
    price: Number(product.price) || 0,
    category: String(product.category || "").trim(),
    subCategory: String(product.subCategory || "").trim(),
    brand: String(product.brand || "").trim(),
    specifications: specsNormalized,
    shipping: {
      method: product.shipping?.method || "",
      courierCompany: product.shipping?.courierCompany || "",
      deliveryFee: Number(product.shipping?.deliveryFee) || 0,
    },
    fulfillmentLocation: product.fulfillmentLocation
      ? {
          countryCode: product.fulfillmentLocation.countryCode || "",
          state: product.fulfillmentLocation.state || "",
          city: product.fulfillmentLocation.city || "",
        }
      : null,
    hasVariants: !!product.hasVariants,
    options,
    variants,
  };

  const normalized = JSON.stringify(payload);
  return crypto.createHash("sha256").update(normalized).digest("hex");
}