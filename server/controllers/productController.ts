import { Request, Response } from "express";
import Product from "../models/Products.js";
import cloudinary from "../config/cloudinary.js";

// Get all products with pagination
export const getProducts = async (req: Request, res: Response) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;

        const query = { isActive: true };

        const total = await Product.countDocuments(query);
        const products = await Product.find(query)
            .skip((page - 1) * limit)
            .limit(limit)
            .sort({ createdAt: -1 }); // Good to add sorting

        res.json({
            success: true,
            data: products,
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit),
                limit
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get single product
export const getProduct = async (req: Request, res: Response) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product || !product.isActive) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        res.json({ success: true, data: product });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Create product
export const createProduct = async (req: Request, res: Response) => {
    try {
        let images: string[] = [];

        if (req.files && Array.isArray(req.files) && req.files.length > 0) {
            const uploadPromises = (req.files as any[]).map((file) => 
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
                message: "Please upload at least one image" 
            });
        }

        const productData = {
            ...req.body,
            images,
        };

        const product = await Product.create(productData);
        
        res.status(201).json({ success: true, data: product });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update product
export const updateProduct = async (req: Request, res: Response) => {
    try {
        let images: string[] = [];

        // Keep existing images
        if (req.body.existingImages) {
            images = Array.isArray(req.body.existingImages) 
                ? [...req.body.existingImages] 
                : [req.body.existingImages];
        }

        // Upload new images
        if (req.files && Array.isArray(req.files) && req.files.length > 0) {
            const uploadPromises = (req.files as any[]).map((file) =>
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

        const updates = { ...req.body };
        delete updates.existingImages;

        // Only update images if any were provided (existing or new)
        if (images.length > 0) {
            updates.images = images;
        }

        const product = await Product.findByIdAndUpdate(
            req.params.id,
            updates,
            { new: true, runValidators: true }
        );

        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        res.json({ success: true, data: product });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Delete product
export const deleteProduct = async (req: Request, res: Response) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        // Delete images from Cloudinary
        if (product.images?.length > 0) {
            const deletePromises = product.images.map(async (imageUrl: string) => {
                try {
                    // Better public_id extraction for Cloudinary with folders
                    const publicId = imageUrl
                        .split("/upload/")[1]
                        ?.split("/").slice(1).join("/")
                        .replace(/\.[^/.]+$/, "");

                    if (publicId) {
                        await cloudinary.uploader.destroy(publicId);
                    }
                } catch (err) {
                    console.error("Failed to delete image from Cloudinary:", err);
                    // Don't fail the whole operation if one image delete fails
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