import express from "express";
import {
  getCurrencyConfig,
  postConvert,
} from "../controllers/currencyController.js";

const CurrencyRouter = express.Router();

CurrencyRouter.get("/config", getCurrencyConfig);
CurrencyRouter.post("/convert", postConvert);

export default CurrencyRouter;