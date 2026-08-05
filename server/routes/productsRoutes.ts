import express from "express";
import {
  createProduct,
  getProduct,
  getProducts,
  updateProduct,
  deleteProduct,
} from "../controllers/productController.js";
import upload from "../middleware/upload.js";
import { authorize, protect } from "../middleware/auth.js";

const ProductRouter = express.Router();

// Public
ProductRouter.get("/", getProducts);
ProductRouter.get("/:id", getProduct);

// Admin create/update/delete
ProductRouter.post(
  "/",
  protect,
  authorize("admin"),
  upload.fields([
    { name: "images", maxCount: 10 },
    { name: "documents", maxCount: 5 },
  ]),
  createProduct
);

ProductRouter.put(
  "/:id",
  protect,
  authorize("admin"),
  upload.fields([
    { name: "images", maxCount: 10 },
    { name: "documents", maxCount: 5 },
  ]),
  updateProduct
);

ProductRouter.delete("/:id", protect, authorize("admin"), deleteProduct);

export default ProductRouter;