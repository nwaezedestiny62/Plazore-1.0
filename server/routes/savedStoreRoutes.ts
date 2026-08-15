import express from "express";
import { protect } from "../middleware/auth.js";
import {
  getSavedStores,
  toggleSavedStore,
} from "../controllers/savedStoreController.js";

const SavedStoreRouter = express.Router();

SavedStoreRouter.get("/", protect, getSavedStores);
SavedStoreRouter.post("/toggle", protect, toggleSavedStore);

export default SavedStoreRouter;