import express from "express";
import { protect } from "../middleware/auth.js";
import {
  getMe,
  updateMe,
  savePushToken,
} from "../controllers/userController.js";

const UserRouter = express.Router();

UserRouter.get("/me", protect, getMe);
UserRouter.patch("/me", protect, updateMe);
UserRouter.post("/push-token", protect, savePushToken);

export default UserRouter;
