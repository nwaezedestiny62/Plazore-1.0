import crypto from "crypto";

/**
 * Creates a deterministic fingerprint of the fields that should trigger
 * Plazore AI regeneration.
 *
 * Only these fields matter:
 * - name (title)
 * - description
 * - images
 * - price
 * - shipping.method / courierCompany / deliveryFee
 * - fulfillmentLocation
 */
export function generateProductFingerprint(product: any): string {
  const payload = {
    name: product.name?.trim() || "",
    description: product.description?.trim() || "",
    images: Array.isArray(product.images)
      ? [...product.images].sort()
      : [],
    price: Number(product.price) || 0,
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
  };

  const normalized = JSON.stringify(payload);
  return crypto.createHash("sha256").update(normalized).digest("hex");
}