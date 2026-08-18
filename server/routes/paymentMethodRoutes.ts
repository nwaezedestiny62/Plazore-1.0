import express from "express";
import { protect } from "../middleware/auth.js";
import {
  getPaymentMethods,
  addPaymentMethod,
  setDefaultPaymentMethod,
  deletePaymentMethod,
} from "../controllers/paymentMethodController.js";

const PaymentMethodRouter = express.Router();

PaymentMethodRouter.get("/", protect, getPaymentMethods);
PaymentMethodRouter.post("/", protect, addPaymentMethod);
PaymentMethodRouter.put("/:id/default", protect, setDefaultPaymentMethod);
PaymentMethodRouter.delete("/:id", protect, deletePaymentMethod);

export default PaymentMethodRouter;