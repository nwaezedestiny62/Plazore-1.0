import { Request, Response } from "express";
import Product from "../models/Products.js";
import cloudinary from "../config/cloudinary.js";

const getUser = (req: Request) => (req as any).user;

// Public - Get all active products
export const getProducts = async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const query: any = { isActive: true };

    if (req.query.seller) {
      query.seller = req.query.seller;
    }
    if (req.query.category) {
      query.category = req.query.category;
    }

    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .populate("seller", "name storeName storeLogo")
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: products,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Public - Get single product
export const getProduct = async (req: Request, res: Response) => {
  try {
    const product = await Product.findById(req.params.id).populate(
      "seller",
      "name storeName storeLogo storeDescription isSellerVerified"
    );

    if (!product || !product.isActive) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    res.json({ success: true, data: product });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create product (Seller / Admin)
export const createProduct = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    let images: string[] = [];

    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      const uploadPromises = (req.files as any[]).map(
        (file) =>
          new Promise<string>((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
              { folder: "plazore/products" },
              (error, result) => {
                if (error) reject(error);
                else resolve(result!.secure_url);
              }
            );
            uploadStream.end(file.buffer);
          })
      );
      images = await Promise.all(uploadPromises);
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

    if (!name?.trim() || !description?.trim() || price === undefined) {
      return res.status(400).json({
        success: false,
        message: "Name, description and price are required",
      });
    }

    if (!category?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Category is required",
      });
    }

    const method = shippingMethod === "self" ? "self" : "courier";
    const fee = Number(deliveryFee);
    const safeFee = Number.isFinite(fee) && fee >= 0 ? fee : 0;

    if (method === "courier" && !(courierCompany || "").trim()) {
      return res.status(400).json({
        success: false,
        message: "Courier company is required for courier delivery",
      });
    }

    const product = await Product.create({
      name: String(name).trim(),
      description: String(description).trim(),
      price: Number(price),
      stock: Number(stock) || 0,
      category: String(category).trim(),
      subCategory: String(subCategory || "").trim(),
      brand: String(brand || "").trim(),
      images,
      seller: user._id,
      isFeatured: false,
      isActive: true,
      shipping: {
        method,
        courierCompany:
          method === "courier" ? String(courierCompany || "").trim() : "",
        deliveryFee: safeFee,
      },
    });

    res.status(201).json({ success: true, data: product });
  } catch (error: any) {
    console.error("createProduct:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update product
export const updateProduct = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
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
      const uploadPromises = (req.files as any[]).map(
        (file) =>
          new Promise<string>((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
              { folder: "plazore/products" },
              (error, result) => {
                if (error) reject(error);
                else resolve(result!.secure_url);
              }
            );
            uploadStream.end(file.buffer);
          })
      );
      const newImages = await Promise.all(uploadPromises);
      images = [...images, ...newImages];
    }

    const updates: any = {};

    if (req.body.name !== undefined) updates.name = String(req.body.name).trim();
    if (req.body.description !== undefined)
      updates.description = String(req.body.description).trim();
    if (req.body.price !== undefined) updates.price = Number(req.body.price);
    if (req.body.stock !== undefined) updates.stock = Number(req.body.stock);
    if (req.body.category !== undefined)
      updates.category = String(req.body.category).trim();
    if (req.body.subCategory !== undefined)
      updates.subCategory = String(req.body.subCategory).trim();
    if (req.body.brand !== undefined)
      updates.brand = String(req.body.brand).trim();

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
                req.body.courierCompany ?? product.shipping?.courierCompany ?? ""
              ).trim()
            : "",
        deliveryFee: Number.isFinite(fee) && fee >= 0 ? fee : 0,
      };
    }

    if (images.length > 0) {
      updates.images = images;
    }

    const updated = await Product.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete product
export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
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
      const deletePromises = product.images.map(async (imageUrl: string) => {
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
      });
      await Promise.all(deletePromises);
    }

    await Product.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: "Product deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};