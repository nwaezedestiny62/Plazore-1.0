import express from "express";
import { createProduct, getProduct, getProducts, updateProduct, deleteProduct } from "../controllers/productController.js";
import upload from "../middleware/upload.js";
import { authorize, protect } from "../middleware/auth.js";
const ProductRouter = express.Router();
// ==================== PUBLIC ROUTES ====================
// Get all products
ProductRouter.get('/', getProducts);
// Get single product
ProductRouter.get('/:id', getProduct);
// ==================== PROTECTED ROUTES (Admin Only) ====================
// Create product
ProductRouter.post('/', protect, authorize('admin'), upload.array("images", 5), createProduct);
// Update product
ProductRouter.put('/:id', protect, authorize('admin'), upload.array("images", 5), updateProduct);
// Delete product
ProductRouter.delete('/:id', protect, authorize('admin'), deleteProduct);
export default ProductRouter;
