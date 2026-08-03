import { Router } from "express";
import { getProductAI } from "../controllers/aiController.js";

const router = Router();

router.get("/product/:id", getProductAI);

export default router;