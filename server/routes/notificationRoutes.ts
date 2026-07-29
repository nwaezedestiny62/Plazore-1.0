import express from "express";
import { protect } from "../middleware/auth.js";
import {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
} from "../controllers/notificationController.js";

const NotificationRouter = express.Router();

NotificationRouter.get("/", protect, getMyNotifications);
NotificationRouter.patch("/:id/read", protect, markAsRead);
NotificationRouter.patch("/read-all", protect, markAllAsRead);

export default NotificationRouter;