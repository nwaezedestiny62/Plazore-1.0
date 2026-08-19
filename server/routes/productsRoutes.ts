import express from "express";
import {
  createProduct,
  getProduct,
  getProducts,
  updateProduct,
  deleteProduct,
  setProductVisibility,
} from "../controllers/productController.js";
import upload from "../middleware/upload.js";
import { authorize, protect } from "../middleware/auth.js";
import SellerRouter from "./sellerRoutes.js";

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

SellerRouter.patch(
  "/products/:id/visibility",
  protect,
  authorize("seller", "admin"),
  setProductVisibility
);

ProductRouter.delete("/:id", protect, authorize("admin"), deleteProduct);

export default ProductRouter;