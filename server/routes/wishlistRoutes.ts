import express from "express";
import { protect } from "../middleware/auth.js";
import {
  getWishlist,
  toggleWishlist,
  removeFromWishlist,
} from "../controllers/wishlistController.js";

const WishlistRouter = express.Router();

WishlistRouter.get("/", protect, getWishlist);
WishlistRouter.post("/toggle", protect, toggleWishlist);
WishlistRouter.delete("/:productId", protect, removeFromWishlist);

export default WishlistRouter;