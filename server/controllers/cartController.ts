import { Request, Response } from "express";
import Cart from "../models/Cart.js";
import Product from "../models/Products.js";
import { trackProductPerformance } from "../utils/performance.js";

const getUser = (req: Request) => (req as any).user;

const PRODUCT_POPULATE =
  "name images price stock hasVariants options variants isActive";

function optionsToPlain(
  opts: Map<string, string> | Record<string, string> | undefined | null
): Record<string, string> {
  if (!opts) return {};
  if (opts instanceof Map) return Object.fromEntries(opts);
  return { ...opts };
}

function buildVariantKey(options: Record<string, string>): string {
  return Object.entries(options || {})
    .map(([k, v]) => [
      String(k).trim().toLowerCase(),
      String(v).trim().toLowerCase(),
    ])
    .filter(([k, v]) => k && v)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `${k}=${v}`)
    .join("|");
}

function sameCartLine(
  item: any,
  productId: string,
  variantKey: string
): boolean {
  if (item.product.toString() !== productId) return false;
  const itemKey = String(item.variantKey || "").trim();
  return itemKey === String(variantKey || "").trim();
}

/**
 * Resolve variant from product + request body.
 * Returns null if product requires a variant and selection is missing/invalid.
 */
function resolveCartVariant(
  product: any,
  body: {
    variantId?: string;
    variantKey?: string;
    selectedOptions?: Record<string, string>;
  }
): {
  variantId: string;
  variantKey: string;
  selectedOptions: Record<string, string>;
  unitPrice: number;
  availableStock: number;
} | null {
  const hasVariants = !!product.hasVariants;
  const variants: any[] = product.variants || [];

  if (!hasVariants || variants.length === 0) {
    return {
      variantId: "",
      variantKey: "",
      selectedOptions: {},
      unitPrice: Number(product.price) || 0,
      availableStock: Number(product.stock) || 0,
    };
  }

  let variant: any = null;
  const variantId = String(body.variantId || "").trim();
  let variantKey = String(body.variantKey || "").trim();
  const selected = optionsToPlain(body.selectedOptions);

  if (variantId) {
    variant = variants.find((v) => String(v.variantId) === variantId);
  }
  if (!variant && variantKey) {
    variant = variants.find((v) => String(v.key) === variantKey);
  }
  if (!variant && Object.keys(selected).length > 0) {
    const keyFromOpts = buildVariantKey(selected);
    variant = variants.find((v) => String(v.key) === keyFromOpts);
  }

  if (!variant || variant.available === false) {
    return null;
  }

  const optPlain = optionsToPlain(variant.options);
  const priceOverride =
    variant.price != null && Number.isFinite(Number(variant.price))
      ? Number(variant.price)
      : null;

  return {
    variantId: String(variant.variantId),
    variantKey: String(variant.key),
    selectedOptions: optPlain,
    unitPrice:
      priceOverride != null ? priceOverride : Number(product.price) || 0,
    availableStock: Number(variant.stock) || 0,
  };
}

function serializeCart(cart: any) {
  if (!cart) return cart;
  const obj = typeof cart.toObject === "function" ? cart.toObject() : cart;

  if (Array.isArray(obj.items)) {
    obj.items = obj.items.map((item: any) => {
      const plain = { ...item };
      plain.selectedOptions = optionsToPlain(item.selectedOptions);

      if (plain.product && typeof plain.product === "object") {
        const p = { ...plain.product };
        if (p.specifications instanceof Map) {
          p.specifications = Object.fromEntries(p.specifications);
        }
        if (Array.isArray(p.variants)) {
          p.variants = p.variants.map((v: any) => ({
            ...v,
            options: optionsToPlain(v.options),
          }));
        }
        plain.product = p;
      }
      return plain;
    });
  }

  return obj;
}

// ======================================================
// GET /api/cart
// ======================================================
export const getCart = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    let cart = await Cart.findOne({ user: user._id }).populate(
      "items.product",
      PRODUCT_POPULATE
    );

    if (!cart) {
      cart = await Cart.create({ user: user._id, items: [] });
    }

    res.json({ success: true, data: serializeCart(cart) });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ======================================================
// POST /api/cart/add
// Body: { productId, quantity?, variantId?, variantKey?, selectedOptions? }
// ======================================================
export const addtoCart = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const {
      productId,
      quantity = 1,
      variantId,
      variantKey,
      selectedOptions,
    } = req.body;

    const qty = Number(quantity) || 1;
    if (qty < 1) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid quantity" });
    }

    const product = await Product.findById(productId);
    if (!product || product.isActive === false) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    const resolved = resolveCartVariant(product, {
      variantId,
      variantKey,
      selectedOptions: optionsToPlain(selectedOptions),
    });

    if (!resolved) {
      return res.status(400).json({
        success: false,
        message:
          "Please select a valid product option (e.g. size / color) before adding to cart",
      });
    }

    if (resolved.availableStock < qty) {
      return res
        .status(400)
        .json({ success: false, message: "Insufficient stock" });
    }

    let cart = await Cart.findOne({ user: user._id });
    if (!cart) {
      cart = new Cart({ user: user._id, items: [] });
    }

    const existingItem = cart.items.find((item) =>
      sameCartLine(item, String(productId), resolved.variantKey)
    );

    if (existingItem) {
      const newQty = existingItem.quantity + qty;
      if (resolved.availableStock < newQty) {
        return res
          .status(400)
          .json({ success: false, message: "Insufficient stock" });
      }
      existingItem.quantity = newQty;
      existingItem.price = resolved.unitPrice;
      existingItem.variantId = resolved.variantId;
      existingItem.variantKey = resolved.variantKey;
      (existingItem as any).selectedOptions = resolved.selectedOptions;
    } else {
      cart.items.push({
        product: productId,
        quantity: qty,
        price: resolved.unitPrice,
        variantId: resolved.variantId,
        variantKey: resolved.variantKey,
        selectedOptions: resolved.selectedOptions,
      } as any);
    }

    cart.calculateTotal();
    await cart.save();

    trackProductPerformance({
      productId: String(productId),
      action: "cart",
      actorUserId: user._id.toString(),
    }).catch(() => {});

    await cart.populate("items.product", PRODUCT_POPULATE);
    res.json({ success: true, data: serializeCart(cart) });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ======================================================
// PUT /api/cart/item/:productId
// Body: { quantity, variantId?, variantKey? }
// Matches line by productId + variantKey (query or body)
// ======================================================
export const updateCartItem = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const { quantity } = req.body;
    const { productId } = req.params;
    const variantKey = String(
      req.body.variantKey ?? req.query.variantKey ?? ""
    ).trim();
    const variantId = String(
      req.body.variantId ?? req.query.variantId ?? ""
    ).trim();

    const cart = await Cart.findOne({ user: user._id });
    if (!cart) {
      return res
        .status(404)
        .json({ success: false, message: "Cart not found" });
    }

    // Prefer explicit variant match; fall back to first matching product if no key
    let item = cart.items.find((i) =>
      sameCartLine(i, String(productId), variantKey)
    );
    if (!item && !variantKey && !variantId) {
      item = cart.items.find((i) => i.product.toString() === productId);
    }
    if (!item && variantId) {
      item = cart.items.find(
        (i) =>
          i.product.toString() === productId &&
          String((i as any).variantId || "") === variantId
      );
    }

    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Item not in cart" });
    }

    const qty = Number(quantity);

    if (!Number.isFinite(qty) || qty <= 0) {
      cart.items = cart.items.filter((i) => i !== item);
    } else {
      const product = await Product.findById(productId);
      if (!product || product.isActive === false) {
        return res
          .status(404)
          .json({ success: false, message: "Product not found" });
      }

      const resolved = resolveCartVariant(product, {
        variantId: (item as any).variantId || variantId,
        variantKey: (item as any).variantKey || variantKey,
        selectedOptions: optionsToPlain((item as any).selectedOptions),
      });

      if (!resolved) {
        return res.status(400).json({
          success: false,
          message: "Selected option is no longer available",
        });
      }

      if (resolved.availableStock < qty) {
        return res
          .status(400)
          .json({ success: false, message: "Insufficient stock" });
      }

      item.quantity = qty;
      item.price = resolved.unitPrice;
      (item as any).variantId = resolved.variantId;
      (item as any).variantKey = resolved.variantKey;
      (item as any).selectedOptions = resolved.selectedOptions;
    }

    cart.calculateTotal();
    await cart.save();
    await cart.populate("items.product", PRODUCT_POPULATE);
    res.json({ success: true, data: serializeCart(cart) });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ======================================================
// DELETE /api/cart/item/:productId
// Optional query: ?variantKey=... or ?variantId=...
// ======================================================
export const removeCartItem = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const productId = String(req.params.productId);
    const variantKey = String(req.query.variantKey || "").trim();
    const variantId = String(req.query.variantId || "").trim();

    const cart = await Cart.findOne({ user: user._id });
    if (!cart) {
      return res
        .status(404)
        .json({ success: false, message: "Cart not found" });
    }

    const before = cart.items.length;

    cart.items = cart.items.filter((item) => {
      if (item.product.toString() !== productId) return true;

      if (variantId) {
        return String((item as any).variantId || "") !== variantId;
      }
      if (variantKey) {
        return String((item as any).variantKey || "") !== variantKey;
      }
      // No variant specified → remove all lines for this product
      return false;
    });

    if (cart.items.length === before) {
      return res
        .status(404)
        .json({ success: false, message: "Item not in cart" });
    }

    cart.calculateTotal();
    await cart.save();
    await cart.populate("items.product", PRODUCT_POPULATE);

    res.json({ success: true, data: serializeCart(cart) });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ======================================================
// DELETE /api/cart (clear) — keep route name clearCart
// ======================================================
export const clearCart = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const cart = await Cart.findOne({ user: user._id });
    if (cart) {
      cart.items = [];
      cart.totalAmount = 0;
      await cart.save();
    }
    res.json({
      success: true,
      data: cart || { items: [], totalAmount: 0 },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};