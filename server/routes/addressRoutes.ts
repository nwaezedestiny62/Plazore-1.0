import express from "express";
import { protect } from "../middleware/auth.js";
import {
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from "../controllers/addressController.js";

const AddressRouter = express.Router();

AddressRouter.get("/", protect, getAddresses);
AddressRouter.post("/", protect, addAddress);
AddressRouter.put("/:id", protect, updateAddress);
AddressRouter.put("/:id/default", protect, setDefaultAddress);  // ← important
AddressRouter.delete("/:id", protect, deleteAddress);

export default AddressRouter;