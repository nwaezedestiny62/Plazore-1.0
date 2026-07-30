import express from "express";
import { protect } from "../middleware/auth.js";
import { getMe, updateMe } from "../controllers/userController.js";

const UserRouter = express.Router();

UserRouter.get("/me", protect, getMe);
UserRouter.patch("/me", protect, updateMe);

export default UserRouter;